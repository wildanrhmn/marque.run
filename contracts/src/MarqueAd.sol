// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ERC721} from "openzeppelin/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";

contract MarqueAd is ERC721, Ownable {
    struct Provenance {
        bytes32 briefId;
        address operator;
        uint96 totalSpendAtoms;
        bytes32[] settlementTxHashes;
        string ipfsUri;
    }

    uint256 public nextTokenId;
    mapping(uint256 => Provenance) public provenanceOf;

    event AdMinted(
        uint256 indexed tokenId,
        bytes32 indexed briefId,
        address indexed operator,
        uint96 totalSpendAtoms,
        string ipfsUri
    );

    error EmptyProvenance();

    constructor(address initialOwner) ERC721("MARQUE Ad", "DRAD") Ownable(initialOwner) {}

    function mintAd(
        address to,
        bytes32 briefId,
        uint96 totalSpendAtoms,
        bytes32[] calldata settlementTxHashes,
        string calldata ipfsUri
    ) external returns (uint256 tokenId) {
        if (settlementTxHashes.length == 0) revert EmptyProvenance();

        tokenId = nextTokenId++;
        _safeMint(to, tokenId);

        provenanceOf[tokenId] = Provenance({
            briefId: briefId,
            operator: to,
            totalSpendAtoms: totalSpendAtoms,
            settlementTxHashes: settlementTxHashes,
            ipfsUri: ipfsUri
        });

        emit AdMinted(tokenId, briefId, to, totalSpendAtoms, ipfsUri);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return provenanceOf[tokenId].ipfsUri;
    }

    function settlementHashesOf(uint256 tokenId) external view returns (bytes32[] memory) {
        _requireOwned(tokenId);
        return provenanceOf[tokenId].settlementTxHashes;
    }
}

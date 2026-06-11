// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MarquePiece} from "../src/MarquePiece.sol";

contract MarquePieceTest is Test {
    MarquePiece internal nft;
    address internal owner = address(0xA11CE);
    address internal operator = address(0xB0B);

    function setUp() public {
        nft = new MarquePiece(owner);
    }

    function test_MintRecordsProvenance() public {
        bytes32[] memory hashes = new bytes32[](3);
        hashes[0] = bytes32(uint256(1));
        hashes[1] = bytes32(uint256(2));
        hashes[2] = bytes32(uint256(3));

        uint256 tokenId = nft.mintPiece(operator, bytes32(uint256(0xBEEF)), 2_000_000, hashes, "ipfs://abc");
        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(tokenId), operator);
        assertEq(nft.tokenURI(tokenId), "ipfs://abc");
        bytes32[] memory stored = nft.settlementHashesOf(tokenId);
        assertEq(stored.length, 3);
        assertEq(stored[2], bytes32(uint256(3)));
    }

    function test_RevertOnEmptyProvenance() public {
        bytes32[] memory hashes = new bytes32[](0);
        vm.expectRevert(MarquePiece.EmptyProvenance.selector);
        nft.mintPiece(operator, bytes32(0), 0, hashes, "");
    }
}

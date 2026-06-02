// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {MarqueAd} from "../src/MarqueAd.sol";

contract DeployMarqueAd is Script {
    function run() external returns (MarqueAd nft) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envOr("DEPLOY_OWNER", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        nft = new MarqueAd(owner);
        vm.stopBroadcast();

        console2.log("MarqueAd deployed at:", address(nft));
        console2.log("Owner:", owner);
    }
}

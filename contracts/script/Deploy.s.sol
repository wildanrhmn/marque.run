// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {DelegateRunAd} from "../src/DelegateRunAd.sol";

contract DeployDelegateRunAd is Script {
    function run() external returns (DelegateRunAd nft) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envOr("DEPLOY_OWNER", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);
        nft = new DelegateRunAd(owner);
        vm.stopBroadcast();

        console2.log("DelegateRunAd deployed at:", address(nft));
        console2.log("Owner:", owner);
    }
}

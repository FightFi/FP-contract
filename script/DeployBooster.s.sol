// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Script, console2 } from "forge-std/Script.sol";
import { FP1155 } from "src/FP1155.sol";
import { Booster } from "src/Booster.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployBooster
 * @notice Foundry script to deploy Booster and wire required FP1155 roles.
 * @dev Environment variables:
 *   PRIVATE_KEY      - deployer key
 *   FP1155_ADDRESS   - existing FP1155 contract address
 *   OPERATOR_ADDRESS  - address to be granted OPERATOR_ROLE (optional; defaults to deployer)
 */
contract DeployBooster is Script {
    function run() external returns (Booster booster) {
        address fpAddr = vm.envAddress("FP1155_ADDRESS");
        address operatorEnv = vm.envOr("OPERATOR_ADDRESS", address(0));

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);
        vm.startBroadcast(pk);

        address operator = operatorEnv == address(0) ? admin : operatorEnv;

        FP1155 fp = FP1155(fpAddr);
        console2.log("Using FP1155:", fpAddr);
        console2.log("Admin:", admin);
        console2.log("Operator:", operator);

        Booster implementation = new Booster();
        bytes memory initData = abi.encodeWithSelector(Booster.initialize.selector, fpAddr, admin);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        booster = Booster(address(proxy));
        console2.log("Booster implementation deployed at:", address(implementation));
        console2.log("Booster proxy deployed at:", address(booster));

        bytes32 transferAgentRole = fp.TRANSFER_AGENT_ROLE();
        if (!fp.hasRole(transferAgentRole, address(booster))) {
            fp.grantRole(transferAgentRole, address(booster));
            console2.log("Granted TRANSFER_AGENT_ROLE to Booster");
        }

        fp.setTransferAllowlist(operator, true);

        bytes32 opRole = booster.OPERATOR_ROLE();
        if (!booster.hasRole(opRole, operator)) {
            booster.grantRole(opRole, operator);
            console2.log("Granted OPERATOR_ROLE to:", operator);
        }

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Verification Instructions ===");
        console2.log("Implementation:", address(implementation));
        console2.log("Proxy:", address(booster));
        console2.log("");
        console2.log("Verify implementation:");
        console2.log(
            "  forge verify-contract", address(implementation), "src/Booster.sol:Booster --chain-id <CHAIN_ID>"
        );
        console2.log("");
        console2.log("Verify proxy:");
        console2.log("  Encode init data: cast abi-encode \"initialize(address,address)\"", fpAddr, admin);
        console2.log(
            "  Then: forge verify-contract",
            address(booster),
            "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy --chain-id <CHAIN_ID> --constructor-args <ENCODED_ARGS>"
        );
    }
}

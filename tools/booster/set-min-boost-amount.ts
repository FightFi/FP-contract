/**
 * @notice Script to set the minimum boost amount in the Booster contract
 *
 * @example Using testnet
 * ts-node tools/booster/set-min-boost-amount.ts --network testnet --amount 1000000000000000000
 *
 * @example Using mainnet
 * ts-node tools/booster/set-min-boost-amount.ts --network mainnet --amount 1000000000000000000
 *
 * @example Set minimum to 1 FP (1e18 wei)
 * ts-node tools/booster/set-min-boost-amount.ts --network testnet --amount 1000000000000000000
 *
 * @example Disable minimum (set to 0)
 * ts-node tools/booster/set-min-boost-amount.ts --network testnet --amount 0
 *
 * @example Using alternative parameter name
 * ts-node tools/booster/set-min-boost-amount.ts --network testnet --min 1000000000000000000
 *
 * @example With custom contract address
 * ts-node tools/booster/set-min-boost-amount.ts --contract 0x123... --amount 1000000000000000000
 *
 * @example Skip confirmation prompt
 * ts-node tools/booster/set-min-boost-amount.ts --network testnet --amount 1000000000000000000 --yes
 *
 * @env MAINNET_BSC_EXPLORER_URL - Block explorer URL for BSC Mainnet (default: https://bscscan.com)
 * @env TESTNET_BSC_EXPLORER_URL - Block explorer URL for BSC Testnet (default: https://testnet.bscscan.com)
 */
import "dotenv/config";
import { ethers } from "ethers";
import {
  parseArgs,
  setupBoosterConfig,
  displayTransactionSummary,
  requestConfirmation,
  waitForTransaction,
} from "./booster.utils";

const ABI = ["function setMinBoostAmount(uint256 newMin) external"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupBoosterConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  const newMin = args.amount || args.min;
  if (!newMin) throw new Error("Missing --amount (or --min)");
  const newMinBigInt = BigInt(newMin);

  const booster = new ethers.Contract(config.contractAddress, ABI, config.wallet);

  // Format amount for display (convert from wei to FP)
  const amountInFP = newMinBigInt === 0n ? "0" : ethers.formatEther(newMinBigInt);

  // Build summary lines
  const summaryLines = [`New minimum boost amount: ${amountInFP} FP (${newMinBigInt} wei)`];
  if (newMinBigInt === 0n) {
    summaryLines.push(`⚠️  Minimum will be disabled (set to 0)`);
  }

  // Display transaction summary
  displayTransactionSummary(config, summaryLines);

  // Request confirmation
  await requestConfirmation(args);

  console.log("\n🚀 Executing transaction...");
  const tx = await booster.setMinBoostAmount(newMinBigInt);
  await waitForTransaction(tx, config.chainId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

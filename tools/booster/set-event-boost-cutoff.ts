/**
 * @notice Script to set the boost cutoff timestamp for all fights in an event (after which new boosts are rejected)
 * 
 * This function sets the cutoff for ALL fights in the event at once. Only fights that are not resolved will be updated.
 * 
 * How to calculate Unix timestamp:
 * - Current timestamp in terminal (Mac/Linux): date +%s
 * - Specific date in terminal (Mac): date -j -f "%Y-%m-%d %H:%M:%S" "2024-01-01 00:00:00" +%s
 * - Specific date in terminal (Linux): date -d "2024-01-01 00:00:00" +%s

 * @example Calculate timestamp for Nov 15, 2025 4:00 PM UTC-7 (using Node.js - recommended)
 * node -e "console.log(Math.floor(new Date('2025-11-15T16:00:00-07:00').getTime() / 1000))"
 * Note: This correctly converts 4:00 PM UTC-7 to 11:00 PM UTC (23:00:00 UTC)

 * 
 * @example Using testnet
 * ts-node tools/booster/set-event-boost-cutoff.ts --network testnet --eventId 322 --cutoff 1763247600
 * 
 * @example Using mainnet
 * ts-node tools/booster/set-event-boost-cutoff.ts --network mainnet --eventId 322 --cutoff 1763247600
 * 
 * @example Disable cutoff (set to 0, relies on status only)
 * ts-node tools/booster/set-event-boost-cutoff.ts --network testnet --eventId 322 --cutoff 0
 * 
 * @example Using alternative parameter names
 * ts-node tools/booster/set-event-boost-cutoff.ts --network testnet --event 322 --timestamp 1763247600
 * 
 * @example With custom contract address
 * ts-node tools/booster/set-event-boost-cutoff.ts --contract 0x123... --eventId 322 --cutoff 1763247600
 * 
 * @example Skip confirmation prompt
 * ts-node tools/booster/set-event-boost-cutoff.ts --network testnet --eventId 322 --cutoff 1763247600 --yes
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

const ABI = [
  "function setEventBoostCutoff(string calldata eventId, uint256 cutoff) external",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupBoosterConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const cutoff = args.cutoff || args.timestamp;
  if (cutoff === undefined)
    throw new Error("Missing --cutoff (or --timestamp)");
  const cutoffBigInt = BigInt(cutoff);

  const booster = new ethers.Contract(config.contractAddress, ABI, config.wallet);

  // Build summary lines
  const summaryLines = [
    `Event ID: ${eventId}`,
    `Cutoff timestamp: ${cutoffBigInt}`,
  ];
  if (cutoffBigInt === 0n) {
    summaryLines.push(`⚠️  Cutoff will be disabled (set to 0)`);
  } else {
    const cutoffDate = new Date(Number(cutoffBigInt) * 1000);
    summaryLines.push(`Cutoff date: ${cutoffDate.toISOString()}`);
  }
  summaryLines.push("Note: Only fights that are not resolved will be updated.");

  // Display transaction summary
  displayTransactionSummary(config, summaryLines);

  // Request confirmation
  await requestConfirmation(args);

  console.log("\n🚀 Executing transaction...");
  const tx = await booster.setEventBoostCutoff(eventId, cutoffBigInt);
  await waitForTransaction(tx, config.chainId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

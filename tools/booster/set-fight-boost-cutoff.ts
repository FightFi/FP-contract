/**
 * @notice Script to set the boost cutoff timestamp for a fight (after which new boosts are rejected)
 *
 * How to calculate Unix timestamp:
 * - Current timestamp in terminal (Mac/Linux): date +%s
 * - Specific date in terminal (Mac): date -j -f "%Y-%m-%d %H:%M:%S" "2024-01-01 00:00:00" +%s
 * - Specific date in terminal (Linux): date -d "2024-01-01 00:00:00" +%s
 * - Using Node.js (current time): node -e "console.log(Math.floor(Date.now() / 1000))"
 * - Using Node.js (specific date): node -e "console.log(Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000))"
 * - Online converter: https://www.epochconverter.com/
 *
 * @example Using testnet
 * ts-node tools/booster/set-fight-boost-cutoff.ts --network testnet --eventId UFC_300 --fightId 1 --cutoff 1704067200
 *
 * @example Using mainnet
 * ts-node tools/booster/set-fight-boost-cutoff.ts --network mainnet --eventId UFC_300 --fightId 1 --cutoff 1704067200
 *
 * @example Set cutoff to a specific unix timestamp
 * ts-node tools/booster/set-fight-boost-cutoff.ts --network testnet --eventId UFC_300 --fightId 1 --cutoff 1704067200
 *
 * @example Calculate timestamp for 1 hour from now (using Node.js)
 * node -e "console.log(Math.floor(Date.now() / 1000) + 3600)"
 *
 * @example Calculate timestamp for a specific date (e.g., Jan 1, 2024 00:00:00 UTC)
 * node -e "console.log(Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000))"
 *
 * @example Disable cutoff (set to 0, relies on status only)
 * ts-node tools/booster/set-fight-boost-cutoff.ts --network testnet --eventId UFC_300 --fightId 1 --cutoff 0
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/set-fight-boost-cutoff.ts --network testnet --event UFC_300 --fight 1 --timestamp 1704067200
 *
 * @example With custom contract address
 * ts-node tools/booster/set-fight-boost-cutoff.ts --contract 0x123... --eventId UFC_300 --fightId 1 --cutoff 1704067200
 *
 * @example Skip confirmation prompt
 * ts-node tools/booster/set-fight-boost-cutoff.ts --network testnet --eventId UFC_300 --fightId 1 --cutoff 1704067200 --yes
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
  "function setFightBoostCutoff(string calldata eventId, uint256 fightId, uint256 cutoff) external",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupBoosterConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const fightId = BigInt(args.fightId ?? args.fight ?? 0);
  if (fightId <= 0n) throw new Error("--fightId (or --fight) must be > 0");

  const cutoff = args.cutoff || args.timestamp;
  if (!cutoff) throw new Error("Missing --cutoff (or --timestamp)");
  const cutoffBigInt = BigInt(cutoff);

  const booster = new ethers.Contract(config.contractAddress, ABI, config.wallet);

  // Build summary lines
  const summaryLines = [
    `Event ID: ${eventId}`,
    `Fight ID: ${fightId}`,
    `Cutoff timestamp: ${cutoffBigInt}`,
  ];
  if (cutoffBigInt === 0n) {
    summaryLines.push(`⚠️  Cutoff will be disabled (set to 0)`);
  } else {
    const cutoffDate = new Date(Number(cutoffBigInt) * 1000);
    summaryLines.push(`Cutoff date: ${cutoffDate.toISOString()}`);
  }

  // Display transaction summary
  displayTransactionSummary(config, summaryLines);

  // Request confirmation
  await requestConfirmation(args);

  console.log("\n🚀 Executing transaction...");
  const tx = await booster.setFightBoostCutoff(eventId, fightId, cutoffBigInt);
  await waitForTransaction(tx, config.chainId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

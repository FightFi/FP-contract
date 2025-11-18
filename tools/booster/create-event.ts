/**
 * @notice Script to create a new event with multiple fights in the Booster contract
 *
 * @example Using testnet
 * ts-node tools/booster/create-event.ts --network testnet --eventId 322 --numFights 10 --seasonId 322
 *
 * @example Using mainnet
 * ts-node tools/booster/create-event.ts --network mainnet --eventId 322 --numFights 10 --seasonId 322
 *
 * @example With custom contract address
 * ts-node tools/booster/create-event.ts --contract 0x123... --eventId 322 --numFights 10 --seasonId 322
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/create-event.ts --network testnet --event 322 --fights 10 --season 322
 * ts-node tools/booster/create-event.ts --network mainnet --event ufc-fight-night-nov-22-2025 --fights 10 --season 322
 *
 * @example Skip confirmation prompt
 * ts-node tools/booster/create-event.ts --network testnet --eventId 322 --numFights 10 --seasonId 322 --yes
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
  "function createEvent(string calldata eventId, uint256 numFights, uint256 seasonId) external",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupBoosterConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const numFights = BigInt(args.numFights ?? args.fights ?? 0);
  if (numFights <= 0n) throw new Error("--numFights (or --fights) must be > 0");

  const seasonId = BigInt(args.seasonId ?? args.season ?? 0);
  if (seasonId <= 0n) throw new Error("--seasonId (or --season) must be > 0");

  const booster = new ethers.Contract(config.contractAddress, ABI, config.wallet);

  // Display transaction summary
  displayTransactionSummary(config, [
    `Event ID: ${eventId}`,
    `Number of fights: ${numFights}`,
    `Season ID: ${seasonId}`,
  ]);

  // Request confirmation
  await requestConfirmation(args);

  console.log("\n🚀 Executing transaction...");
  const tx = await booster.createEvent(eventId, numFights, seasonId);
  await waitForTransaction(tx, config.chainId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

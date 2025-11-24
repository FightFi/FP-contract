/**
 * @notice Script to cancel fights in an event (no-contest scenario - full refunds)
 * 
 * This script cancels one or more fights by calling cancelFight.
 * When a fight is cancelled, users can claim full refunds of their principal.
 * 
 * @example Cancel a single fight
 * ts-node tools/booster/cancel-fight.ts --network testnet --eventId ufc-fight-night-nov-22-2025 --fightId 4
 * 
 * @example Cancel specific fights (1, 2, 3)
 * ts-node tools/booster/cancel-fight.ts --network testnet --eventId 322 --fights 1,2,3
 * 
 * @example Cancel all 10 fights of event 322
 * ts-node tools/booster/cancel-fight.ts --network testnet --eventId ufc-fight-night-nov-22-2025 --numFights 10
 * 
 * @example With mainnet
 * ts-node tools/booster/cancel-fight.ts --network mainnet --eventId 322 --fightId 5
 * 
 * @example With custom contract address
 * ts-node tools/booster/cancel-fight.ts --network testnet --contract 0x123... --eventId 322 --fightId 5
 * 
 * @example Skip confirmation prompt
 * ts-node tools/booster/cancel-fight.ts --network testnet --eventId 322 --fightId 5 --yes
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
  "function cancelFight(string calldata eventId, uint256 fightId) external",
];

function parseFightIds(args: Record<string, string>): bigint[] {
  // Option 1: Single fightId
  if (args.fightId || args.fight) {
    const fightId = BigInt(args.fightId || args.fight);
    if (fightId <= 0n) throw new Error("--fightId must be > 0");
    return [fightId];
  }

  // Option 2: Comma-separated list
  if (args.fights) {
    const fightIds = args.fights
      .split(",")
      .map((id) => id.trim())
      .map((id) => BigInt(id))
      .filter((id) => id > 0n);
    if (fightIds.length === 0) throw new Error("--fights must contain valid fight IDs");
    return fightIds;
  }

  // Option 3: numFights (cancel all fights from 1 to numFights)
  if (args.numFights) {
    const numFights = BigInt(args.numFights);
    if (numFights <= 0n) throw new Error("--numFights must be > 0");
    const fightIds: bigint[] = [];
    for (let i = 1n; i <= numFights; i++) {
      fightIds.push(i);
    }
    return fightIds;
  }

  throw new Error("Missing fight specification: use --fightId, --fights, or --numFights");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupBoosterConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const fightIds = parseFightIds(args);

  const booster = new ethers.Contract(config.contractAddress, ABI, config.wallet);

  // Display transaction summary
  displayTransactionSummary(config, [
    `Event ID: ${eventId}`,
    `Fight IDs: ${fightIds.join(", ")}`,
    `Total fights to cancel: ${fightIds.length}`,
    `Note: Cancelled fights enable full refunds of principal`,
  ], "cancelFight");

  // Request confirmation
  await requestConfirmation(args);

  // Cancel each fight sequentially
  console.log("\n🚀 Executing transactions...");
  for (let i = 0; i < fightIds.length; i++) {
    const fightId = fightIds[i];
    console.log(`\n[${i + 1}/${fightIds.length}] Cancelling fight ${fightId}...`);
    
    try {
      const tx = await booster.cancelFight(eventId, fightId);
      await waitForTransaction(tx, config.chainId);
    } catch (error: any) {
      console.error(`  ✗ Failed to cancel fight ${fightId}:`, error.message);
      // Continue with next fight even if one fails
    }
  }

  console.log(`\n✓ Finished cancelling ${fightIds.length} fight(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


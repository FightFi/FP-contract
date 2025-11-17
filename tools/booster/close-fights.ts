/**
 * @notice Script to close fights in an event (set status to CLOSED - no more boosts allowed)
 * 
 * This script closes one or more fights by setting their status to CLOSED.
 * When a fight is CLOSED, users cannot place new boosts or add to existing boosts.
 * 
 * @example Close all 10 fights of event 322
 * ts-node tools/booster/close-fights.ts --network testnet --eventId 322 --numFights 10
 * 
 * @example Close specific fights (1, 2, 3)
 * ts-node tools/booster/close-fights.ts --network testnet --eventId 322 --fights 1,2,3
 * 
 * @example Close a single fight
 * ts-node tools/booster/close-fights.ts --network testnet --eventId 322 --fightId 5
 * 
 * @example With mainnet
 * ts-node tools/booster/close-fights.ts --network mainnet --eventId 322 --numFights 10
 * 
 * @example With custom contract address
 * ts-node tools/booster/close-fights.ts --network testnet --contract 0x123... --eventId 322 --numFights 10
 */
import "dotenv/config";
import { ethers } from "ethers";

const ABI = [
  "function updateFightStatus(string calldata eventId, uint256 fightId, uint8 newStatus) external",
];

// FightStatus enum values
const FightStatus = {
  OPEN: 0,
  CLOSED: 1,
  RESOLVED: 2,
};

// Network name to environment variable mapping
const NETWORK_ENV_MAP: Record<string, string> = {
  testnet: "BSC_TESTNET_RPC_URL",
  mainnet: "BSC_RPC_URL",
};

function getRpcUrl(args: Record<string, string>): string {
  const networkName = args.network || args.net;
  if (!networkName) {
    throw new Error("Missing --network (required: testnet or mainnet)");
  }

  const envVar = NETWORK_ENV_MAP[networkName.toLowerCase()];
  if (!envVar) {
    throw new Error(
      `Unknown network "${networkName}". Supported: ${Object.keys(NETWORK_ENV_MAP).join(", ")}`
    );
  }

  const url = process.env[envVar];
  if (!url) {
    throw new Error(
      `Network "${networkName}" requires ${envVar} to be set in .env`
    );
  }

  return url;
}

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

  // Option 3: numFights (close all fights from 1 to numFights)
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
  const rpcUrl = getRpcUrl(args);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const pk = process.env.OPERATOR_PK || process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing OPERATOR_PK (or PRIVATE_KEY) in .env");
  const wallet = new ethers.Wallet(
    pk.startsWith("0x") ? pk : "0x" + pk,
    provider
  );

  const contract = args.contract || process.env.BOOSTER_ADDRESS;
  if (!contract)
    throw new Error("Missing contract (set --contract or BOOSTER_ADDRESS)");

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const fightIds = parseFightIds(args);

  const booster = new ethers.Contract(contract, ABI, wallet);
  
  console.log(
    `Closing ${fightIds.length} fight(s) in event: ${eventId}`
  );
  console.log(`Fight IDs: ${fightIds.join(", ")}`);
  console.log(`Status: CLOSED (${FightStatus.CLOSED})`);

  // Close each fight sequentially
  for (let i = 0; i < fightIds.length; i++) {
    const fightId = fightIds[i];
    console.log(`\n[${i + 1}/${fightIds.length}] Closing fight ${fightId}...`);
    
    try {
      const tx = await booster.updateFightStatus(eventId, fightId, FightStatus.CLOSED);
      console.log(`  Submitted tx: ${tx.hash}`);
      const rcpt = await tx.wait();
      console.log(`  ✓ Mined in block ${rcpt.blockNumber}`);
    } catch (error: any) {
      console.error(`  ✗ Failed to close fight ${fightId}:`, error.message);
      // Continue with next fight even if one fails
    }
  }

  console.log(`\n✓ Finished closing ${fightIds.length} fight(s)`);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      out[key] = val;
      i++;
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});







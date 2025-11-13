/**
 * @notice Script to create a new event with multiple fights in the Booster contract
 *
 * @example
 * ts-node tools/booster/create-event.ts --network testnet --eventId 322 --numFights 10 --seasonId 322
 *
 * @example With mainnet
 * ts-node tools/booster/create-event.ts --network mainnet --eventId 322 --numFights 10 --seasonId 322
 *
 * @example With custom contract address
 * ts-node tools/booster/create-event.ts --network testnet --contract 0x123... --eventId 322 --numFights 10 --seasonId 322
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/create-event.ts --network testnet --event 322 --fights 10 --season 322
 */
import "dotenv/config";
import { ethers } from "ethers";

const ABI = [
  "function createEvent(string calldata eventId, uint256 numFights, uint256 seasonId) external",
];

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

  const numFights = BigInt(args.numFights ?? args.fights ?? 0);
  if (numFights <= 0n) throw new Error("--numFights (or --fights) must be > 0");

  const seasonId = BigInt(args.seasonId ?? args.season ?? 0);
  if (seasonId <= 0n) throw new Error("--seasonId (or --season) must be > 0");

  const booster = new ethers.Contract(contract, ABI, wallet);
  console.log(
    `Creating event: ${eventId}, numFights: ${numFights}, seasonId: ${seasonId}`
  );
  const tx = await booster.createEvent(eventId, numFights, seasonId);
  console.log("Submitted createEvent tx:", tx.hash);
  const rcpt = await tx.wait();
  console.log("Mined in block", rcpt.blockNumber);
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

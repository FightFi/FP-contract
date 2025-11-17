/**
 * @notice Script to query quoteClaimable for a user's claimable amount in the Booster contract
 *
 * @example
 * ts-node tools/booster/quote-claimable.ts --network testnet --eventId 322 --fightId 1 --user 0x123...
 *
 * @example With mainnet
 * ts-node tools/booster/quote-claimable.ts --network mainnet --eventId 322 --fightId 1 --user 0x123...
 *
 * @example With custom contract address
 * ts-node tools/booster/quote-claimable.ts --network testnet --contract 0x123... --eventId 322 --fightId 1 --user 0x456...
 *
 * @example With enforceDeadline flag
 * ts-node tools/booster/quote-claimable.ts --network testnet --eventId 322 --fightId 1 --user 0x123... --enforceDeadline true
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/quote-claimable.ts --network testnet --event 322 --fight 1 --address 0xF362Fe668d93c43Be16716A73702333795Fbcea6
 */
import "dotenv/config";
import { ethers } from "ethers";

const ABI = [
  "function quoteClaimable(string calldata eventId, uint256 fightId, address user, bool enforceDeadline) external view returns (uint256 totalClaimable)",
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

  // For view functions, we don't need a wallet, but we can use a provider-only contract
  const contract = args.contract || process.env.BOOSTER_ADDRESS;
  if (!contract)
    throw new Error("Missing contract (set --contract or BOOSTER_ADDRESS)");

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const fightId = BigInt(args.fightId ?? args.fight ?? 0);
  if (fightId <= 0n) throw new Error("--fightId (or --fight) must be > 0");

  const user = args.user || args.address;
  if (!user) throw new Error("Missing --user (or --address)");
  
  // Validate address format
  if (!ethers.isAddress(user)) {
    throw new Error(`Invalid address format: ${user}`);
  }

  // Parse enforceDeadline flag (defaults to false)
  const enforceDeadline = args.enforceDeadline === "true" || args.enforceDeadline === "1";

  const booster = new ethers.Contract(contract, ABI, provider);
  
  console.log("Querying quoteClaimable...");
  console.log(`  Event ID: ${eventId}`);
  console.log(`  Fight ID: ${fightId}`);
  console.log(`  User: ${user}`);
  console.log(`  Enforce Deadline: ${enforceDeadline}`);
  console.log(`  Contract: ${contract}`);
  
    try {
    const totalClaimable = await booster.quoteClaimable(
      eventId,
      fightId,
      user,
      enforceDeadline
    );
    
    console.log("\n✅ Result:");
    console.log(`  Total Claimable: ${totalClaimable.toString()} FP units`);
  } catch (error: any) {
    console.error("\n❌ Error calling quoteClaimable:");
    if (error.reason) {
      console.error(`  Reason: ${error.reason}`);
    }
    if (error.message) {
      console.error(`  Message: ${error.message}`);
    }
    throw error;
  }
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


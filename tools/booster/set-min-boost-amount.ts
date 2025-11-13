/**
 * @notice Script to set the minimum boost amount in the Booster contract
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
 * ts-node tools/booster/set-min-boost-amount.ts --network testnet --contract 0x123... --amount 1000000000000000000
 */
import "dotenv/config";
import { ethers } from "ethers";

const ABI = ["function setMinBoostAmount(uint256 newMin) external"];

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

  const newMin = args.amount || args.min;
  if (!newMin) throw new Error("Missing --amount (or --min)");
  const newMinBigInt = BigInt(newMin);

  const booster = new ethers.Contract(contract, ABI, wallet);
  console.log(`Setting min boost amount to: ${newMinBigInt}`);
  const tx = await booster.setMinBoostAmount(newMinBigInt);
  console.log("Submitted setMinBoostAmount tx:", tx.hash);
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

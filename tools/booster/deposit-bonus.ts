/**
 * @notice Script to deposit bonus FP tokens to a fight's prize pool
 *
 * @example Deposit 5 FP (5e18 wei) as bonus for fight 1
 * ts-node tools/booster/deposit-bonus.ts --network testnet --eventId UFC_300 --fightId 1 --amount 5000000000000000000
 *
 * @example Deposit 10 FP for fight 3
 * ts-node tools/booster/deposit-bonus.ts --network testnet --eventId UFC_300 --fightId 3 --amount 10000000000000000000
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/deposit-bonus.ts --network testnet --event UFC_300 --fight 1 --amount 5000000000000000000
 *
 * @example With custom contract address
 * ts-node tools/booster/deposit-bonus.ts --network testnet --contract 0x123... --eventId UFC_300 --fightId 1 --amount 5000000000000000000
 */
import "dotenv/config";
import { ethers } from "ethers";

const ABI = [
  "function depositBonus(string calldata eventId, uint256 fightId, uint256 amount) external",
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

  const fightId = BigInt(args.fightId ?? args.fight ?? 0);
  if (fightId <= 0n) throw new Error("--fightId (or --fight) must be > 0");

  const amount = args.amount;
  if (!amount) throw new Error("Missing --amount");
  const amountBigInt = BigInt(amount);
  if (amountBigInt <= 0n) throw new Error("--amount must be > 0");

  const booster = new ethers.Contract(contract, ABI, wallet);
  console.log(
    `Depositing bonus: ${amountBigInt} FP for event: ${eventId}, fightId: ${fightId}`
  );
  const tx = await booster.depositBonus(eventId, fightId, amountBigInt);
  console.log("Submitted depositBonus tx:", tx.hash);
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

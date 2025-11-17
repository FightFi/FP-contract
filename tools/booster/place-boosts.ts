/**
 * @notice Script to place boosts in the Booster contract
 *
 * @example Single boost
 * ts-node tools/booster/place-boosts.ts --network testnet --eventId 322 --fightId 1 --amount 100 --winner RED --method KNOCKOUT
 *
 * @example Multiple boosts (JSON format)
 * ts-node tools/booster/place-boosts.ts --network testnet --eventId 322 --boosts '[{"fightId":1,"amount":100,"winner":"RED","method":"KNOCKOUT"},{"fightId":2,"amount":200,"winner":"BLUE","method":"DECISION"}]'
 *
 * @example With mainnet
 * ts-node tools/booster/place-boosts.ts --network mainnet --eventId 322 --fightId 1 --amount 100 --winner RED --method KNOCKOUT
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/place-boosts.ts --network testnet --event 322 --fight 1 --amt 100 --winner RED --method KNOCKOUT
 *
 * @example Simulate without sending transaction
 * ts-node tools/booster/place-boosts.ts --network testnet --eventId 322 --fightId 1 --amount 100 --winner RED --method KNOCKOUT --simulate
 */
import "dotenv/config";
import { ethers } from "ethers";

// Corner enum: RED=0, BLUE=1, NONE=2
const CORNER_MAP: Record<string, number> = {
  RED: 0,
  BLUE: 1,
  NONE: 2,
};

// WinMethod enum: KNOCKOUT=0, SUBMISSION=1, DECISION=2, NO_CONTEST=3
const METHOD_MAP: Record<string, number> = {
  KNOCKOUT: 0,
  SUBMISSION: 1,
  DECISION: 2,
  NO_CONTEST: 3,
};

const ABI = [
  "function placeBoosts(string calldata eventId, tuple(uint256 fightId, uint256 amount, uint8 predictedWinner, uint8 predictedMethod)[] calldata inputs) external",
];

// Network name to environment variable mapping
const NETWORK_ENV_MAP: Record<string, string> = {
  testnet: "BSC_TESTNET_RPC_URL",
  mainnet: "BSC_RPC_URL",
};

interface BoostInput {
  fightId: number;
  amount: string;
  winner: string;
  method: string;
}

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

function parseBoostInput(input: BoostInput) {
  const winner = CORNER_MAP[input.winner.toUpperCase()];
  if (winner === undefined) {
    throw new Error(
      `Invalid winner "${input.winner}". Must be one of: ${Object.keys(CORNER_MAP).join(", ")}`
    );
  }

  const method = METHOD_MAP[input.method.toUpperCase()];
  if (method === undefined) {
    throw new Error(
      `Invalid method "${input.method}". Must be one of: ${Object.keys(METHOD_MAP).join(", ")}`
    );
  }

  return {
    fightId: BigInt(input.fightId),
    amount: BigInt(input.amount),
    predictedWinner: winner,
    predictedMethod: method,
  };
}

function parseBoosts(args: Record<string, string>): Array<{
  fightId: bigint;
  amount: bigint;
  predictedWinner: number;
  predictedMethod: number;
}> {
  // If --boosts is provided, parse JSON array
  if (args.boosts) {
    try {
      const boostsJson: BoostInput[] = JSON.parse(args.boosts);
      return boostsJson.map(parseBoostInput);
    } catch (e) {
      throw new Error(`Failed to parse --boosts JSON: ${e}`);
    }
  }

  // Otherwise, parse single boost from individual args
  const fightId = args.fightId || args.fight;
  if (!fightId) throw new Error("Missing --fightId (or --fight)");

  const amount = args.amount || args.amt;
  if (!amount) throw new Error("Missing --amount (or --amt)");

  const winner = args.winner || args.w;
  if (!winner) throw new Error("Missing --winner (or --w)");

  const method = args.method || args.m;
  if (!method) throw new Error("Missing --method (or --m)");

  return [parseBoostInput({ fightId: parseInt(fightId), amount, winner, method })];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl = getRpcUrl(args);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const pk = process.env.USER_PK || process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing USER_PK (or PRIVATE_KEY) in .env");
  const wallet = new ethers.Wallet(
    pk.startsWith("0x") ? pk : "0x" + pk,
    provider
  );

  const contract = args.contract || process.env.BOOSTER_ADDRESS;
  if (!contract)
    throw new Error("Missing contract (set --contract or BOOSTER_ADDRESS)");

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const boosts = parseBoosts(args);
  if (boosts.length === 0) {
    throw new Error("No boosts provided");
  }

  const booster = new ethers.Contract(contract, ABI, wallet);

  // Format boosts for contract call
  const formattedBoosts = boosts.map((b) => [
    b.fightId,
    b.amount,
    b.predictedWinner,
    b.predictedMethod,
  ]);

  console.log(`Placing ${boosts.length} boost(s) for event: ${eventId}`);
  boosts.forEach((b, i) => {
    const winnerName = Object.keys(CORNER_MAP).find(
      (k) => CORNER_MAP[k] === b.predictedWinner
    );
    const methodName = Object.keys(METHOD_MAP).find(
      (k) => METHOD_MAP[k] === b.predictedMethod
    );
    console.log(
      `  Boost ${i + 1}: Fight ${b.fightId}, Amount: ${b.amount}, Winner: ${winnerName}, Method: ${methodName}`
    );
  });

  const totalAmount = boosts.reduce((sum, b) => sum + b.amount, 0n);
  console.log(`Total amount: ${totalAmount}`);

  const simulate = args.simulate || args.dryRun || args.sim;
  if (simulate) {
    console.log("\n🔍 SIMULATION MODE - No transaction will be sent\n");
    try {
      // Simulate the transaction using callStatic
      await booster.placeBoosts.staticCall(eventId, formattedBoosts);
      console.log("✅ Simulation successful! Transaction would succeed.");
      
      // Estimate gas
      const gasEstimate = await booster.placeBoosts.estimateGas(eventId, formattedBoosts);
      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      
      // Get current gas price
      const feeData = await provider.getFeeData();
      if (feeData.gasPrice) {
        const gasCost = gasEstimate * feeData.gasPrice;
        console.log(`💰 Estimated cost: ${ethers.formatEther(gasCost)} BNB`);
      }
    } catch (error: any) {
      console.error("❌ Simulation failed!");
      if (error.reason) {
        console.error(`Reason: ${error.reason}`);
      } else if (error.message) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error(error);
      }
      process.exit(1);
    }
  } else {
    const tx = await booster.placeBoosts(eventId, formattedBoosts);
    console.log("Submitted placeBoosts tx:", tx.hash);
    const rcpt = await tx.wait();
    console.log("Mined in block", rcpt.blockNumber);
  }
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      // Handle boolean flags (like --simulate, --dry-run)
      if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
        out[key] = "true";
      } else {
        const val = argv[i + 1];
        out[key] = val;
        i++;
      }
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


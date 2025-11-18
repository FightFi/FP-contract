/**
 * @notice Common utilities for Booster contract scripts
 */
import "dotenv/config";
import { ethers } from "ethers";
import * as readline from "readline";

export type NetworkMode = "testnet" | "mainnet";

export interface ScriptArgs {
  [key: string]: string;
}

export interface BoosterConfig {
  networkMode: NetworkMode;
  rpcUrl: string;
  contractAddress: string;
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet;
  chainId: number;
}

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      // Handle flags without values (e.g., --yes)
      if (val && !val.startsWith("--")) {
        out[key] = val;
        i++;
      } else {
        // Flag without value, set to "true"
        out[key] = "true";
      }
    }
  }
  return out;
}

/**
 * Determine network mode from arguments
 * Defaults to testnet if not specified
 */
export function getNetworkMode(args: ScriptArgs): NetworkMode {
  const networkArg = args.network?.toLowerCase();
  
  if (networkArg === "mainnet") {
    return "mainnet";
  } else if (networkArg === "testnet") {
    return "testnet";
  } else if (networkArg) {
    throw new Error(`Invalid network: ${networkArg}. Must be "testnet" or "mainnet"`);
  } else {
    // Default to testnet
    return "testnet";
  }
}

/**
 * Get RPC URL based on network mode
 */
export function getRpcUrl(networkMode: NetworkMode, customRpc?: string): string {
  if (customRpc) {
    return customRpc;
  }
  
  if (networkMode === "testnet") {
    return process.env.TESTNET_BSC_RPC_URL || "";
  } else {
    return process.env.MAINNET_BSC_RPC_URL || "";
  }
}

/**
 * Get contract address based on network mode
 */
export function getContractAddress(
  networkMode: NetworkMode,
  customAddress?: string
): string {
  if (customAddress) {
    return customAddress;
  }
  
  if (networkMode === "testnet") {
    return (
      process.env.TESTNET_BOOSTER_ADDRESS || process.env.BOOSTER_ADDRESS || ""
    );
  } else {
    return (
      process.env.MAINNET_BOOSTER_ADDRESS || process.env.BOOSTER_ADDRESS || ""
    );
  }
}

/**
 * Setup provider and wallet from environment variables
 */
export function setupProviderAndWallet(
  rpcUrl: string
): { provider: ethers.JsonRpcProvider; wallet: ethers.Wallet } {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const pk = process.env.OPERATOR_PK || process.env.PRIVATE_KEY;
  if (!pk) {
    throw new Error("Missing OPERATOR_PK (or PRIVATE_KEY) in .env");
  }

  const wallet = new ethers.Wallet(
    pk.startsWith("0x") ? pk : "0x" + pk,
    provider
  );

  return { provider, wallet };
}

/**
 * Get block explorer URL for a transaction
 */
export function getExplorerUrl(chainId: number, txHash: string): string | null {
  let baseUrl: string | undefined;

  // Get explorer URL from environment variables
  if (chainId === 56) {
    // BSC Mainnet
    baseUrl = process.env.MAINNET_BSC_EXPLORER_URL || "https://bscscan.com";
  } else if (chainId === 97) {
    // BSC Testnet
    baseUrl =
      process.env.TESTNET_BSC_EXPLORER_URL || "https://testnet.bscscan.com";
  }

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Ask user for confirmation
 */
export function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

/**
 * Setup complete Booster configuration from command line arguments
 */
export async function setupBoosterConfig(
  args: ScriptArgs
): Promise<BoosterConfig> {
  const networkMode = getNetworkMode(args);

  const rpcUrl = getRpcUrl(networkMode, args.rpc);
  if (!rpcUrl) {
    throw new Error(
      `Missing RPC URL. Set --rpc or configure in .env:\n` +
        `  - For testnet: TESTNET_BSC_RPC_URL\n` +
        `  - For mainnet: MAINNET_BSC_RPC_URL\n` +
        `  - Or use --network testnet/mainnet`
    );
  }

  const contractAddress = getContractAddress(networkMode, args.contract);
  if (!contractAddress) {
    throw new Error(
      `Missing contract address. Set --contract or configure in .env:\n` +
        `  - For testnet: TESTNET_BOOSTER_ADDRESS\n` +
        `  - For mainnet: MAINNET_BOOSTER_ADDRESS\n` +
        `  - Or generic: BOOSTER_ADDRESS`
    );
  }

  const { provider, wallet } = setupProviderAndWallet(rpcUrl);

  // Get network info to determine chain ID
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  return {
    networkMode,
    rpcUrl,
    contractAddress,
    provider,
    wallet,
    chainId,
  };
}

/**
 * Display transaction summary before execution
 */
export function displayTransactionSummary(
  config: BoosterConfig,
  summaryLines: string[],
  functionName?: string
): void {
  console.log("\n📋 Transaction Summary:");
  console.log(`  Network: ${config.networkMode.toUpperCase()}`);
  console.log(`  Contract: ${config.contractAddress}`);
  if (functionName) {
    console.log(`  Function: ${functionName}`);
  }
  summaryLines.forEach((line) => console.log(`  ${line}`));
}

/**
 * Request user confirmation before executing transaction
 */
export async function requestConfirmation(
  args: ScriptArgs
): Promise<boolean> {
  if (args.yes) {
    return true;
  }

  const confirmed = await askConfirmation(
    "\n❓ Do you want to proceed? (yes/no): "
  );
  if (!confirmed) {
    console.log("❌ Transaction cancelled by user.");
    process.exit(0);
  }
  return true;
}

/**
 * Wait for transaction and display results
 */
export async function waitForTransaction(
  tx: ethers.ContractTransactionResponse,
  chainId: number
): Promise<ethers.TransactionReceipt> {
  console.log("\n✅ Transaction submitted!");
  console.log(`Transaction hash: ${tx.hash}`);

  console.log("\n⏳ Waiting for transaction to be mined...");
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  console.log(`✅ Transaction mined in block ${receipt.blockNumber}`);

  // Display block explorer link after confirmation
  const explorerUrl = getExplorerUrl(chainId, tx.hash);
  if (explorerUrl) {
    console.log(`View on block explorer: ${explorerUrl}`);
  } else {
    console.log(`⚠️  Block explorer not configured for chain ID ${chainId}`);
  }

  return receipt;
}


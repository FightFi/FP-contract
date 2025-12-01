/**
 * @notice Script to transfer BNB from operator wallet to a recipient address
 *
 * @example Using testnet with default amount (0.02 BNB)
 * ts-node tools/booster/transfer-bnb.ts --network testnet --to 0x91341dbc9f531fedcf790b7cae85f997a8e1e9d4
 *
 * @example Using mainnet with custom amount
 * ts-node tools/booster/transfer-bnb.ts --network mainnet --to 0x91341dbc9f531fedcf790b7cae85f997a8e1e9d4 --amount 0.02
 *
 * @example Using custom RPC URL
 * ts-node tools/booster/transfer-bnb.ts --rpc https://bsc-dataseed.binance.org --to 0x91341dbc9f531fedcf790b7cae85f997a8e1e9d4
 *
 * @example Skip confirmation prompt
 * ts-node tools/booster/transfer-bnb.ts --network testnet --to 0x91341dbc9f531fedcf790b7cae85f997a8e1e9d4 --yes
 */
import "dotenv/config";
import { ethers } from "ethers";
import {
  parseArgs,
  getNetworkMode,
  getRpcUrl,
  setupProviderAndWallet,
  displayTransactionSummary,
  requestConfirmation,
  waitForTransaction,
  getExplorerUrl,
} from "./booster.utils";

interface TransferConfig {
  networkMode: "testnet" | "mainnet";
  rpcUrl: string;
  provider: ethers.JsonRpcProvider;
  wallet: ethers.Wallet;
  chainId: number;
  toAddress: string;
  amount: bigint;
}

async function setupTransferConfig(args: any): Promise<TransferConfig> {
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

  const { provider, wallet } = setupProviderAndWallet(rpcUrl);

  // Get network info to determine chain ID
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  // Validate recipient address
  const toAddress = args.to || args.recipient;
  if (!toAddress) {
    throw new Error("Missing --to (or --recipient) address");
  }
  if (!ethers.isAddress(toAddress)) {
    throw new Error(`Invalid recipient address: ${toAddress}`);
  }

  // Parse amount (default: 0.02 BNB)
  const amountStr = args.amount || args.value || "0.02";
  const amount = ethers.parseEther(amountStr);

  if (amount <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  return {
    networkMode,
    rpcUrl,
    provider,
    wallet,
    chainId,
    toAddress,
    amount,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupTransferConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  // Check balances before transfer
  const [fromBalance, toBalance] = await Promise.all([
    config.provider.getBalance(config.wallet.address),
    config.provider.getBalance(config.toAddress),
  ]);
  
  const fromBalanceInBnb = ethers.formatEther(fromBalance);
  const toBalanceInBnb = ethers.formatEther(toBalance);
  const amountInBnb = ethers.formatEther(config.amount);

  console.log(`\n💰 Account Balances (Before):`);
  console.log(`  From (${config.wallet.address}): ${fromBalanceInBnb} BNB`);
  console.log(`  To (${config.toAddress}): ${toBalanceInBnb} BNB`);
  console.log(`\n📤 Transfer amount: ${amountInBnb} BNB`);

  // Estimate gas cost
  const gasPrice = await config.provider.getFeeData();
  const estimatedGas = 21000n; // Standard ETH transfer gas limit
  const gasCost = (gasPrice.gasPrice || 0n) * estimatedGas;
  const gasCostInBnb = ethers.formatEther(gasCost);
  const totalCost = config.amount + gasCost;
  const totalCostInBnb = ethers.formatEther(totalCost);

  console.log(`⛽ Estimated gas cost: ${gasCostInBnb} BNB`);
  console.log(`💸 Total cost: ${totalCostInBnb} BNB`);

  if (fromBalance < totalCost) {
    throw new Error(
      `Insufficient balance. Need ${totalCostInBnb} BNB but have ${fromBalanceInBnb} BNB`
    );
  }

  // Build summary lines
  const summaryLines = [
    `From: ${config.wallet.address}`,
    `To: ${config.toAddress}`,
    `Amount: ${amountInBnb} BNB`,
    `Gas cost: ~${gasCostInBnb} BNB`,
  ];

  // Display transaction summary
  displayTransactionSummary(config, summaryLines, "transfer");

  // Request confirmation
  await requestConfirmation(args);

  console.log("\n🚀 Executing transaction...");
  const tx = await config.wallet.sendTransaction({
    to: config.toAddress,
    value: config.amount,
  });

  await waitForTransaction(tx, config.chainId);

  // Show final balances
  const [finalFromBalance, finalToBalance] = await Promise.all([
    config.provider.getBalance(config.wallet.address),
    config.provider.getBalance(config.toAddress),
  ]);
  
  const finalFromBalanceInBnb = ethers.formatEther(finalFromBalance);
  const finalToBalanceInBnb = ethers.formatEther(finalToBalance);
  
  console.log(`\n💰 Account Balances (After):`);
  console.log(`  From (${config.wallet.address}): ${finalFromBalanceInBnb} BNB`);
  console.log(`  To (${config.toAddress}): ${finalToBalanceInBnb} BNB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


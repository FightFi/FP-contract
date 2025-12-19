/**
 * @notice Script to draw the winner for a DailyLottery round
 *
 * @example Draw winner with FP prize
 * ts-node tools/lottery/draw-winner.ts --dayId 20440 --winningIndex 0 --prizeType FP --prizeSeasonId 323 --prizeAmount 1000
 *
 * @example Draw winner with ERC20 prize (USDT)
 * ts-node tools/lottery/draw-winner.ts --dayId 20440 --winningIndex 2 --prizeType ERC20 --prizeToken 0x123... --prizeAmount 1000000
 *
 * @example With custom contract address
 * ts-node tools/lottery/draw-winner.ts --contract 0x123... --dayId 20440 --winningIndex 0 --prizeType FP --prizeSeasonId 323 --prizeAmount 1000
 */
import "dotenv/config";
import { ethers } from "ethers";

const ABI = [
  "function drawWinner(uint256 dayId, uint256 winningIndex, tuple(uint8 prizeType, address tokenAddress, uint256 seasonId, uint256 amount) prize) external",
  "function getCurrentDayId() external view returns (uint256)",
  "function getLotteryRound(uint256 dayId) external view returns (tuple(uint256 dayId, uint256 seasonId, uint256 entryPrice, uint256 maxEntriesPerUser, uint256 totalEntries, uint256 totalPaid, address winner, bool finalized, uint8 prizeType, address prizeTokenAddress, uint256 prizeSeasonId, uint256 prizeAmount))",
  "function getEntries(uint256 dayId) external view returns (address[])",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)",
];

const FP1155_ABI = [
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) external view returns (bool)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
];

enum PrizeType {
  FP = 0,
  ERC20 = 1,
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rpcUrl =
    args.rpc ||
    process.env.TESTNET_BSC_RPC_URL ||
    process.env.RPC_URL ||
    process.env.BSC_TESTNET_RPC_URL ||
    process.env.BSC_RPC_URL;
  if (!rpcUrl) {
    console.error("❌ Missing RPC URL");
    console.error("\nOptions:");
    console.error("  1. Pass as argument: --rpc <URL>");
    console.error(
      "  2. Set in .env file: TESTNET_BSC_RPC_URL, RPC_URL, BSC_TESTNET_RPC_URL, or BSC_RPC_URL"
    );
    console.error("\nExample:");
    console.error(
      "  ts-node tools/lottery/draw-winner.ts --rpc https://bsc-testnet.publicnode.com"
    );
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("Missing PRIVATE_KEY in .env");
  const wallet = new ethers.Wallet(
    pk.startsWith("0x") ? pk : "0x" + pk,
    provider
  );

  const contract = args.contract || process.env.LOTTERY_ADDRESS;
  if (!contract)
    throw new Error("Missing contract (set --contract or LOTTERY_ADDRESS)");

  const lottery = new ethers.Contract(contract, ABI, wallet);

  // Parse arguments
  const dayId = args.dayId ? BigInt(args.dayId) : await lottery.getCurrentDayId();
  const winningIndex = BigInt(args.winningIndex ?? args.index ?? 0);

  const prizeTypeStr = args.prizeType?.toUpperCase() || "FP";
  const prizeType = prizeTypeStr === "FP" ? PrizeType.FP : PrizeType.ERC20;

  let prizeTokenAddress = args.prizeToken || "0x0000000000000000000000000000000000000000";
  let prizeSeasonId = BigInt(args.prizeSeasonId ?? args.season ?? 0);
  let prizeAmount = BigInt(args.prizeAmount ?? args.amount ?? 0);

  if (prizeAmount === 0n) {
    throw new Error("Missing --prizeAmount (or --amount)");
  }

  if (prizeType === PrizeType.ERC20 && prizeTokenAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Missing --prizeToken for ERC20 prize");
  }

  if (prizeType === PrizeType.FP && prizeSeasonId === 0n) {
    throw new Error("Missing --prizeSeasonId (or --season) for FP prize");
  }

  console.log("=== Drawing Lottery Winner ===");
  console.log(`Lottery Address: ${contract}`);
  console.log(`Admin: ${wallet.address}`);
  console.log(`Day ID: ${dayId}`);
  console.log(`Winning Index: ${winningIndex}`);

  // Get round info
  const round = await lottery.getLotteryRound(dayId);

  if (round.dayId === 0n) {
    throw new Error(`Round for day ${dayId} doesn't exist yet`);
  }

  if (round.finalized) {
    throw new Error(`Round for day ${dayId} is already finalized. Winner: ${round.winner}`);
  }

  if (round.totalEntries === 0n) {
    throw new Error(`Round for day ${dayId} has no entries`);
  }

  if (winningIndex >= round.totalEntries) {
    throw new Error(
      `Invalid winning index ${winningIndex}. Total entries: ${round.totalEntries} (valid: 0-${Number(round.totalEntries) - 1})`
    );
  }

  console.log(`\nTotal Entries: ${round.totalEntries}`);

  // Get entries to show who the winner will be
  const entries = await lottery.getEntries(dayId);
  const winner = entries[Number(winningIndex)];
  console.log(`Winner will be: ${winner}`);

  // Prize info
  console.log("\n=== Prize Configuration ===");
  console.log(`Prize Type: ${prizeTypeStr}`);
  if (prizeType === PrizeType.FP) {
    console.log(`Prize Season ID: ${prizeSeasonId}`);
    const fpToken = new ethers.Contract(
      process.env.FP_TOKEN_ADDRESS || "0xb3a5bCbE34fe7Ff56A7d6E0d1fC683A130eBDA41",
      FP1155_ABI,
      wallet
    );
    
    // Check admin balance
    const adminBalance = await fpToken.balanceOf(wallet.address, prizeSeasonId);
    console.log(`Admin FP Balance (Season ${prizeSeasonId}): ${adminBalance}`);
    
    if (adminBalance < prizeAmount) {
      throw new Error(`Insufficient FP balance. Have: ${adminBalance}, Need: ${prizeAmount}`);
    }
    
    // Check approval
    const isApproved = await fpToken.isApprovedForAll(wallet.address, contract);
    if (!isApproved) {
      console.log("\n⚠️  Admin needs to approve lottery contract first:");
      console.log(`   fpToken.setApprovalForAll("${contract}", true)`);
      throw new Error("Admin approval required");
    }
  } else {
    console.log(`Prize Token: ${prizeTokenAddress}`);
    const token = new ethers.Contract(prizeTokenAddress, ERC20_ABI, wallet);
    
    // Check admin balance
    const adminBalance = await token.balanceOf(wallet.address);
    const symbol = await token.symbol();
    console.log(`Admin ${symbol} Balance: ${adminBalance}`);
    
    if (adminBalance < prizeAmount) {
      throw new Error(`Insufficient ${symbol} balance. Have: ${adminBalance}, Need: ${prizeAmount}`);
    }
    
    // Check approval (we'll approve if needed)
    console.log("\nApproving ERC20 token for lottery...");
    const approveTx = await token.approve(contract, prizeAmount);
    console.log(`Approve tx: ${approveTx.hash}`);
    await approveTx.wait();
    console.log("Approved");
  }

  console.log(`Prize Amount: ${prizeAmount}`);

  // Prepare prize data
  const prize = {
    prizeType: prizeType,
    tokenAddress: prizeTokenAddress,
    seasonId: prizeSeasonId,
    amount: prizeAmount,
  };

  console.log("\n=== Drawing Winner ===");
  const tx = await lottery.drawWinner(dayId, winningIndex, prize);
  console.log("Submitted drawWinner tx:", tx.hash);

  const rcpt = await tx.wait();
  console.log("Mined in block", rcpt.blockNumber);

  // Get updated round info
  const roundAfter = await lottery.getLotteryRound(dayId);

  console.log("\n=== Winner Drawn ===");
  console.log(`Winner: ${roundAfter.winner}`);
  console.log(`Finalized: ${roundAfter.finalized}`);
  console.log(`Prize Type: ${prizeTypeStr}`);
  console.log(`Prize Amount: ${roundAfter.prizeAmount}`);
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


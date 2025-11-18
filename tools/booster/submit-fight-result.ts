/**
 * @notice Script to submit fight result with calculated points and shares
 *
 * @example Using testnet
 * ts-node tools/booster/submit-fight-result.ts --network testnet \
 *   --eventId UFC_300 \
 *   --fightId 1 \
 *   --winner RED \
 *   --method KNOCKOUT \
 *   --pointsForWinner 10 \
 *   --pointsForWinnerMethod 20 \
 *   --sumWinnersStakes 10000000000000000000 \
 *   --winningPoolTotalShares 200000000000000000000
 *
 * @example Using mainnet
 * ts-node tools/booster/submit-fight-result.ts --network mainnet \
 *   --eventId UFC_300 \
 *   --fightId 1 \
 *   --winner RED \
 *   --method KNOCKOUT \
 *   --pointsForWinner 10 \
 *   --pointsForWinnerMethod 20 \
 *   --sumWinnersStakes 10000000000000000000 \
 *   --winningPoolTotalShares 200000000000000000000
 *
 * @example Submit result: RED corner wins by KNOCKOUT
 * ts-node tools/booster/submit-fight-result.ts --network testnet \
 *   --eventId UFC_300 \
 *   --fightId 1 \
 *   --winner RED \
 *   --method KNOCKOUT \
 *   --pointsForWinner 10 \
 *   --pointsForWinnerMethod 20 \
 *   --sumWinnersStakes 10000000000000000000 \
 *   --winningPoolTotalShares 200000000000000000000
 *
 * @example Submit result: BLUE corner wins by DECISION
 * ts-node tools/booster/submit-fight-result.ts --network testnet \
 *   --eventId UFC_300 \
 *   --fightId 2 \
 *   --winner BLUE \
 *   --method DECISION \
 *   --pointsForWinner 10 \
 *   --pointsForWinnerMethod 15 \
 *   --sumWinnersStakes 5000000000000000000 \
 *   --winningPoolTotalShares 75000000000000000000
 *
 * @example Using numeric values for winner and method
 * ts-node tools/booster/submit-fight-result.ts --network testnet \
 *   --eventId UFC_300 \
 *   --fightId 1 \
 *   --winner 0 \
 *   --method 0 \
 *   --pointsForWinner 10 \
 *   --pointsForWinnerMethod 20 \
 *   --sumWinnersStakes 10000000000000000000 \
 *   --winningPoolTotalShares 200000000000000000000
 *
 * @example Using alternative parameter names
 * ts-node tools/booster/submit-fight-result.ts --network testnet \
 *   --event UFC_300 \
 *   --fight 1 \
 *   --winner RED \
 *   --method KO \
 *   --pointsWinner 10 \
 *   --pointsMethod 20 \
 *   --sumStakes 10000000000000000000 \
 *   --totalShares 200000000000000000000
 *
 * @example Skip confirmation prompt
 * ts-node tools/booster/submit-fight-result.ts --network testnet --eventId UFC_300 --fightId 1 --winner RED --method KNOCKOUT --pointsForWinner 10 --pointsForWinnerMethod 20 --sumWinnersStakes 10000000000000000000 --winningPoolTotalShares 200000000000000000000 --yes
 *
 * Winner values: RED (0), BLUE (1), NONE (2)
 * Method values: KNOCKOUT/KO (0), SUBMISSION/SUB (1), DECISION/DEC (2), NO_CONTEST (3)
 *
 * @env MAINNET_BSC_EXPLORER_URL - Block explorer URL for BSC Mainnet (default: https://bscscan.com)
 * @env TESTNET_BSC_EXPLORER_URL - Block explorer URL for BSC Testnet (default: https://testnet.bscscan.com)
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

// Corner enum: RED=0, BLUE=1, NONE=2
// WinMethod enum: KNOCKOUT=0, SUBMISSION=1, DECISION=2, NO_CONTEST=3
const ABI = [
  "function submitFightResult(string calldata eventId, uint256 fightId, uint8 winner, uint8 method, uint256 pointsForWinner, uint256 pointsForWinnerMethod, uint256 sumWinnersStakes, uint256 winningPoolTotalShares) external",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await setupBoosterConfig(args);

  // Log network mode for clarity
  console.log(`Network mode: ${config.networkMode.toUpperCase()}`);

  const eventId = args.eventId || args.event;
  if (!eventId) throw new Error("Missing --eventId (or --event)");

  const fightId = BigInt(args.fightId ?? args.fight ?? 0);
  if (fightId <= 0n) throw new Error("--fightId (or --fight) must be > 0");

  // Parse winner: RED=0, BLUE=1, NONE=2
  const winnerStr = (args.winner || "").toUpperCase();
  let winner: number;
  if (winnerStr === "RED" || winnerStr === "0") winner = 0;
  else if (winnerStr === "BLUE" || winnerStr === "1") winner = 1;
  else if (winnerStr === "NONE" || winnerStr === "2") winner = 2;
  else throw new Error("--winner must be RED (0), BLUE (1), or NONE (2)");

  // Parse method: KNOCKOUT=0, SUBMISSION=1, DECISION=2, NO_CONTEST=3
  const methodStr = (args.method || "").toUpperCase();
  let method: number;
  if (methodStr === "KNOCKOUT" || methodStr === "KO" || methodStr === "0")
    method = 0;
  else if (
    methodStr === "SUBMISSION" ||
    methodStr === "SUB" ||
    methodStr === "1"
  )
    method = 1;
  else if (methodStr === "DECISION" || methodStr === "DEC" || methodStr === "2")
    method = 2;
  else if (methodStr === "NO_CONTEST" || methodStr === "3") method = 3;
  else
    throw new Error(
      "--method must be KNOCKOUT (0), SUBMISSION (1), DECISION (2), or NO_CONTEST (3)"
    );

  const pointsForWinner = BigInt(
    args.pointsForWinner ?? args.pointsWinner ?? 0
  );
  if (pointsForWinner <= 0n)
    throw new Error("--pointsForWinner (or --pointsWinner) must be > 0");

  const pointsForWinnerMethod = BigInt(
    args.pointsForWinnerMethod ?? args.pointsMethod ?? 0
  );
  if (pointsForWinnerMethod < pointsForWinner) {
    throw new Error(
      "--pointsForWinnerMethod (or --pointsMethod) must be >= pointsForWinner"
    );
  }

  const sumWinnersStakes = BigInt(args.sumWinnersStakes ?? args.sumStakes ?? 0);
  if (sumWinnersStakes < 0n)
    throw new Error("--sumWinnersStakes (or --sumStakes) must be >= 0");

  const winningPoolTotalShares = BigInt(
    args.winningPoolTotalShares ?? args.totalShares ?? 0
  );
  if (winningPoolTotalShares <= 0n)
    throw new Error("--winningPoolTotalShares (or --totalShares) must be > 0");

  const booster = new ethers.Contract(config.contractAddress, ABI, config.wallet);

  // Display transaction summary
  displayTransactionSummary(config, [
    `Event: ${eventId}`,
    `FightId: ${fightId}`,
    `Winner: ${winner} (${winnerStr})`,
    `Method: ${method} (${methodStr})`,
    `Points for winner: ${pointsForWinner}`,
    `Points for winner+method: ${pointsForWinnerMethod}`,
    `Sum winners stakes: ${sumWinnersStakes}`,
    `Winning pool total shares: ${winningPoolTotalShares}`,
  ], "submitFightResult");

  // Request confirmation
  await requestConfirmation(args);

  console.log("\n🚀 Executing transaction...");
  const tx = await booster.submitFightResult(
    eventId,
    fightId,
    winner,
    method,
    pointsForWinner,
    pointsForWinnerMethod,
    sumWinnersStakes,
    winningPoolTotalShares
  );
  await waitForTransaction(tx, config.chainId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

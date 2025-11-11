// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Booster} from "../src/Booster.sol";
import {FP1155} from "../src/FP1155.sol";

/**
 * @title BoosterFPTest
 * @notice Test case: Single Fight Analysis - Fight 0 only
 * @dev Tests Booster contract using FP1155 tokens:
 *      - User1 bets 20 FP on outcome 0 (RED + SUBMISSION) - exact match (4 shares)
 *      - User2 bets 30 FP on outcome 1 (RED + DECISION) - winner only (3 shares)
 *      - User3 bets 25 FP on outcome 0 (RED + SUBMISSION) - exact match (4 shares)
 *      - Winning outcome: 0 (RED + SUBMISSION)
 *      - Prize pool: 100 FP
 */
contract BoosterFPTest is Test {
    Booster public booster;
    FP1155 public fp;

    address admin = makeAddr("admin");
    address operator = makeAddr("operator");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address user3 = makeAddr("user3");

    uint256 constant SEASON_1 = 1;
    string constant EVENT_1 = "UFC_300";
    uint256 constant FIGHT_1 = 1;

    // Points system: winner only = 3, exact match = 4
    uint256 constant POINTS_FOR_WINNER = 3;
    uint256 constant POINTS_FOR_WINNER_METHOD = 4;

    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy FP1155
        fp = new FP1155("https://api.fightfoundation.io/fp/", admin);
        
        // Deploy Booster
        booster = new Booster(address(fp), admin);
        
        // Grant roles
        fp.grantRole(fp.TRANSFER_AGENT_ROLE(), address(booster));
        fp.grantRole(fp.MINTER_ROLE(), admin);
        
        booster.grantRole(booster.OPERATOR_ROLE(), operator);
        
        // Mint FP tokens to users (FP1155 uses units, not decimals)
        // Minting 100 units of FP token (season 1) to each user
        fp.mint(user1, SEASON_1, 100, "");
        fp.mint(user2, SEASON_1, 100, "");
        fp.mint(user3, SEASON_1, 100, "");
        fp.mint(operator, SEASON_1, 500, "");

        // Allowlist participants for transfers
        fp.setTransferAllowlist(user1, true);
        fp.setTransferAllowlist(user2, true);
        fp.setTransferAllowlist(user3, true);
        fp.setTransferAllowlist(operator, true);
        
        vm.stopPrank();
    }

    function test_singleFight() public {
        console2.log("\n=== TEST CASE: Single Fight Analysis ===");
        
        vm.prank(operator);
        booster.createEvent(EVENT_1, 1, SEASON_1);

        uint256 prizePool = 100;

        // Deposit prize pool as bonus
        vm.prank(operator);
        booster.depositBonus(EVENT_1, FIGHT_1, prizePool);

        // Verify prize pool deposited
        (, , , uint256 bonusPool, , , , , , , , ) = booster.getFight(EVENT_1, FIGHT_1);
        assertEq(bonusPool, prizePool, "Prize pool should be 100 FP");
 
        // Define stakes
        uint256 stake1 = 20;
        uint256 stake2 = 30;
        uint256 stake3 = 25;

        console2.log("Setup: User1 bets %d on RED + SUBMISSION", stake1);
        console2.log("       User2 bets %d on RED + DECISION", stake2);
        console2.log("       User3 bets %d on RED + SUBMISSION", stake3);

        // User1: Bets on Fight 1 (RED + SUBMISSION) - exact match (4 points)
        vm.prank(user1);
        Booster.BoostInput[] memory boosts1 = new Booster.BoostInput[](1);
        boosts1[0] = Booster.BoostInput(FIGHT_1, stake1, Booster.Corner.RED, Booster.WinMethod.SUBMISSION);
        booster.placeBoosts(EVENT_1, boosts1);

        // User2: Bets on Fight 1 (RED + DECISION) - winner only (3 points)
        vm.prank(user2);
        Booster.BoostInput[] memory boosts2 = new Booster.BoostInput[](1);
        boosts2[0] = Booster.BoostInput(FIGHT_1, stake2, Booster.Corner.RED, Booster.WinMethod.DECISION);
        booster.placeBoosts(EVENT_1, boosts2);

        // User3: Bets on Fight 1 (RED + SUBMISSION) - exact match (4 points)
        vm.prank(user3);
        Booster.BoostInput[] memory boosts3 = new Booster.BoostInput[](1);
        boosts3[0] = Booster.BoostInput(FIGHT_1, stake3, Booster.Corner.RED, Booster.WinMethod.SUBMISSION);
        booster.placeBoosts(EVENT_1, boosts3);

        // Verify balances after predictions
        uint256 balanceAfterPredictions1 = fp.balanceOf(user1, SEASON_1);
        uint256 balanceAfterPredictions2 = fp.balanceOf(user2, SEASON_1);
        uint256 balanceAfterPredictions3 = fp.balanceOf(user3, SEASON_1);
        uint256 totalStakes = stake1 + stake2 + stake3;
        
        assertEq(balanceAfterPredictions1, 100 - stake1, "User1 should have 80 FP after prediction");
        assertEq(balanceAfterPredictions2, 100 - stake2, "User2 should have 70 FP after prediction");
        assertEq(balanceAfterPredictions3, 100 - stake3, "User3 should have 75 FP after prediction");
        
        // Verify original pool
        (, , , , uint256 originalPool, , , , , , , ) = booster.getFight(EVENT_1, FIGHT_1);
        assertEq(originalPool, totalStakes, "Original pool should equal total stakes");
        // Calculate winning pool total shares dynamically
        // User1: RED + SUBMISSION (exact match) = 4 points * 20 stake = 80 shares
        // User2: RED + DECISION (winner only) = 3 points * 30 stake = 90 shares
        // User3: RED + SUBMISSION (exact match) = 4 points * 25 stake = 100 shares
        uint256 user1Points = booster.calculateUserPoints(
            Booster.Corner.RED,
            Booster.WinMethod.SUBMISSION,
            Booster.Corner.RED,
            Booster.WinMethod.SUBMISSION,
            POINTS_FOR_WINNER,
            POINTS_FOR_WINNER_METHOD
        );
 
        uint256 user2Points = booster.calculateUserPoints(
            Booster.Corner.RED,
            Booster.WinMethod.DECISION,
            Booster.Corner.RED,
            Booster.WinMethod.SUBMISSION,
            POINTS_FOR_WINNER,
            POINTS_FOR_WINNER_METHOD
        );
        uint256 user3Points = booster.calculateUserPoints(
            Booster.Corner.RED,
            Booster.WinMethod.SUBMISSION,
            Booster.Corner.RED,
            Booster.WinMethod.SUBMISSION,
            POINTS_FOR_WINNER,
            POINTS_FOR_WINNER_METHOD
        );

        assertEq(user1Points, POINTS_FOR_WINNER_METHOD, "User1 should have 4 points (exact match)");
        assertEq(user2Points, POINTS_FOR_WINNER, "User2 should have 3 points (winner only)");
        assertEq(user3Points, POINTS_FOR_WINNER_METHOD, "User3 should have 4 points (exact match)");

        // Calculate sumWinnersStakes and winningPoolTotalShares
        // User1: 4 points, 20 stake -> 4 * 20 = 80 shares
        // User2: 3 points, 30 stake -> 3 * 30 = 90 shares
        // User3: 4 points, 25 stake -> 4 * 25 = 100 shares
        // sumWinnersStakes = 20 + 30 + 25 = 75
        // winningPoolTotalShares = 80 + 90 + 100 = 270
        uint256 sumWinnersStakes = stake1 + stake2 + stake3;
        uint256 winningPoolTotalShares = (user1Points * stake1) + (user2Points * stake2) + (user3Points * stake3);

        // Winning outcome: Fight 1: 0 (RED + SUBMISSION) - User1 and User3 win
        vm.prank(operator);
        booster.submitFightResult(
            EVENT_1,
            FIGHT_1,
            Booster.Corner.RED,
            Booster.WinMethod.SUBMISSION,
            POINTS_FOR_WINNER,
            POINTS_FOR_WINNER_METHOD,
            sumWinnersStakes,
            winningPoolTotalShares
        );
        
        // Get total winnings pool (prize pool)
        // prizePool = originalPool - sumWinnersStakes + bonusPool
        // In this case: originalPool = 75, sumWinnersStakes = 75, bonusPool = 100
        // prizePool = 75 - 75 + 100 = 100
        uint256 totalPool = originalPool - sumWinnersStakes + prizePool; // 75 - 75 + 100 = 100

        console2.log("\nResolution: Winning RED + SUBMISSION");
        console2.log("           Total Winnings Pool: %d", totalPool);
        console2.log("           Sum Winners Stakes: %d", sumWinnersStakes);
        console2.log("           Winning Pool Total Shares: %d", winningPoolTotalShares);

        // ============ STEP 6: Users claim winnings ============
        // Get boost indices for each user
        uint256[] memory indices1 = booster.getUserBoostIndices(EVENT_1, FIGHT_1, user1);
        uint256[] memory indices2 = booster.getUserBoostIndices(EVENT_1, FIGHT_1, user2);
        uint256[] memory indices3 = booster.getUserBoostIndices(EVENT_1, FIGHT_1, user3);

        // User1 should have winnings from Fight 1 (exact match, 4 points)
        uint256 balanceBefore1 = fp.balanceOf(user1, SEASON_1);
        
        // Get actual claimable amount from contract
        uint256 totalClaimable1 = booster.quoteClaimable(EVENT_1, FIGHT_1, user1, false);

        assertGt(totalClaimable1, 0, "User1 should be able to claim");
        assertEq(user1Points, POINTS_FOR_WINNER_METHOD, "User1 should have 4 points (exact match)");
        
        vm.prank(user1);
        booster.claimReward(EVENT_1, FIGHT_1, indices1);
        uint256 balanceAfter1 = fp.balanceOf(user1, SEASON_1);
        assertEq(balanceAfter1, balanceBefore1 + totalClaimable1, "User1 balance should increase by claimable amount");

        // User2 should have winnings from Fight 1 (winner only, 3 points)
        uint256 balanceBefore2 = fp.balanceOf(user2, SEASON_1);

        // Get actual claimable amount from contract
        uint256 totalClaimable2 = booster.quoteClaimable(EVENT_1, FIGHT_1, user2, false);
        assertGt(totalClaimable2, 0, "User2 should be able to claim");
        assertEq(user2Points, POINTS_FOR_WINNER, "User2 should have 3 points (winner only)");
        
        vm.prank(user2);
        booster.claimReward(EVENT_1, FIGHT_1, indices2);
        
        uint256 balanceAfter2 = fp.balanceOf(user2, SEASON_1);
        assertEq(balanceAfter2, balanceBefore2 + totalClaimable2, "User2 balance should increase by claimable amount");

        // User3 should have winnings from Fight 1 (exact match, 4 points)
        uint256 balanceBefore3 = fp.balanceOf(user3, SEASON_1);
        
        // Get actual claimable amount from contract
        uint256 totalClaimable3 = booster.quoteClaimable(EVENT_1, FIGHT_1, user3, false);
        assertGt(totalClaimable3, 0, "User3 should be able to claim");
        assertEq(user3Points, POINTS_FOR_WINNER_METHOD, "User3 should have 4 points (exact match)");         
        
        vm.prank(user3);
        booster.claimReward(EVENT_1, FIGHT_1, indices3);
        
        uint256 balanceAfter3 = fp.balanceOf(user3, SEASON_1);
        assertEq(balanceAfter3, balanceBefore3 + totalClaimable3, "User3 balance should increase by claimable amount");
 
        console2.log("\n=== RESULTS SUMMARY ===");
        console2.log("User1 claimable: %d", totalClaimable1);
        console2.log("User2 claimable: %d", totalClaimable2);
        console2.log("User3 claimable: %d", totalClaimable3);
        
        // Verify all positions are claimed
        uint256 claimable1After = booster.quoteClaimable(EVENT_1, FIGHT_1, user1, false);
        uint256 claimable2After = booster.quoteClaimable(EVENT_1, FIGHT_1, user2, false);
        uint256 claimable3After = booster.quoteClaimable(EVENT_1, FIGHT_1, user3, false);
        assertEq(claimable1After, 0, "User1 should have no remaining claimable");
        assertEq(claimable2After, 0, "User2 should have no remaining claimable");
        assertEq(claimable3After, 0, "User3 should have no remaining claimable");

        // Calculate remainder (truncation remainder from integer division)
        // The remainder is only from the prizePool (winnings), not from the stakes
        // Each user gets back their stake + winnings, so we need to subtract stakes from totalClaimable
        // User1: stake1 = 20, User2: stake2 = 30, User3: stake3 = 25
        uint256 totalWinningsDistributed = (totalClaimable1 - stake1) + (totalClaimable2 - stake2) + (totalClaimable3 - stake3);
        uint256 expectedRemainder = totalPool - totalWinningsDistributed;
        uint256 contractBalanceAfter = fp.balanceOf(address(booster), SEASON_1);
        assertEq(contractBalanceAfter, expectedRemainder, "Contract should have truncation remainder");
        
        console2.log("Remainder in Contract: %d (truncation remainder)", expectedRemainder);

        //print users balances
        console2.log("User1 balance: %d", fp.balanceOf(user1, SEASON_1));
        console2.log("User2 balance: %d", fp.balanceOf(user2, SEASON_1));
        console2.log("User3 balance: %d", fp.balanceOf(user3, SEASON_1));
    }

    // Helper function to get user winnings
    function _getUserWinnings(
        string memory eventId,
        uint256 fightId,
        address user,
        uint256 totalPool,
        uint256 totalWinningPoints,
        uint256 stake,
        uint256 points
    ) internal view returns (uint256 canClaim, uint256 winnings, uint256 totalPayout) {
        uint256 totalClaimable = booster.quoteClaimable(eventId, fightId, user, false);
        canClaim = totalClaimable > 0 ? 1 : 0;
        
       uint256 userShares = points * stake; // points * amount for this boost
        winnings = (totalPool * userShares) / totalWinningPoints;
        totalPayout = stake + winnings;
    }
}

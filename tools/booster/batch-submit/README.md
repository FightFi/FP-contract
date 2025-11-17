# Batch Submit Fight Results

Script to submit multiple fight results easily and securely using a JSON file.

## Quick Start

### Step 1: Copy and edit the template

```bash
cp tools/booster/batch-submit/fight-results-template.json tools/booster/batch-submit/fight-results-ufc322.json
```

### Step 2: Edit the JSON file

Edit `fight-results-ufc322.json` with the actual results of the 10 fights:

```json
{
  "eventId": "UFC_322",
  "fights": [
    {
      "fightId": 1,
      "winner": "RED",
      "method": "KNOCKOUT",
      "pointsForWinner": "10",
      "pointsForWinnerMethod": "20",
      "sumWinnersStakes": "10000000000000000000",
      "winningPoolTotalShares": "200000000000000000000"
    },
    // ... more fights
  ]
}
```

### Step 3: Run the script

```bash
ts-node tools/booster/batch-submit/submit-batch-results.ts \
  --network testnet \
  --file tools/booster/batch-submit/fight-results-ufc322.json
```

## Valid Values

### Winner
- `RED` or `0` - Red corner
- `BLUE` or `1` - Blue corner
- `NONE` or `2` - No winner (requires NO_CONTEST method)

### Method
- `KNOCKOUT`, `KO` or `0` - Knockout
- `SUBMISSION`, `SUB` or `1` - Submission
- `DECISION`, `DEC` or `2` - Decision
- `NO_CONTEST` or `3` - No contest

## Security Features

1. **Pre-validation**: All data is validated before sending any transaction
2. **Complete review**: A detailed summary of all results is displayed before submitting
3. **Confirmation**: Confirmation is requested before proceeding
4. **Optional individual confirmation**: You can confirm each fight individually or all at once
5. **Error handling**: If a transaction fails, the script continues with the next ones
6. **Final summary**: A summary of successes and failures is shown at the end

## Example Output

```
============================================================
VALIDATING FIGHT RESULTS
============================================================
✅ All 10 fights validated successfully

============================================================
BATCH SUBMISSION REVIEW
============================================================
Network:           testnet
Contract Address:  0x...
Wallet Address:    0x...
Event ID:          UFC_322
Total Fights:      10
============================================================

FIGHT RESULTS:
------------------------------------------------------------

Fight 1:
  Winner:            RED (0)
  Method:            KNOCKOUT (0)
  Points (Winner):   10
  Points (Winner+Method): 20
  Sum Winners Stakes: 10000000000000000000
  Winning Pool Shares: 200000000000000000000

[... more fights ...]

Do you want to submit all 10 fight results? (y/n): y
Do you want to confirm each fight individually? (y/n): n

⏳ Starting batch submission...

[1/10] Processing Fight 1...
  ✅ Transaction sent: 0x...
  ✅ Confirmed in block: 12345

[... more transactions ...]

============================================================
BATCH SUBMISSION SUMMARY
============================================================
Total:     10
Success:   10
Failed:    0
============================================================
```

## Parameters

- `--network` or `--net`: Network to use (testnet or mainnet)
- `--file`: Path to the JSON file with the results
- `--contract`: Booster contract address (optional, uses BOOSTER_ADDRESS from .env if not specified)


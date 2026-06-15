# World Cup Match & Champion Predictor

Linear regression model that predicts **goal difference** (a continuous number) for international football matches. The winner is derived from the sign of that prediction. From single-match predictions, a Monte Carlo simulation of the 2026 World Cup bracket estimates each team's champion probability.

> **Model type**: `sklearn.linear_model.LinearRegression` — hard requirement. No classifiers.

---

## Data

1. Go to https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017
2. Download `results.csv`
3. Place it at `data/results.csv` (create the `data/` folder if it doesn't exist)

The CSV has columns: `date, home_team, away_team, home_score, away_score, tournament, neutral`

---

## Setup

```bash
pip install -r requirements.txt
```

---

## Run

**Phase 1 — Feature engineering (confirm before training):**
```bash
python train.py
```
Inspect the printed feature table and `artifacts/features_preview.csv`.

**Phase 2 — Train the model:**
Uncomment the Phase 2 block in `train.py`, then re-run:
```bash
python train.py
```
This produces `model.json` with coefficients, intercept, and team snapshots.

**Phase 3 — Open the frontend:**
```bash
# Just open index.html in any browser (no server needed)
start index.html        # Windows
open index.html         # macOS
```

---

## Features

For each match, features are the **difference (home − away)** of:

| Feature | Description |
|---|---|
| `form_diff` | Win rate over last 10 matches |
| `scored_diff` | Avg goals scored per match (last 10) |
| `conceded_diff` | Avg goals conceded per match (last 10) |
| `strength_diff` | Avg goal difference per match (last 10) |
| `neutral` | 1 = neutral venue, 0 = home advantage applies |

Rolling windows use **only past matches** — no data leakage.  
Split is **chronological** (first 80% by date = train, last 20% = test).

---

## Honest Metrics

Expect:
- **MAE** ~1.0–1.5 goals  
- **Directional accuracy** ~55–65% (predicting the right winner)

Football is noisy. Realistic numbers are better than inflated ones.

---

## Files

```
data/results.csv        ← you provide this
train.py                ← feature engineering + model training
model.json              ← trained model (coefficients, team snapshots)
index.html              ← self-contained interactive frontend
requirements.txt
artifacts/              ← feature preview CSV, scatter plots
```

# FIFA World Cup 2026 — Linear Regression Predictor

A machine learning project that predicts match outcomes and simulates the entire 2026 FIFA World Cup bracket using **linear regression**. All predictions run in the browser from saved model coefficients — no backend, no database.

> **Model constraint:** `sklearn.linear_model.LinearRegression` only. No classifiers, no logistic regression, no neural networks.

**Live demo:** [Deploy to Vercel — see below](#deployment)

---

## What It Does

| Feature | Description |
|---|---|
| **Match Predictor** | Pick any two teams → predicted goal difference, scoreline, and winner |
| **Bracket Simulator** | Manual 2026 WC bracket with model-powered winner predictions |
| **Tournament Sim** | 10,000 Monte Carlo simulations → champion probability per team |
| **Coefficient Chart** | Which features drive the model most |
| **Accuracy Chart** | Predicted vs actual goal differences on test data |

---

## How Linear Regression Is Used

### The Core Idea

Linear regression predicts a **continuous number** — the goal difference (home goals minus away goals). The sign of that number determines the winner:

```
goal_diff = intercept + β₁·form_diff + β₂·scored_diff + ... + β₇·neutral

goal_diff > 0  → home team wins
goal_diff < 0  → away team wins
goal_diff ≈ 0  → draw
```

This is a regression problem, not a classification problem. We never directly predict win/draw/loss — we predict a number and derive the result. This preserves information (a 3–0 win is treated differently from a 1–0 win) and makes the model more interpretable.

### Why Linear Regression for Football?

- **Interpretable** — each feature has a coefficient; you can see exactly why the model favours one team
- **No overfitting risk** with 7 features and 23,000+ training rows
- **Coefficients are stable** — the model learns a consistent relationship between team quality and goal margin
- **Honest** — linear regression does not pretend to know more than it does; uncertainty is visible in the residuals

### The Math (Reproduced in JavaScript)

After training in Python with `sklearn`, the coefficients and scaler parameters are saved to `model.json`. The browser then reproduces the exact same prediction:

```javascript
// 1. Build raw feature differences (home − away)
const raw = [form_diff, scored_diff, conceded_diff,
             strength_diff, elo_diff, market_value_diff, neutral];

// 2. Apply StandardScaler: (x − mean) / scale
const scaled = raw.map((x, i) => (x - mean[i]) / scale[i]);

// 3. Linear combination
const goalDiff = intercept + scaled.reduce((s, x, i) => s + x * coef[i], 0);
```

No server required — the model lives entirely in `model.json`.

---

## Features (7 total)

All features are computed as **home team minus away team** so a positive value always means a home advantage on that stat.

| Feature | How It's Computed | Why It Matters |
|---|---|---|
| `form_diff` | Win rate over last 10 competitive matches | Recent momentum |
| `scored_diff` | Avg goals scored per match (last 10) | Attacking output |
| `conceded_diff` | Avg goals conceded per match (last 10) | Defensive quality |
| `strength_diff` | Avg goal difference per match (last 10) | Overall dominance |
| `elo_diff` | ELO rating difference (tournament-weighted K-factor) | Historical strength |
| `market_value_diff` | Squad market value difference (€M, Transfermarkt) | Squad depth/quality |
| `neutral` | 1 = neutral venue, 0 = home ground | Home field advantage |

### No Data Leakage

Rolling windows use **only past matches** — for each match, features are computed from the team's history up to (but not including) that match. ELO ratings and rolling stats are updated **after** each match is processed.

### Data Scope

- **Source:** [Kaggle — International Football Results 1872–present](https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017)
- **Rows used:** Post-2000 only (25,351 matches → 23,418 after warm-up drop)
- **Pre-2000 data excluded:** Modern football (squad rotation, pressing, fitness science) is structurally different from earlier eras
- **Split:** Chronological 80/20 — first 80% of dates = train, last 20% = test. No shuffle.

### ELO System

ELO ratings are updated after every match using a tournament-weighted K-factor:

| Tournament type | K-factor |
|---|---|
| FIFA World Cup, EURO, Copa América, AFCON, AFC Asian Cup | 60 |
| Qualifying matches | 40 |
| Friendlies | 20 |

Higher K = ratings update faster after major results.

---

## Model Metrics

Evaluated on the held-out test set (2020–2026, ~4,600 matches):

| Metric | Value |
|---|---|
| MAE | 1.36 goals |
| RMSE | 1.77 goals |
| **Directional accuracy** | **60.5%** |
| Residual std | 1.77 goals |

**Directional accuracy** = how often `sign(predicted_diff) == sign(actual_diff)`. This is the most meaningful metric — it measures whether the model picks the right winner.

Football is inherently noisy. A directional accuracy of 60.5% is realistic and honest — even professional tipsters rarely exceed 65% over a large sample.

---

## Monte Carlo Simulation

The tournament simulator runs 10,000 full World Cup simulations:

1. **Group stage** — each of 12 groups plays round-robin (6 matches per group)
2. **Advancement** — top 2 from each group (24) + 8 best 3rd-place teams = 32
3. **Knockout** — single-elimination bracket (R32 → R16 → QF → SF → Final)

Each simulated match adds Gaussian noise to the linear regression prediction:

```javascript
noisyDiff = predictGoalDiff(teamA, teamB) + gaussianRandom(0, residual_std)
```

`residual_std = 1.77` is derived from the model's own test-set residuals — not hardcoded. This ensures upset probability is calibrated to the model's actual uncertainty.

---

## Setup

### Python (model training)

```bash
pip install -r requirements.txt
```

Place `results.csv` from Kaggle at `data/results.csv`, then:

```bash
# Windows (avoids Unicode encoding errors)
python -X utf8 train.py

# macOS / Linux
python train.py
```

This produces `model.json` and copies it to `frontend/public/model.json`.

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Deployment

The frontend is a static Vite app — no backend needed.

**Vercel (recommended):**
1. Import this repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Vercel auto-detects Vite → Deploy

`model.json` is bundled as a static asset. All predictions run client-side.

---

## Project Structure

```
LinearRegression_Guild_Model/
├── data/
│   ├── results.csv              ← Kaggle dataset (you provide this, gitignored)
│   └── market_values.csv        ← Transfermarkt squad values (48 WC teams)
├── train.py                     ← Feature engineering + model training
├── model.json                   ← Trained model (coefficients, scaler, team snapshots)
├── artifacts/
│   └── features_preview.csv     ← Feature table for inspection
├── frontend/
│   ├── public/
│   │   └── model.json           ← Copy served by Vite
│   ├── src/
│   │   ├── App.jsx              ← Tab layout, model loader
│   │   ├── components/
│   │   │   ├── MatchPredictor.jsx
│   │   │   ├── CustomBracket.jsx
│   │   │   ├── TournamentSim.jsx
│   │   │   ├── CoeffChart.jsx
│   │   │   └── ScatterPlot.jsx
│   │   └── utils/
│   │       ├── model.js         ← JS re-implementation of linear regression
│   │       ├── tournament.js    ← Monte Carlo simulation engine
│   │       └── flags.js         ← Country flag emoji lookup
│   └── package.json
├── docs/superpowers/
│   ├── specs/                   ← Design documents
│   └── plans/                   ← Implementation plans
└── requirements.txt
```

---

## How to Improve the Model (Linear Regression Only)

These are the highest-impact improvements that keep the hard constraint of `sklearn.linear_model.LinearRegression`. A full implementation plan is saved at `docs/superpowers/plans/2026-06-14-model-accuracy-upgrade.md`.

### 1. Filter Friendlies from Rolling Stats *(high impact)*

Currently, a team's form includes friendly matches (where managers rest key players and try new tactics). Filtering friendlies from the rolling window so only competitive results count will give cleaner, more predictive form ratings.

```python
# Only update team_history for competitive matches
if 'friendly' not in match['tournament'].lower():
    team_history[home].append(home_result)
    team_history[away].append(away_result)
```

### 2. Weight Recent Matches More Heavily *(medium impact)*

Equal weighting treats a match from 10 games ago the same as last week's result. Doubling the weight of the 3 most recent matches reflects that current form matters more:

```python
weights = [1.0] * 7 + [2.0, 2.0, 2.0]   # last 3 count double
total_w = 13.0
form = sum(m["won"] * w for m, w in zip(recent, weights)) / total_w
```

### 3. Head-to-Head Record Feature *(medium impact)*

Some matchups are historically lopsided regardless of current form (e.g., Brazil vs Bolivia). Adding a `h2h_win_rate` feature from the last 5 meetings between two teams captures rivalry-specific bias that general form stats miss.

### 4. Larger Rolling Window *(low-medium impact)*

Increasing `WINDOW` from 10 to 15 or 20 matches reduces noise in the rolling stats, especially for teams that play infrequently. Trade-off: more warm-up rows are dropped.

### 5. Feature Interactions *(low-medium impact)*

Linear regression can model interaction terms by adding new engineered features. Example:

```python
"form_x_elo"   : form_diff * elo_diff,     # good form matters more for strong teams
"home_strength" : (1 - neutral) * strength_diff,  # strength advantage only when not neutral
```

These stay within `LinearRegression` — the interactions are just new input columns.

### 6. Robust Scaling *(low impact)*

Replace `StandardScaler` with `RobustScaler` (uses median and IQR instead of mean and std). Less sensitive to outlier scorelines like 10–0 friendlies that skew the distribution.

### 7. Filter Training to Competitive Matches Only *(investigate)*

Training only on competitive matches (qualifiers, tournaments) rather than all post-2000 matches focuses the model on the type of game it's asked to predict. Friendlies are structurally different and may be adding noise to the coefficient estimates.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Model training | Python 3, pandas, numpy, scikit-learn |
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | Recharts |
| Deployment | Vercel (static) |

# World Cup Predictor — Project Rules

## What this is
Linear regression model predicting **goal difference** (continuous). Winner = sign(prediction).
Monte Carlo sim of 2026 World Cup 48-team bracket → champion probability per team.

## Hard rules
- Model MUST be `sklearn.linear_model.LinearRegression`. No classifiers, no logistic regression.
- Target = `home_score - away_score` (continuous, signed). Never treat this as classification.
- Rolling windows use only **past** matches (no leakage). Features computed BEFORE updating history.
- Train/test split is **chronological** — no shuffle. First 80% by date = train.

## Build phases (stop after each for confirmation)
1. **Phase 1** — `train.py`: feature engineering, print table, wait for OK. ✅ DONE
2. **Phase 2** — extend `train.py`: train model, print MAE/RMSE/directional accuracy, save `model.json`
3. **Phase 3** — React + Vite app (`frontend/`): loads `model.json`, all predictions in JS from coefficients

## Features (home − away difference)
- `form_diff` — win rate last 10 matches
- `scored_diff` — avg goals scored last 10
- `conceded_diff` — avg goals conceded last 10
- `strength_diff` — avg goal diff last 10
- `neutral` — 1 if neutral venue

## Key files
- `data/results.csv` — Kaggle dataset (gitignored, user-provided)
- `train.py` — Phase 1 + Phase 2 (Phase 2 block commented out until confirmed)
- `model.json` — output: coefficients, intercept, scaling, team snapshots, test points
- `frontend/` — Phase 3 React + Vite app
- `artifacts/features_preview.csv` — feature table for inspection

## model.json schema
```json
{
  "features": ["form_diff", "scored_diff", "conceded_diff", "strength_diff", "neutral"],
  "coef": [...],
  "intercept": ...,
  "scaling": { "mean": [...], "scale": [...] },
  "teams": { "Brazil": { "form": 0.7, "scored": 2.1, "conceded": 0.9, "strength": 1.2 }, ... },
  "metrics": { "mae": ..., "rmse": ..., "directional_accuracy": ... },
  "test_points": [{ "pred": ..., "actual": ... }, ...]
}
```

## Frontend requirements (Phase 3)
- Two-team dropdown → predicted goal diff + scoreline + winner
- Coefficient bar chart (use Recharts)
- Simulate 2026 tournament button — 48-team format (12 groups of 4, top 2 + 8 best thirds → 32-team knockout)
- 10,000 Monte Carlo runs, Gaussian noise on each match to model upsets
- Predicted-vs-actual scatter (from test_points, use Recharts ScatterChart)
- React + Vite app, clean responsive design — judge-presentable
- Loads `model.json` at runtime; all predictions computed in JS from coefficients

## Honest metrics
Do NOT inflate. Realistic targets: MAE ~1.0–1.5 goals, directional accuracy ~55–65%.

## Tech stack
- Python 3, pandas, numpy, scikit-learn, matplotlib
- Frontend: **React + Vite**, Tailwind CSS for styling, **Recharts** for charts

## 2026 World Cup bracket
48 teams: 12 groups of 4 → top 2 + 8 best 3rd-place → 32-team single-elimination knockout.
Team list finalized in Phase 3 (mix of qualified + projected seeds). Sim engine must be generic/pluggable.

## User preferences
- Planning/reasoning: prefer Claude Opus
- Coding: Claude Sonnet
- Comment code clearly — must be explainable to judges

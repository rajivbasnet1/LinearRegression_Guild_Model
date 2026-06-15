# Phase 2 Upgrade: ELO + Explanation Engine + Confidence Interval

**Date:** 2026-06-14
**Project:** World Cup 2026 Linear Regression Predictor
**Scope:** Phase 1 of competition upgrade (market value + Monte Carlo upgrade deferred to phase 2)

---

## Constraints (non-negotiable)

- Model stays `sklearn.linear_model.LinearRegression`
- Target stays `home_score - away_score`
- No classifiers, no ensemble methods, no neural networks
- Rolling windows computed before updating history (no leakage)
- Chronological train/test split preserved

---

## Feature 1: ELO Ratings

### Algorithm

- All teams initialise at ELO 1500 on first appearance
- ELO updates processed in chronological date order (same order as training data)
- Feature `elo_diff = home_elo - away_elo` recorded **before** updating ratings for that match
- After recording features, both teams' ELOs updated using standard ELO formula

### K-factor table

| Tournament type | K |
|---|---|
| FIFA World Cup, UEFA Euro, Copa América, Africa Cup of Nations, AFC Asian Cup | 60 |
| Any tournament name containing "qualification" (case-insensitive) | 40 |
| Everything else (friendlies, other cups) | 20 |

### ELO update formula

```python
expected = 1 / (1 + 10 ** ((away_elo - home_elo) / 400))
actual   = 1 if home_goals > away_goals else 0 if home_goals < away_goals else 0.5
home_elo += K * (actual - expected)
away_elo += K * (expected - actual)
```

### model.json

Latest ELO per team stored under `teams[name].elo`. Teams with no match history (new entrants) default to 1500 at prediction time.

---

## Feature 2: Explanation Engine

### Formula

For each feature `i`:
```python
contribution_i = coef_i * scaled_feature_i
```
where `scaled_feature_i = (raw_feature_i - scaler.mean_[i]) / scaler.scale_[i]`

Sum of all contributions + intercept = predicted goal difference.

### Frontend display (Match Predictor tab)

- Contributions sorted by `abs(contribution)` descending
- Each row: feature label, signed value, proportional CSS bar (green positive, red negative)
- Feature labels mapped to human-readable names:

| Feature key | Display label |
|---|---|
| form_diff | Recent Form |
| scored_diff | Goals Scored |
| conceded_diff | Goals Conceded |
| strength_diff | Strength Index |
| elo_diff | ELO Rating |
| neutral | Neutral Venue |

---

## Feature 3: Confidence Interval

### Computation

```python
residuals    = y_test - y_pred_test
residual_std = float(np.std(residuals))
```

Stored in `model.json` under `metrics.residual_std`.

### Frontend display

Below the goal difference card:
```
Brazil wins  +0.9 ± 1.3 goals
```
`±` value = `residual_std` rounded to 1 decimal.

---

## Updated Feature List

```python
["form_diff", "scored_diff", "conceded_diff", "strength_diff", "elo_diff", "neutral"]
```

`market_value_diff` deferred to phase 2 (data file `data/market_values.csv` already created).

---

## model.json Schema (additions only, backward compatible)

```json
{
  "features": ["form_diff", "scored_diff", "conceded_diff", "strength_diff", "elo_diff", "neutral"],
  "coef": [],
  "intercept": 0,
  "scaling": { "mean": [], "scale": [] },
  "teams": {
    "Brazil": {
      "form": 0.7,
      "scored": 2.1,
      "conceded": 0.9,
      "strength": 1.2,
      "elo": 2050
    }
  },
  "metrics": {
    "mae": 0,
    "rmse": 0,
    "directional_accuracy": 0,
    "residual_std": 0
  }
}
```

---

## Frontend Changes (Match Predictor tab only)

1. Team dropdowns show ELO next to name: `Brazil (ELO 2050)`
2. Confidence line below result cards: `+0.9 ± 1.3 goals`
3. Feature contribution breakdown panel — sorted bars, human-readable labels

No other tabs change in this phase.

---

## Files Changed

| File | Change |
|---|---|
| `train.py` | Add ELO computation, add `elo_diff` feature, add `residual_std` to metrics output |
| `frontend/src/components/MatchPredictor.jsx` | Add ELO display, confidence interval, contribution breakdown |
| `frontend/src/utils/model.js` | Update `predictGoalDiff` to include `elo_diff`; add `explainPrediction` helper |
| `frontend/public/model.json` | Regenerated after re-running `python train.py` |

---

## Phase 2 (deferred)

- `market_value_diff` feature (data file already at `data/market_values.csv`)
- Monte Carlo upgrade to use `residual_std` instead of hardcoded 1.98
- Frontend: market value display in Match Predictor

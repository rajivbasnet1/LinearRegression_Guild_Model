# Model Accuracy Upgrade — Design Spec

**Date:** 2026-06-14  
**Status:** Approved, ready for implementation  
**Constraint:** `sklearn.linear_model.LinearRegression` only — no classifiers, no other models

---

## Goal

Improve directional accuracy (currently 59.3%) and MAE (currently 1.34 goals) by cleaning the training data and computing better features. No new features are added — same 7-feature schema, same `model.json` structure, no frontend changes required.

---

## Current Baseline

| Metric | Value |
|---|---|
| MAE | 1.3415 goals |
| RMSE | 1.7763 goals |
| Directional accuracy | 59.3% |
| Residual std | 1.7718 goals |
| Training rows | ~37,600 |
| Test rows | ~9,400 |
| Date range | 1881 → 2026 |

---

## Three Improvements

### 1. Post-2000 Data Cutoff

**What:** Drop all matches before 2000-01-01 immediately after loading `results.csv`.

**Why:** Pre-2000 football is structurally different — no squad rotation, different fitness standards, different tactical styles. Those matches add noise to coefficient learning without adding useful signal for predicting 2026 outcomes.

**Where in `train.py`:** After `df.dropna(subset=["home_score","away_score"])`, add:
```python
df = df[df['date'].dt.year >= 2000].reset_index(drop=True)
```

**Impact:** Removes ~60% of raw rows but retains the most relevant 26 years of modern football.

---

### 2. Competitive-Only Rolling Stats and Training Data

**What:** Exclude friendly matches from (a) the rolling stats history and (b) the training rows. ELO still updates on friendlies (lower K-factor of 20 already handles this).

**Why:** Friendly matches are meaningless for predicting competitive results. France losing 3–0 in a pre-tournament friendly with a B squad should not hurt their form rating before a World Cup group game. Filtering friendlies gives cleaner form/scored/conceded/strength values and trains the model only on competitive outcomes.

**Friendly detection:**
```python
is_friendly = 'friendly' in match['tournament'].lower()
```

**Change to per-row loop in `train.py`:**
```python
is_friendly = 'friendly' in match['tournament'].lower()

# Capture ELO before match (no leakage) — unchanged
home_elo = elo_ratings[home]
away_elo = elo_ratings[away]

# Compute rolling stats from competitive history only
home_stats = rolling_stats(team_history[home])
away_stats = rolling_stats(team_history[away])

if not is_friendly:
    rows.append({
        "date"              : match["date"],
        "home_team"         : home,
        "away_team"         : away,
        "form_diff"         : home_stats["form"]     - away_stats["form"],
        "scored_diff"       : home_stats["scored"]   - away_stats["scored"],
        "conceded_diff"     : home_stats["conceded"] - away_stats["conceded"],
        "strength_diff"     : home_stats["strength"] - away_stats["strength"],
        "elo_diff"          : home_elo - away_elo,
        "market_value_diff" : market_value_lookup.get(home, 0.0) - market_value_lookup.get(away, 0.0),
        "neutral"           : int(match["neutral"]),
        "goal_diff"         : int(match["home_score"]) - int(match["away_score"]),
        "home_score"        : match["home_score"],
        "away_score"        : match["away_score"],
    })
    team_history[home].append(home_result)
    team_history[away].append(away_result)

# ELO updates on ALL matches (friendlies included, K=20 already applied)
k = _k_factor(match["tournament"])
elo_ratings[home], elo_ratings[away] = _elo_update(
    home_elo, away_elo,
    match["home_score"], match["away_score"], k
)
```

**Key detail:** ELO update moves OUTSIDE the `if not is_friendly` block so it still applies to all matches. Rolling history and training rows are competitive-only.

---

### 3. Weighted Recent Form

**What:** In `rolling_stats`, the most recent 3 matches get weight 2.0; the older 7 get weight 1.0. All four stats use identical weighting. No change to window size (still 10).

**Why:** A team on a 3-match winning streak coming into a tournament is in better shape than their overall 10-game average suggests. Recency matters and is easy to explain to judges.

**New `rolling_stats` function:**
```python
def rolling_stats(history: list, window: int = WINDOW) -> dict:
    recent  = history[-window:]
    n       = len(recent)

    if n < window:
        return dict(form=np.nan, scored=np.nan, conceded=np.nan, strength=np.nan)

    # Last 3 matches weighted double — recency matters more than old results
    weights = [1.0] * (window - 3) + [2.0, 2.0, 2.0]
    total_w = sum(weights)

    form     = sum(m["won"]                    * w for m, w in zip(recent, weights)) / total_w
    scored   = sum(m["scored"]                 * w for m, w in zip(recent, weights)) / total_w
    conceded = sum(m["conceded"]               * w for m, w in zip(recent, weights)) / total_w
    strength = sum((m["scored"]-m["conceded"]) * w for m, w in zip(recent, weights)) / total_w

    return dict(form=form, scored=scored, conceded=conceded, strength=strength)
```

---

## What Does NOT Change

- `sklearn.linear_model.LinearRegression` — hard constraint, unchanged
- Feature list: `["form_diff", "scored_diff", "conceded_diff", "strength_diff", "elo_diff", "market_value_diff", "neutral"]`
- `model.json` schema — identical structure, coefficients will shift in value but keys stay the same
- `StandardScaler` — still applied, still persisted to `model.json`
- Chronological 80/20 train/test split — still date-based, no shuffle
- Rolling window size — still 10 competitive matches
- Frontend (`model.js`, `MatchPredictor.jsx`, `tournament.js`) — no changes needed

---

## Files Changed

| File | Change |
|---|---|
| `train.py` | Post-2000 cutoff, friendly filter, weighted rolling_stats |
| `model.json` | Regenerated (same schema, new coefficients) |
| `frontend/public/model.json` | Regenerated (same schema, new coefficients) |

No other files change.

---

## Expected Outcome

| Metric | Current | Expected after upgrade |
|---|---|---|
| Directional accuracy | 59.3% | 61–65% |
| MAE | 1.34 goals | 1.20–1.30 goals |
| Training rows (approx) | 37,600 | ~12,000–18,000 (competitive post-2000 only) |

Fewer rows but higher-quality signal. The coefficient signs should remain the same (positive elo_diff still means home-team ELO advantage → positive goal diff); magnitudes will shift.

---

## Implementation Order

Run in this order — each step depends on the previous:

1. Add post-2000 cutoff (1 line)
2. Refactor `rolling_stats` to use weighted window
3. Refactor per-row loop to filter friendlies (move ELO update outside the if block)
4. Run `python train.py` — verify row counts, inspect new metrics
5. Confirm directional accuracy improved before committing

---

## Verification Checklist

- [ ] Training rows are post-2000 only (check printed date range)
- [ ] Friendly matches absent from `artifacts/features_preview.csv` (spot-check tournament column)
- [ ] Coefficient signs unchanged (positive elo_diff → positive goal diff)
- [ ] Directional accuracy ≥ 59.3% (must not regress)
- [ ] MAE ≤ 1.34 (must not regress)
- [ ] `model.json` schema unchanged (features list, team keys, metrics keys all same)
- [ ] Frontend loads without errors after model regeneration

"""
World Cup Match & Champion Predictor
=====================================
Linear regression model that predicts GOAL DIFFERENCE (a continuous value).
Winner is derived from the sign of the prediction — not a classifier.

PHASE 1: Data loading, feature engineering, chronological train/test split.
         Run this and confirm the feature table before Phase 2 (training).

PHASE 2: (Uncomment the Phase 2 block below after Phase 1 confirmation.)
         Train model, print metrics, save model.json.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).parent
DATA_PATH  = REPO_ROOT / "data" / "results.csv"
ARTIFACTS  = REPO_ROOT / "artifacts"
MODEL_PATH         = REPO_ROOT / "model.json"
FRONTEND_MODEL_PATH = REPO_ROOT / "frontend" / "public" / "model.json"

# ── Guard: stop if data is missing ─────────────────────────────────────────────
if not DATA_PATH.exists():
    print("=" * 60)
    print("  DATA FILE NOT FOUND")
    print(f"  Expected: {DATA_PATH}")
    print()
    print("  Steps to fix:")
    print("  1. Go to https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017")
    print("  2. Download results.csv")
    print(f"  3. Place it at: {DATA_PATH}")
    print("=" * 60)
    sys.exit(1)

ARTIFACTS.mkdir(exist_ok=True)

# ── Constants ───────────────────────────────────────────────────────────────────
WINDOW      = 10       # rolling window: last N matches for stats
TRAIN_FRAC  = 0.80     # first 80% by date = train, last 20% = test

ELO_DEFAULT = 1500.0   # starting ELO for every team

def _k_factor(tournament: str) -> float:
    t = tournament.lower()
    majors = ['fifa world cup', 'uefa european', 'copa america',
              'africa cup', 'afc asian cup']
    if any(m in t for m in majors):
        return 60.0
    if 'qualif' in t:
        return 40.0
    return 20.0

def _elo_update(home_elo: float, away_elo: float,
                home_goals: float, away_goals: float, k: float):
    expected = 1.0 / (1.0 + 10.0 ** ((away_elo - home_elo) / 400.0))
    actual   = 1.0 if home_goals > away_goals else \
               0.5 if home_goals == away_goals else 0.0
    return (home_elo + k * (actual - expected),
            away_elo + k * (expected - actual))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 1 — Feature engineering
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print("\n" + "═" * 60)
print("  PHASE 1 — Loading data & building features")
print("═" * 60)

# ── 1. Load raw data ────────────────────────────────────────────────────────────
print(f"\n[1] Loading {DATA_PATH.name} …")
df = pd.read_csv(DATA_PATH, parse_dates=["date"])
df = df.sort_values("date").reset_index(drop=True)   # chronological order

# Drop matches with missing scores (future fixtures in the dataset have no result yet)
before = len(df)
df = df.dropna(subset=["home_score", "away_score"]).reset_index(drop=True)
print(f"    Rows: {len(df):,}  (dropped {before - len(df):,} with missing scores)")
print(f"    Date range: {df['date'].min().date()} → {df['date'].max().date()}")
print(f"    Columns: {list(df.columns)}")
print(f"    Unique teams: {pd.unique(df[['home_team','away_team']].values.ravel()).shape[0]}")


# ── 2. Build per-team rolling statistics (no leakage) ──────────────────────────
#
#  For each match at index i, we look ONLY at games that occurred BEFORE match i
#  for each team. This prevents data leakage — the model never sees future results.
#
#  We maintain a dict: team_history[team] = list of past match dicts
#  Each time we compute features for a match, we look up each team's history
#  and calculate rolling stats from the last WINDOW entries.
#
print(f"\n[2] Computing rolling stats (window = {WINDOW} matches per team) …")
print("    (Using only past matches for each team — no data leakage)")

def rolling_stats(history: list, window: int = WINDOW) -> dict:
    """
    Given a list of past match results for a team, compute rolling stats
    over the last `window` matches.

    Each entry in history is a dict with:
        scored    - goals scored by this team in that match
        conceded  - goals conceded by this team
        won       - 1 if won, 0 if draw/loss

    Returns form (win rate), avg scored, avg conceded, avg strength (goal diff).
    Returns None if fewer than `window` past matches exist (warm-up period).
    """
    recent = history[-window:]          # last N matches (already sorted by date)
    n      = len(recent)

    if n < window:
        # Not enough history — return NaN signals; will be dropped later
        return dict(form=np.nan, scored=np.nan, conceded=np.nan, strength=np.nan)

    form      = sum(m["won"]      for m in recent) / n   # win rate 0..1
    scored    = sum(m["scored"]   for m in recent) / n   # avg goals scored
    conceded  = sum(m["conceded"] for m in recent) / n   # avg goals conceded
    # Strength = mean goal difference — positive means net attacking edge
    strength  = sum(m["scored"] - m["conceded"] for m in recent) / n

    return dict(form=form, scored=scored, conceded=conceded, strength=strength)


# Accumulate features row by row; maintain mutable history per team
team_history: dict[str, list] = {}   # team_name -> list of past match records
elo_ratings:  dict[str, float] = {}  # team_name -> current ELO (updated after each match)

rows = []   # will become the feature DataFrame

for idx, match in df.iterrows():
    home = match["home_team"]
    away = match["away_team"]

    # Ensure history lists exist
    if home not in team_history:
        team_history[home] = []
    if away not in team_history:
        team_history[away] = []

    # Initialise ELO for new teams
    if home not in elo_ratings:
        elo_ratings[home] = ELO_DEFAULT
    if away not in elo_ratings:
        elo_ratings[away] = ELO_DEFAULT

    # Capture ELO BEFORE this match (no leakage)
    home_elo = elo_ratings[home]
    away_elo = elo_ratings[away]

    # ── Compute stats BEFORE this match (using only past history) ──────────────
    home_stats = rolling_stats(team_history[home])
    away_stats = rolling_stats(team_history[away])

    # ── Feature vector: difference (home − away) for each stat ────────────────
    #  A positive feature_diff means the home team has an edge on that stat.
    rows.append({
        "date"           : match["date"],
        "home_team"      : home,
        "away_team"      : away,

        # Features
        "form_diff"      : home_stats["form"]     - away_stats["form"],
        "scored_diff"    : home_stats["scored"]   - away_stats["scored"],
        "conceded_diff"  : home_stats["conceded"] - away_stats["conceded"],
        "strength_diff"  : home_stats["strength"] - away_stats["strength"],
        "elo_diff"       : home_elo - away_elo,
        # neutral = 1 means the match is played on neutral ground (no home advantage)
        "neutral"        : int(match["neutral"]),

        # Target: goal difference (what we predict)
        "goal_diff"      : int(match["home_score"]) - int(match["away_score"]),

        # Keep raw scores for reference
        "home_score"     : match["home_score"],
        "away_score"     : match["away_score"],
    })

    # ── NOW update history with this match result ──────────────────────────────
    #  We update AFTER computing features — this is the leakage guard.
    home_result = dict(
        scored   = match["home_score"],
        conceded = match["away_score"],
        won      = 1 if match["home_score"] > match["away_score"] else 0,
    )
    away_result = dict(
        scored   = match["away_score"],
        conceded = match["home_score"],
        won      = 1 if match["away_score"] > match["home_score"] else 0,
    )
    team_history[home].append(home_result)
    team_history[away].append(away_result)

    # Update ELOs AFTER recording features (leakage guard)
    k = _k_factor(match["tournament"])
    elo_ratings[home], elo_ratings[away] = _elo_update(
        home_elo, away_elo,
        match["home_score"], match["away_score"], k
    )


features_df = pd.DataFrame(rows)

# ── 3. Drop warm-up rows (teams without enough history yet) ────────────────────
feature_cols = ["form_diff", "scored_diff", "conceded_diff", "strength_diff", "elo_diff", "neutral"]
before_drop = len(features_df)
features_df = features_df.dropna(subset=feature_cols).reset_index(drop=True)
dropped = before_drop - len(features_df)
print(f"    Rows before warm-up drop : {before_drop:,}")
print(f"    Rows dropped (< {WINDOW} past matches): {dropped:,}")
print(f"    Rows remaining           : {len(features_df):,}")


# ── 4. Chronological train/test split (NO shuffle — time-series data) ──────────
#
#  We cut at the 80th-percentile DATE — not row index — to handle cases where
#  the same date has many matches (all go to the same side of the cut).
#
split_date = features_df["date"].quantile(TRAIN_FRAC)
train_mask = features_df["date"] <= split_date
test_mask  = ~train_mask

train_df = features_df[train_mask].copy()
test_df  = features_df[test_mask].copy()

print(f"\n[3] Chronological split at {split_date.date()}")
print(f"    Train: {len(train_df):,} rows  ({train_df['date'].min().date()} → {train_df['date'].max().date()})")
print(f"    Test : {len(test_df):,} rows  ({test_df['date'].min().date()} → {test_df['date'].max().date()})")


# ── 5. Feature table preview ───────────────────────────────────────────────────
print("\n[4] Feature table — first 5 rows:")
print(features_df[["date","home_team","away_team"] + feature_cols + ["goal_diff"]].head(5).to_string(index=False))

print("\n    — last 5 rows:")
print(features_df[["date","home_team","away_team"] + feature_cols + ["goal_diff"]].tail(5).to_string(index=False))

print("\n    — descriptive stats of features:")
print(features_df[feature_cols + ["goal_diff"]].describe().round(3).to_string())

# Save preview CSV for inspection
preview_path = ARTIFACTS / "features_preview.csv"
features_df[["date","home_team","away_team"] + feature_cols + ["goal_diff"]].to_csv(preview_path, index=False)
print(f"\n    Full feature table saved → {preview_path}")


# ── 6. Store latest team snapshot for model.json (used in frontend) ────────────
#  After processing all matches, team_history[team] holds all past matches.
#  We compute rolling stats from the very last WINDOW matches for each team
#  so the frontend can reconstruct features for new (unseen) match-ups.
#
team_snapshots = {}
for team, history in team_history.items():
    snap = rolling_stats(history)
    if not any(np.isnan(v) for v in snap.values()):
        snap["elo"] = round(elo_ratings.get(team, ELO_DEFAULT), 1)
        team_snapshots[team] = snap

print(f"\n    Team snapshots built: {len(team_snapshots)} teams with ≥ {WINDOW} matches of history")

print("\n" + "═" * 60)
print("  PHASE 1 COMPLETE")
print("  ─ Inspect the feature table above and artifacts/features_preview.csv")
print("  ─ Confirm before Phase 2 (training) is uncommented and run.")
print("═" * 60)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 2 — Model training
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error

print("\n" + "═" * 60)
print("  PHASE 2 — Training linear regression model")
print("═" * 60)

X_train = train_df[feature_cols].values
y_train = train_df["goal_diff"].values
X_test  = test_df[feature_cols].values
y_test  = test_df["goal_diff"].values

# ── Scale features so coefficients are comparable across different units ────────
#  StandardScaler: subtract mean, divide by std. We persist mean/scale so the
#  frontend can apply identical scaling before computing predictions.
scaler  = StandardScaler()
X_train_s = scaler.fit_transform(X_train)   # fit ONLY on train — no leakage
X_test_s  = scaler.transform(X_test)        # apply same scale to test

# ── Train the model ─────────────────────────────────────────────────────────────
model = LinearRegression()
model.fit(X_train_s, y_train)

# ── Evaluate on test set ────────────────────────────────────────────────────────
y_pred = model.predict(X_test_s)

mae  = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(np.mean((y_pred - y_test) ** 2))

residuals     = y_test - y_pred
residual_std  = float(np.std(residuals))

# Directional accuracy: does sign(pred) == sign(actual)?
# Draws (goal_diff == 0) are counted as correct only if pred ≈ 0 too.
# We treat pred sign=0 as "draw" and actual sign=0 as "draw".
pred_sign   = np.sign(y_pred)
actual_sign = np.sign(y_test)
dir_acc = np.mean(pred_sign == actual_sign)

print(f"\n[1] Test-set metrics (n={len(y_test):,} matches, {test_df['date'].min().date()} → {test_df['date'].max().date()})")
print(f"    MAE               : {mae:.4f} goals")
print(f"    RMSE              : {rmse:.4f} goals")
print(f"    Directional acc   : {dir_acc:.4f}  ({dir_acc*100:.1f}%)")
print(f"    (Note: draws counted correct only if prediction is also a draw)")

# ── Coefficients — interpret which features matter most ─────────────────────────
print(f"\n[2] Coefficients (on scaled features):")
print(f"    Intercept : {model.intercept_:.4f}")
for name, coef in zip(feature_cols, model.coef_):
    bar = "█" * int(abs(coef) * 10) + ("+" if coef > 0 else "-")
    print(f"    {name:<20} {coef:+.4f}  {bar}")

print(f"\n    Interpretation: positive coef = home team advantage on that feature")
print(f"    All coefficients on the same scale (StandardScaler applied)")

# ── Latest team snapshots for frontend ─────────────────────────────────────────
#  team_snapshots already built in Phase 1; each team's last-10-match stats.
#  The frontend uses these to compute feature diffs for new match-ups without
#  re-reading the CSV.

# ── Collect test predictions for scatter plot ───────────────────────────────────
test_points = [
    {"pred": float(p), "actual": float(a)}
    for p, a in zip(y_pred, y_test)
]

# ── Save model.json ─────────────────────────────────────────────────────────────
#  Everything the frontend needs: coefficients, scaling params, team stats.
model_data = {
    "features"  : feature_cols,
    "coef"      : model.coef_.tolist(),
    "intercept" : float(model.intercept_),
    "scaling"   : {
        "mean"  : scaler.mean_.tolist(),
        "scale" : scaler.scale_.tolist(),
    },
    "teams"     : team_snapshots,
    "metrics"   : {
        "mae"                  : round(mae, 4),
        "rmse"                 : round(rmse, 4),
        "directional_accuracy" : round(dir_acc, 4),
        "residual_std"         : round(residual_std, 4),
        "test_n"               : int(len(y_test)),
    },
    "test_points": test_points,
}

with open(MODEL_PATH, "w") as f:
    json.dump(model_data, f, indent=2)

# Also copy into frontend/public/ so Vite dev server serves it automatically
FRONTEND_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(FRONTEND_MODEL_PATH, "w") as f:
    json.dump(model_data, f, indent=2)

print(f"\n[3] model.json saved → {MODEL_PATH}")
print(f"    Also copied  → {FRONTEND_MODEL_PATH}")
print(f"    Teams with snapshots : {len(team_snapshots)}")
print(f"    Test points stored   : {len(test_points):,}")

print("\n" + "═" * 60)
print("  PHASE 2 COMPLETE")
print("  ─ Review metrics above — are they honest and reasonable?")
print("  ─ Confirm before Phase 3 (frontend) begins.")
print("═" * 60)

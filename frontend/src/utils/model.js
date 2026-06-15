/**
 * model.js — JavaScript re-implementation of the trained linear regression.
 *
 * The model was trained in Python with sklearn.LinearRegression + StandardScaler.
 * To reproduce a prediction here we:
 *   1. Build raw feature differences (home minus away team stats)
 *   2. Apply the same StandardScaler (subtract mean, divide by scale)
 *   3. Compute the linear combination: intercept + Σ(coef_i × scaled_i)
 *
 * This is deliberately identical maths to the Python model — no rounding tricks.
 */

// Default stats for teams with insufficient historical data
const DEFAULT_STATS = { form: 0.5, scored: 1.0, conceded: 1.0, strength: 0.0 };

/**
 * Predict the goal difference for a match (home_goals - away_goals).
 * A positive value means the "home" team is predicted to win.
 * For World Cup simulations all matches are on neutral ground (isNeutral=true).
 *
 * @param {string} homeTeam - team name
 * @param {string} awayTeam - team name
 * @param {boolean} isNeutral - 1 if neutral venue, 0 otherwise
 * @param {object} model - loaded model.json
 * @returns {number} predicted goal difference
 */
export function predictGoalDiff(homeTeam, awayTeam, isNeutral, model) {
  const home = model.teams[homeTeam] || DEFAULT_STATS;
  const away = model.teams[awayTeam] || DEFAULT_STATS;

  // Raw feature vector: difference between home and away team stats
  // Order matches training: [form_diff, scored_diff, conceded_diff, strength_diff, neutral]
  const raw = [
    home.form     - away.form,       // form_diff:      win-rate advantage
    home.scored   - away.scored,     // scored_diff:    attacking edge
    home.conceded - away.conceded,   // conceded_diff:  defensive edge (higher = concedes more)
    home.strength - away.strength,   // strength_diff:  overall goal-diff edge
    isNeutral ? 1 : 0,               // neutral:        removes home-field advantage
  ];

  // Apply StandardScaler: (x - mean) / scale
  // This ensures each feature is on the same scale as during training
  const scaled = raw.map(
    (x, i) => (x - model.scaling.mean[i]) / model.scaling.scale[i]
  );

  // Linear regression: predicted_y = intercept + Σ(coef_i × scaled_i)
  const goalDiff =
    model.intercept +
    scaled.reduce((sum, x, i) => sum + x * model.coef[i], 0);

  return goalDiff;
}

/**
 * Convert a predicted goal difference into a plausible scoreline.
 * Average goals per team in international football ≈ 1.2.
 * We split the difference symmetrically around that base.
 *
 * @param {number} goalDiff - predicted home_goals - away_goals
 * @returns {{ homeGoals: number, awayGoals: number }}
 */
export function deriveScoreline(goalDiff) {
  const BASE = 1.2;
  const homeGoals = Math.max(0, Math.round(BASE + goalDiff / 2));
  const awayGoals = Math.max(0, Math.round(BASE - goalDiff / 2));
  return { homeGoals, awayGoals };
}

/**
 * Sample from a standard Gaussian distribution using Box-Muller transform.
 * Used to add noise to predictions during the Monte Carlo tournament simulation.
 */
export function gaussianRandom(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

/**
 * tournament.js — 2026 FIFA World Cup structure + Monte Carlo simulation.
 *
 * Format:
 *   Group stage: 12 groups of 4 teams; each team plays the other 3.
 *   Advancement: Top 2 from each group (24) + 8 best 3rd-place teams = 32.
 *   Knockout: Round of 32 → Round of 16 → Quarterfinals → Semifinals → Final.
 *
 * The bracket is seeded but simplified here: after selecting 32 teams we run
 * a straightforward single-elimination bracket. The goal is champion-probability
 * estimation, not exact match scheduling.
 *
 * All World Cup matches are on neutral ground — we pass isNeutral=true to
 * predictGoalDiff. Gaussian noise is added to each prediction to model upsets.
 */

import { predictGoalDiff, gaussianRandom } from './model.js';

// ── 2026 World Cup 48-team group draw ──────────────────────────────────────────
// Official groups from the FIFA draw held Dec 5, 2025 at Kennedy Center, Washington DC.
export const GROUPS_2026 = {
  A: ['Mexico',       'South Africa',           'South Korea', 'Czechia'],
  B: ['Canada',       'Bosnia and Herzegovina', 'Qatar',       'Switzerland'],
  C: ['Brazil',       'Morocco',                'Haiti',       'Scotland'],
  D: ['United States','Paraguay',               'Australia',   'Turkey'],
  E: ['Germany',      'Curacao',                'Ivory Coast', 'Ecuador'],
  F: ['Netherlands',  'Japan',                  'Sweden',      'Tunisia'],
  G: ['Belgium',      'Egypt',                  'Iran',        'New Zealand'],
  H: ['Spain',        'Cape Verde',             'Saudi Arabia','Uruguay'],
  I: ['France',       'Senegal',                'Iraq',        'Norway'],
  J: ['Argentina',    'Algeria',                'Austria',     'Jordan'],
  K: ['Portugal',     'DR Congo',               'Uzbekistan',  'Colombia'],
  L: ['England',      'Croatia',                'Ghana',       'Panama'],
};

// Noise standard deviation = model RMSE (~1.98 goals).
// Adding this noise to each prediction gives realistic upset probability.
const NOISE_STD = 1.98;

/**
 * Simulate a single match and return the winning team.
 * In knockout rounds a draw is broken by a coin flip (penalty shootout proxy).
 *
 * @param {string} teamA - treated as "home" for feature construction
 * @param {string} teamB - treated as "away"
 * @param {object} model - loaded model.json
 * @param {boolean} mustDecide - if true (knockout), no draws allowed
 * @returns {{ winner: string|null, goalDiff: number }}
 *   goalDiff > 0 means teamA won; goalDiff === 0 (group) means draw
 */
function simulateMatch(teamA, teamB, model, mustDecide = false) {
  // Predict goal diff and add Gaussian noise to model uncertainty / upsets
  const rawPred  = predictGoalDiff(teamA, teamB, true, model);
  const noisyDiff = rawPred + gaussianRandom(0, NOISE_STD);

  if (mustDecide && Math.abs(noisyDiff) < 0.05) {
    // Very close — flip a coin (penalty shootout)
    return { winner: Math.random() < 0.5 ? teamA : teamB, goalDiff: noisyDiff };
  }

  const winner = noisyDiff > 0 ? teamA : noisyDiff < 0 ? teamB : null;
  return { winner, goalDiff: noisyDiff };
}

/**
 * Simulate the group stage for all 12 groups.
 * Each team plays the other 3 in its group (round-robin, 6 matches per group).
 * Returns an object mapping group letter → array of team records sorted by:
 *   1. Points (win=3, draw=1, loss=0)
 *   2. Goal difference
 *   3. Goals scored
 */
function simulateGroups(model) {
  const groupResults = {};

  for (const [letter, teams] of Object.entries(GROUPS_2026)) {
    // Initialise records
    const record = {};
    for (const t of teams) {
      record[t] = { team: t, pts: 0, gd: 0, gf: 0, ga: 0, group: letter };
    }

    // Every pair plays once
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const { winner, goalDiff } = simulateMatch(teams[i], teams[j], model, false);

        const gHomeGoals = Math.max(0, Math.round(1.2 + goalDiff / 2));
        const gAwayGoals = Math.max(0, Math.round(1.2 - goalDiff / 2));

        record[teams[i]].gf += gHomeGoals;
        record[teams[i]].ga += gAwayGoals;
        record[teams[i]].gd += gHomeGoals - gAwayGoals;

        record[teams[j]].gf += gAwayGoals;
        record[teams[j]].ga += gHomeGoals;
        record[teams[j]].gd += gAwayGoals - gHomeGoals;

        if (winner === teams[i]) {
          record[teams[i]].pts += 3;
        } else if (winner === teams[j]) {
          record[teams[j]].pts += 3;
        } else {
          // Draw
          record[teams[i]].pts += 1;
          record[teams[j]].pts += 1;
        }
      }
    }

    // Sort: points → goal difference → goals for
    const sorted = Object.values(record).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
    );
    groupResults[letter] = sorted;
  }

  return groupResults;
}

/**
 * Select the 32 teams that advance to the knockout stage.
 * Rule: top 2 from each group (24 teams) + 8 best 3rd-place teams.
 */
function selectKnockoutTeams(groupResults) {
  const qualifiers = [];
  const thirdPlace = [];

  for (const sorted of Object.values(groupResults)) {
    qualifiers.push(sorted[0], sorted[1]);   // 1st and 2nd
    thirdPlace.push(sorted[2]);              // 3rd place
  }

  // Sort 3rd-place teams by points → goal diff → goals for, take best 8
  thirdPlace.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  qualifiers.push(...thirdPlace.slice(0, 8));

  return qualifiers.map(r => r.team);
}

/**
 * Simulate a full knockout bracket from a list of 32 teams.
 * Teams are paired sequentially [0 vs 1, 2 vs 3, ...] for simplicity.
 * Returns the champion team name.
 */
function simulateKnockout(teams, model) {
  let remaining = [...teams];

  // Shuffle once at the start to avoid deterministic pairing bias across sims
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // Knockout rounds: 32 → 16 → 8 → 4 → 2 → 1
  while (remaining.length > 1) {
    const nextRound = [];
    for (let i = 0; i < remaining.length; i += 2) {
      const { winner } = simulateMatch(remaining[i], remaining[i + 1], model, true);
      nextRound.push(winner);
    }
    remaining = nextRound;
  }

  return remaining[0];
}

/**
 * Run the full Monte Carlo simulation of the 2026 World Cup.
 *
 * @param {object} model - loaded model.json
 * @param {number} n - number of simulations (default 10,000)
 * @returns {Array<{ team: string, probability: number, count: number }>}
 *   sorted by probability descending
 */
export function simulateTournament(model, n = 10000) {
  const champCount = {};

  for (let sim = 0; sim < n; sim++) {
    // 1. Simulate group stage
    const groupResults = simulateGroups(model);

    // 2. Select 32 knockout teams
    const knockoutTeams = selectKnockoutTeams(groupResults);

    // 3. Simulate single-elimination bracket
    const champion = simulateKnockout(knockoutTeams, model);

    champCount[champion] = (champCount[champion] || 0) + 1;
  }

  // Build sorted result array
  return Object.entries(champCount)
    .map(([team, count]) => ({
      team,
      count,
      probability: (count / n) * 100,
    }))
    .sort((a, b) => b.probability - a.probability);
}

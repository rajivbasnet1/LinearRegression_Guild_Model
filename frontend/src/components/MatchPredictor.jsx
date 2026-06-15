import { useState } from 'react';
import { predictGoalDiff, deriveScoreline, explainPrediction } from '../utils/model.js';

export default function MatchPredictor({ model }) {
  const teams = Object.keys(model.teams).sort();

  const [homeTeam,   setHomeTeam]   = useState(teams[0] || '');
  const [awayTeam,   setAwayTeam]   = useState(teams[1] || '');
  const [isNeutral,  setIsNeutral]  = useState(true);

  const goalDiff = homeTeam && awayTeam && homeTeam !== awayTeam
    ? predictGoalDiff(homeTeam, awayTeam, isNeutral, model)
    : null;

  const scoreline = goalDiff !== null ? deriveScoreline(goalDiff) : null;

  const winner =
    goalDiff === null  ? null
    : goalDiff >  0.05 ? homeTeam
    : goalDiff < -0.05 ? awayTeam
    : 'Draw';

  const contributions  = goalDiff !== null && homeTeam !== awayTeam
    ? explainPrediction(homeTeam, awayTeam, isNeutral, model)
    : [];
  const residualStd = model.metrics?.residual_std ?? null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-ink">Match Predictor</h2>
        <p className="text-dim text-sm mt-1">
          Goal difference is predicted by linear regression on rolling 10-match stats.
          All arithmetic runs in the browser from the saved coefficients.
        </p>
      </div>

      {/* Team pickers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-ghost">Home team</label>
          <select value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="field">
            {teams.map(t => (
              <option key={t} value={t}>
                {t}{model.teams[t]?.elo ? ` (ELO ${Math.round(model.teams[t].elo)})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="pb-2 text-dim text-sm font-medium">vs</div>

        <div className="space-y-1.5">
          <label className="text-xs text-ghost">Away team</label>
          <select value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="field">
            {teams.map(t => (
              <option key={t} value={t}>
                {t}{model.teams[t]?.elo ? ` (ELO ${Math.round(model.teams[t].elo)})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer w-fit">
        <input type="checkbox" checked={isNeutral}
               onChange={e => setIsNeutral(e.target.checked)}
               className="w-3.5 h-3.5 accent-amber" />
        <span className="text-dim text-sm">Neutral venue</span>
        <span className="text-ghost text-xs">(removes home-field factor)</span>
      </label>

      {homeTeam === awayTeam && (
        <p className="text-out text-sm">Select two different teams.</p>
      )}

      {/* Result */}
      {goalDiff !== null && homeTeam !== awayTeam && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="panel p-5 text-center">
              <p className="text-xs text-ghost mb-3">Scoreline</p>
              <p className="text-3xl font-semibold text-ink font-mono">
                {scoreline.homeGoals}–{scoreline.awayGoals}
              </p>
              <p className="text-xs text-ghost mt-2">{homeTeam} / {awayTeam}</p>
            </div>

            <div className="panel p-5 text-center">
              <p className="text-xs text-ghost mb-3">Goal difference</p>
              <p className={`text-3xl font-semibold font-mono ${goalDiff >= 0 ? 'text-win' : 'text-out'}`}>
                {goalDiff >= 0 ? '+' : ''}{goalDiff.toFixed(2)}
              </p>
              <p className="text-xs text-ghost mt-2">positive = home wins</p>
            </div>

            <div className="panel p-5 text-center">
              <p className="text-xs text-ghost mb-3">Predicted winner</p>
              <p className={`text-lg font-semibold ${
                winner === homeTeam ? 'text-win' :
                winner === awayTeam ? 'text-out' : 'text-amber'
              }`}>{winner}</p>
              <p className="text-xs text-ghost mt-2">
                {Math.abs(goalDiff) < 0.5 ? 'Very tight' :
                 Math.abs(goalDiff) < 1.5 ? 'Moderate edge' : 'Clear favourite'}
              </p>
            </div>
          </div>

          {/* Confidence interval */}
          {residualStd !== null && (
            <p className="text-center text-sm text-dim font-mono mt-1">
              <span className={goalDiff >= 0 ? 'text-win' : 'text-out'}>
                {goalDiff >= 0 ? '+' : ''}{goalDiff.toFixed(2)}
              </span>
              {' '}±{' '}
              <span className="text-ink">{residualStd.toFixed(1)}</span>
              {' '}goals
            </p>
          )}
        </div>
      )}

      {/* Contribution breakdown */}
      {contributions.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-medium text-ink">Prediction breakdown</p>
            <p className="text-xs text-ghost mt-0.5">
              Each factor's contribution to the goal difference prediction
            </p>
          </div>
          <div className="divide-y divide-line">
            {contributions.map(({ feature, label, contribution }) => {
              const isPos  = contribution >= 0;
              const maxAbs = Math.max(...contributions.map(c => Math.abs(c.contribution)));
              const width  = maxAbs > 0 ? (Math.abs(contribution) / maxAbs) * 100 : 0;
              return (
                <div key={feature} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-sm text-dim w-32 flex-shrink-0">{label}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-subtle">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          background: isPos ? 'oklch(0.62 0.08 148)' : 'oklch(0.60 0.08 22)',
                        }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-mono w-12 text-right flex-shrink-0 ${
                    isPos ? 'text-win' : 'text-out'
                  }`}>
                    {isPos ? '+' : ''}{contribution.toFixed(2)}
                  </span>
                </div>
              );
            })}
            <div className="px-4 py-2 flex items-center gap-3 bg-subtle">
              <span className="text-xs text-ghost w-32 flex-shrink-0">Intercept</span>
              <div className="flex-1" />
              <span className="text-xs font-mono w-12 text-right text-ghost">
                {model.intercept >= 0 ? '+' : ''}{model.intercept.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Feature table */}
      {goalDiff !== null && homeTeam !== awayTeam && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-medium text-ink">Feature breakdown</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-2 text-left text-xs text-ghost font-medium">Stat</th>
                <th className="px-4 py-2 text-right text-xs text-ghost font-medium">{homeTeam}</th>
                <th className="px-4 py-2 text-right text-xs text-ghost font-medium">{awayTeam}</th>
                <th className="px-4 py-2 text-right text-xs text-ghost font-medium">Diff (H−A)</th>
              </tr>
            </thead>
            <tbody>
              {['form','scored','conceded','strength'].map(stat => {
                const h    = (model.teams[homeTeam] || {})[stat] ?? 0;
                const a    = (model.teams[awayTeam] || {})[stat] ?? 0;
                const diff = h - a;
                return (
                  <tr key={stat} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-dim capitalize">{stat}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">{h.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">{a.toFixed(3)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${diff > 0 ? 'text-win' : diff < 0 ? 'text-out' : 'text-ghost'}`}>
                      {diff >= 0 ? '+' : ''}{diff.toFixed(3)}
                    </td>
                  </tr>
                );
              })}
              {/* Market value row */}
              {(() => {
                const h    = model.teams[homeTeam]?.market_value ?? 0;
                const a    = model.teams[awayTeam]?.market_value ?? 0;
                const diff = h - a;
                return (
                  <tr key="market_value" className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-dim">Market Value</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">€{h.toFixed(0)}M</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">€{a.toFixed(0)}M</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${diff > 0 ? 'text-win' : diff < 0 ? 'text-out' : 'text-ghost'}`}>
                      {diff >= 0 ? '+' : ''}€{diff.toFixed(0)}M
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

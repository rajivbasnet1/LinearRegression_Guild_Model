import { useState } from 'react';
import { simulateTournament, GROUPS_2026 } from '../utils/tournament.js';

export default function TournamentSim({ model }) {
  const [results,  setResults]  = useState(null);
  const [running,  setRunning]  = useState(false);
  const [simCount, setSimCount] = useState(10000);

  function run() {
    setRunning(true);
    setTimeout(() => {
      setResults(simulateTournament(model, simCount));
      setRunning(false);
    }, 50);
  }

  const maxProb = results?.[0]?.probability ?? 1;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-ink">Tournament Simulator</h2>
        <p className="text-dim text-sm mt-1">
          Monte Carlo over the 2026 World Cup 48-team bracket. Gaussian noise (σ = {model.metrics.rmse.toFixed(2)} goals)
          added to each prediction to model upsets. Probabilities stabilise around 5,000 runs.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1.5">
          <label className="text-xs text-ghost">Simulations</label>
          <select value={simCount} onChange={e => setSimCount(Number(e.target.value))} className="field w-auto">
            {[1000,5000,10000,25000].map(n => (
              <option key={n} value={n}>{n.toLocaleString()}</option>
            ))}
          </select>
        </div>
        <button onClick={run} disabled={running} className="btn-primary mt-5">
          {running ? 'Simulating…' : 'Run simulation'}
        </button>
      </div>

      {/* Group reference */}
      <details className="panel">
        <summary className="cursor-pointer px-4 py-3 text-sm text-ink font-medium select-none list-none flex justify-between">
          <span>2026 Group Draw</span>
          <span className="text-ghost text-xs">expand</span>
        </summary>
        <div className="border-t border-line px-4 py-4 grid grid-cols-3 md:grid-cols-4 gap-3">
          {Object.entries(GROUPS_2026).map(([letter, teams]) => (
            <div key={letter}>
              <p className="text-2xs text-amber font-semibold mb-1.5">Group {letter}</p>
              {teams.map(t => <p key={t} className="text-xs text-dim leading-5 truncate">{t}</p>)}
            </div>
          ))}
        </div>
      </details>

      {/* Results */}
      {results && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-medium text-ink">
              Champion probability
              <span className="text-ghost font-normal ml-2">{simCount.toLocaleString()} simulations</span>
            </p>
          </div>
          <div className="divide-y divide-line max-h-[520px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={r.team} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-ghost font-mono w-5 text-right flex-shrink-0">{i + 1}</span>
                <span className="text-sm text-ink w-36 flex-shrink-0 truncate">{r.team}</span>
                <div className="prob-bar-track flex-1">
                  <div
                    className="prob-bar-fill"
                    style={{
                      width: `${(r.probability / maxProb) * 100}%`,
                      background: i === 0
                        ? 'oklch(0.76 0.13 78)'
                        : i < 4
                        ? 'oklch(0.62 0.08 148)'
                        : 'oklch(0.38 0.012 245)',
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-dim w-12 text-right flex-shrink-0">
                  {r.probability.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

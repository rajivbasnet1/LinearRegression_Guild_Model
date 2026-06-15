import { useState, useEffect } from 'react';
import MatchPredictor from './components/MatchPredictor.jsx';
import CoeffChart     from './components/CoeffChart.jsx';
import TournamentSim  from './components/TournamentSim.jsx';
import ScatterPlot    from './components/ScatterPlot.jsx';
import CustomBracket  from './components/CustomBracket.jsx';

const TABS = [
  { id: 'predict',    label: 'Match Predictor' },
  { id: 'bracket',    label: 'Bracket'         },
  { id: 'tournament', label: 'Tournament Sim'  },
  { id: 'coeff',      label: 'Coefficients'    },
  { id: 'accuracy',   label: 'Accuracy'        },
];

export default function App() {
  const [model,     setModel]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState('predict');

  useEffect(() => {
    fetch('/model.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — is model.json in frontend/public/?`);
        return r.json();
      })
      .then(data => { setModel(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-dim text-sm">Loading model…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="panel p-6 max-w-md">
        <p className="text-out font-medium mb-1">Could not load model.json</p>
        <p className="text-dim text-sm mb-4">{error}</p>
        <ol className="text-dim text-sm space-y-1 list-decimal list-inside">
          <li>Run <code className="font-mono text-ink bg-subtle px-1 rounded">python train.py</code> in the repo root</li>
          <li>Restart <code className="font-mono text-ink bg-subtle px-1 rounded">npm run dev</code></li>
        </ol>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* World Cup header */}
      <header className="relative overflow-hidden bg-surface border-b border-line">
        {/* Pitch-circle watermarks */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-[0.035]"
               style={{ border: '28px solid oklch(0.52 0.14 145)' }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-[0.06]"
               style={{ background: 'oklch(0.52 0.14 145)' }} />
        </div>
        <div className="relative max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl"
                 style={{ background: 'oklch(0.19 0.05 145 / 0.5)', border: '1px solid oklch(0.35 0.09 145 / 0.4)' }}>
              ⚽
            </div>
            <div>
              <p className="text-ink font-semibold text-md leading-tight">FIFA World Cup 2026</p>
              <p className="text-ghost text-xs">Linear Regression Predictor · USA · Canada · Mexico</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-dim text-xs font-mono">
              MAE {model.metrics.mae.toFixed(2)} goals &nbsp;·&nbsp;
              {(model.metrics.directional_accuracy * 100).toFixed(1)}% directional accuracy
            </p>
            <p className="text-ghost text-2xs">{Object.keys(model.teams).length} teams · sklearn LinearRegression</p>
          </div>
        </div>
        {/* Thin pitch-green accent line at bottom */}
        <div className="pitch-accent" />
      </header>

      {/* Tab bar */}
      <nav className="bg-surface border-b border-line px-6">
        <div className="max-w-screen-xl mx-auto flex">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab ${activeTab === t.id ? 'tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
        {activeTab === 'predict'    && <MatchPredictor model={model} />}
        {activeTab === 'bracket'    && <CustomBracket  model={model} />}
        {activeTab === 'tournament' && <TournamentSim  model={model} />}
        {activeTab === 'coeff'      && <CoeffChart     model={model} />}
        {activeTab === 'accuracy'   && <ScatterPlot    model={model} />}
      </main>

      <footer className="border-t border-line px-6 py-3 text-center text-2xs text-ghost">
        ML Guild 2026 · LinearRegression · Training data: Kaggle international football results 1872–2026
      </footer>
    </div>
  );
}

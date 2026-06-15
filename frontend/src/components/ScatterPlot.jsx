import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

function reservoir(points, n) {
  if (points.length <= n) return points;
  const r = points.slice(0, n);
  for (let i = n; i < points.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < n) r[j] = points[i];
  }
  return r;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="panel px-3 py-2 text-xs shadow-lg">
      <p className="text-dim">Predicted <span className="text-ink font-mono">{d.pred.toFixed(2)}</span></p>
      <p className="text-dim">Actual <span className="text-ink font-mono">{d.actual}</span></p>
      <p className="text-ghost">Error {(d.pred - d.actual).toFixed(2)}</p>
    </div>
  );
};

export default function ScatterPlot({ model }) {
  const sample = useMemo(() => reservoir(model.test_points, 2000), [model]);
  const m      = model.metrics;
  const RANGE  = [-10, 10];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-ink">Model Accuracy</h2>
        <p className="text-dim text-sm mt-1">
          Predicted vs actual goal difference on the test set (2016–2026, n = {m.test_n.toLocaleString()}).
          Points on the dashed diagonal are perfectly predicted. The spread shows inherent football noise.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'MAE',          value:m.mae.toFixed(3),                        unit:'goals', note:'Average error' },
          { label:'RMSE',         value:m.rmse.toFixed(3),                       unit:'goals', note:'Penalises large errors' },
          { label:'Win accuracy', value:(m.directional_accuracy*100).toFixed(1), unit:'%',     note:'Correct winner' },
        ].map(item => (
          <div key={item.label} className="panel px-4 py-3">
            <p className="text-xs text-ghost mb-1">{item.label}</p>
            <p className="text-lg font-semibold text-ink font-mono">
              {item.value}<span className="text-dim text-sm font-sans ml-0.5">{item.unit}</span>
            </p>
            <p className="text-xs text-ghost mt-1">{item.note}</p>
          </div>
        ))}
      </div>

      {/* Scatter */}
      <div className="panel p-5">
        <p className="text-sm font-medium text-ink mb-0.5">
          Predicted vs actual goal difference
        </p>
        <p className="text-xs text-ghost mb-4">
          Random sample of 2,000 from {m.test_n.toLocaleString()} test matches
        </p>
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top:16, right:16, bottom:32, left:32 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="oklch(0.26 0.022 248)" />
            <XAxis
              type="number" dataKey="pred" name="Predicted"
              domain={RANGE}
              label={{ value:'Predicted goal diff', position:'insideBottom', offset:-16,
                       fill:'oklch(0.60 0.010 245)', fontSize:11 }}
              tick={{ fill:'oklch(0.60 0.010 245)', fontSize:11 }}
              tickLine={false}
              axisLine={{ stroke:'oklch(0.26 0.022 248)' }}
            />
            <YAxis
              type="number" dataKey="actual" name="Actual"
              domain={RANGE}
              label={{ value:'Actual goal diff', angle:-90, position:'insideLeft',
                       fill:'oklch(0.60 0.010 245)', fontSize:11 }}
              tick={{ fill:'oklch(0.60 0.010 245)', fontSize:11 }}
              tickLine={false}
              axisLine={{ stroke:'oklch(0.26 0.022 248)' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <ReferenceLine
              segment={[{ x:RANGE[0], y:RANGE[0] },{ x:RANGE[1], y:RANGE[1] }]}
              stroke="oklch(0.76 0.13 78)" strokeDasharray="5 4" strokeWidth={1.5}
            />
            <Scatter data={sample} fill="oklch(0.62 0.07 228)" fillOpacity={0.30} r={2} />
          </ScatterChart>
        </ResponsiveContainer>
        <p className="text-xs text-ghost mt-3">
          The cluster near zero reflects football's low-scoring nature. Linear regression compresses
          variance — predicted values span a narrower range than actual results, which is expected.
        </p>
      </div>
    </div>
  );
}

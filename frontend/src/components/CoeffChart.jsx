import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

const LABELS = {
  form_diff:     'Win rate (last 10)',
  scored_diff:   'Goals scored avg',
  conceded_diff: 'Goals conceded avg',
  strength_diff: 'Avg goal diff',
  neutral:       'Neutral venue',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="panel px-3 py-2.5 text-xs shadow-lg">
      <p className="text-ink font-medium mb-1">{LABELS[d.feature] || d.feature}</p>
      <p className={`font-mono ${d.coef >= 0 ? 'text-win' : 'text-out'}`}>
        {d.coef >= 0 ? '+' : ''}{d.coef.toFixed(4)}
      </p>
      <p className="text-ghost mt-1">{d.coef >= 0 ? 'Home-team edge' : 'Away-team / neutral effect'}</p>
    </div>
  );
};

export default function CoeffChart({ model }) {
  const data = model.features
    .map((f, i) => ({ feature: f, coef: model.coef[i] }))
    .sort((a, b) => Math.abs(b.coef) - Math.abs(a.coef));

  const m = model.metrics;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-ink">Model Coefficients</h2>
        <p className="text-dim text-sm mt-1">
          Features are standardised (StandardScaler), so bar lengths compare directly.
          Longer bar = stronger influence on predicted goal difference.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'MAE',          value: m.mae.toFixed(3),                          unit:'goals' },
          { label: 'RMSE',         value: m.rmse.toFixed(3),                         unit:'goals' },
          { label: 'Win accuracy', value: (m.directional_accuracy*100).toFixed(1),   unit:'%'     },
          { label: 'Test matches', value: m.test_n.toLocaleString(),                  unit:''      },
        ].map(item => (
          <div key={item.label} className="panel px-4 py-3">
            <p className="text-xs text-ghost mb-1">{item.label}</p>
            <p className="text-lg font-semibold text-ink font-mono">
              {item.value}<span className="text-dim text-sm font-sans ml-0.5">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="panel p-5">
        <p className="text-sm font-medium text-ink mb-4">Feature importance by coefficient magnitude</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ top:0, right:32, left:160, bottom:0 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="oklch(0.26 0.022 248)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill:'oklch(0.60 0.010 245)', fontSize:11 }}
              tickLine={false}
              axisLine={{ stroke:'oklch(0.26 0.022 248)' }}
            />
            <YAxis
              type="category"
              dataKey="feature"
              tickFormatter={f => LABELS[f] || f}
              tick={{ fill:'oklch(0.60 0.010 245)', fontSize:11 }}
              tickLine={false}
              axisLine={false}
              width={155}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill:'oklch(0.22 0.018 248)' }} />
            <ReferenceLine x={0} stroke="oklch(0.38 0.012 245)" strokeDasharray="3 3" />
            <Bar dataKey="coef" radius={[0, 3, 3, 0]}>
              {data.map(d => (
                <Cell key={d.feature}
                      fill={d.coef >= 0 ? 'oklch(0.62 0.08 148)' : 'oklch(0.60 0.08 22)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-3 text-xs text-ghost">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{background:'oklch(0.62 0.08 148)'}} />
            Home-team advantage
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{background:'oklch(0.60 0.08 22)'}} />
            Away-team or neutral effect
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <p className="text-sm font-medium text-ink">Coefficient table</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-2 text-left text-xs text-ghost font-medium">Feature</th>
              <th className="px-4 py-2 text-right text-xs text-ghost font-medium">Coefficient</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="px-4 py-2.5 text-dim">Intercept</td>
              <td className="px-4 py-2.5 text-right font-mono text-ink">
                {model.intercept >= 0 ? '+' : ''}{model.intercept.toFixed(4)}
              </td>
            </tr>
            {data.map(d => (
              <tr key={d.feature} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-dim">{LABELS[d.feature] || d.feature}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${d.coef >= 0 ? 'text-win' : 'text-out'}`}>
                  {d.coef >= 0 ? '+' : ''}{d.coef.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-ghost border-t border-line">
          Intercept ({model.intercept.toFixed(4)}) reflects average home-team advantage across all training matches.
        </p>
      </div>
    </div>
  );
}

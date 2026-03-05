import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { WaterfallResult } from '../types';

interface Props {
  result: WaterfallResult;
}

const SERIES_COLORS: Record<string, string> = {
  'Senior Debt': '#dc2626',
  SAFE: '#d97706',
  Preferred: '#7c3aed',
  Common: '#2563eb',
  Options: '#059669',
  Warrants: '#0891b2',
  Remaining: '#94a3b8',
};

const fmtFull = (n: number): string =>
  '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

interface WaterfallBar {
  name: string;
  type: string;
  base: number;
  value: number;
  total: number;
}

export default function WaterfallFlow({ result }: Props) {
  const [selectedValIdx, setSelectedValIdx] = useState(
    result.valuations.length > 1 ? Math.floor(result.valuations.length / 2) : 0
  );

  const valuation = result.valuations[selectedValIdx];

  // Build waterfall bars: each series takes from the remaining pool
  const bars = useMemo(() => {
    // Aggregate by instrument type at selected valuation
    const byType = new Map<string, number>();
    const typeOrder: string[] = [];
    for (const row of result.aggregated) {
      const amt = row.amounts[selectedValIdx];
      const existing = byType.get(row.instrumentType);
      if (existing !== undefined) {
        byType.set(row.instrumentType, existing + amt);
      } else {
        byType.set(row.instrumentType, amt);
        typeOrder.push(row.instrumentType);
      }
    }

    const items: WaterfallBar[] = [];
    let running = valuation;

    // Starting bar - total valuation
    items.push({
      name: 'Total Proceeds',
      type: 'total',
      base: 0,
      value: valuation,
      total: valuation,
    });

    for (const type of typeOrder) {
      const amount = byType.get(type) || 0;
      if (amount <= 0) continue;

      items.push({
        name: type,
        type,
        base: running - amount,
        value: amount,
        total: running - amount,
      });

      running -= amount;
    }

    // Show remaining if any
    if (running > 0.01) {
      items.push({
        name: 'Remaining',
        type: 'Remaining',
        base: 0,
        value: running,
        total: running,
      });
    }

    return items;
  }, [result, selectedValIdx, valuation]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload as WaterfallBar;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-800">{data.name}</p>
        <p className="text-sm text-slate-600">
          Amount: <span className="font-mono font-medium">{fmtFull(Math.round(data.value))}</span>
        </p>
        {data.type !== 'total' && data.type !== 'Remaining' && (
          <p className="text-sm text-slate-500">
            {((data.value / valuation) * 100).toFixed(1)}% of proceeds
          </p>
        )}
        {data.type !== 'total' && data.type !== 'Remaining' && (
          <p className="text-xs text-slate-400 mt-1">
            Remaining after: {fmtFull(Math.round(data.total))}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Valuation selector */}
      {result.valuations.length > 1 && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700">Select valuation:</label>
          <input
            type="range"
            min={0}
            max={result.valuations.length - 1}
            value={selectedValIdx}
            onChange={(e) => setSelectedValIdx(+e.target.value)}
            className="flex-1 max-w-md"
          />
          <span className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 font-mono">
            {fmt(valuation)}
          </span>
        </div>
      )}

      {/* Waterfall chart */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          Proceeds Waterfall at {fmt(valuation)}
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          Shows how total proceeds flow through the priority stack, from most senior to most junior.
        </p>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={bars} barSize={60}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip content={<CustomTooltip />} />
            {/* Invisible base */}
            <Bar dataKey="base" stackId="waterfall" fill="transparent" />
            {/* Visible value */}
            <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {bars.map((bar, i) => (
                <Cell
                  key={i}
                  fill={bar.type === 'total' ? '#334155' : (SERIES_COLORS[bar.type] || '#94a3b8')}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Flow breakdown cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {bars
          .filter((b) => b.type !== 'total' && b.type !== 'Remaining')
          .map((bar) => (
            <div
              key={bar.name}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[bar.type] || '#94a3b8' }}
                />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {bar.name}
                </span>
              </div>
              <p className="text-lg font-bold font-mono text-slate-800">
                {fmtFull(Math.round(bar.value))}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {((bar.value / valuation) * 100).toFixed(1)}% of total
              </p>
            </div>
          ))}
      </div>

      {/* Flow table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Series
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amount Received
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                % of Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Remaining After
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bars
              .filter((b) => b.type !== 'total')
              .map((bar, i) => (
                <tr key={bar.name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 font-mono">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: SERIES_COLORS[bar.type] || '#94a3b8' }}
                      />
                      {bar.name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {fmtFull(Math.round(bar.value))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                    {((bar.value / valuation) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                    {fmtFull(Math.round(bar.total))}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

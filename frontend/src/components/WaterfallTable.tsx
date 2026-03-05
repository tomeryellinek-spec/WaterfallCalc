import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Download } from 'lucide-react';
import type { WaterfallResult } from '../types';
import { exportToExcel } from '../utils/export';

interface Props {
  result: WaterfallResult;
}

const COLORS = [
  '#1e40af', '#dc2626', '#059669', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5',
];

const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtFull = (n: number): string =>
  '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function WaterfallTable({ result }: Props) {
  const [viewMode, setViewMode] = useState<'amount' | 'percent'>('amount');

  // Aggregate by stakeholder for chart
  const stakeholderData = useMemo(() => {
    const byStakeholder = new Map<string, number[]>();
    for (const row of result.aggregated) {
      const existing = byStakeholder.get(row.stakeholderName);
      if (existing) {
        for (let i = 0; i < row.amounts.length; i++) existing[i] += row.amounts[i];
      } else {
        byStakeholder.set(row.stakeholderName, [...row.amounts]);
      }
    }
    return byStakeholder;
  }, [result]);

  const chartData = useMemo(() => {
    return result.valuations.map((v, vi) => {
      const point: Record<string, number> = { valuation: v };
      for (const [name, amounts] of stakeholderData) {
        point[name] = Math.round(amounts[vi]);
      }
      return point;
    });
  }, [result, stakeholderData]);

  const stakeholderNames = useMemo(() => Array.from(stakeholderData.keys()), [stakeholderData]);

  const totals = useMemo(
    () =>
      result.valuations.map((_, vi) =>
        result.aggregated.reduce((sum, r) => sum + r.amounts[vi], 0)
      ),
    [result]
  );

  // Aggregate by instrument name for summary (breaks out individual preferred series)
  interface SummaryRow {
    type: string;
    label: string;
    amounts: number[];
    converted: (boolean | null)[];
    investmentPPS: number | null;
    considerationPPS: (number | null)[];
    seniority: number;
  }

  const seriesSummary = useMemo(() => {
    const byName = new Map<string, SummaryRow>();
    const nameOrder: string[] = [];

    for (let vi = 0; vi < result.valuations.length; vi++) {
      const v = result.valuations[vi];
      const payouts = result.payoutsByValuation.get(v) || [];
      const conversions = result.conversionsByValuation.get(v) || new Set<string>();
      const metrics = result.seriesMetricsByValuation.get(v) || new Map();

      // Group payouts by instrumentType+instrumentName
      const merged = new Map<string, { type: string; name: string; amount: number }>();
      for (const p of payouts) {
        const isDetailed = p.instrumentType === 'Preferred' || p.instrumentType === 'SAFE';
        const key = isDetailed ? `${p.instrumentType}|||${p.instrumentName}` : p.instrumentType;
        const label = isDetailed ? p.instrumentName : p.instrumentType;
        const existing = merged.get(key);
        if (existing) {
          existing.amount += p.amount;
        } else {
          merged.set(key, { type: p.instrumentType, name: label, amount: p.amount });
        }
      }

      for (const [key, entry] of merged) {
        if (!byName.has(key)) {
          // Look up investment PPS from metrics
          const baseName = entry.name.replace(' (converted)', '').replace(' (participation)', '');
          const m = metrics.get(baseName);
          const investmentPPS = m && (entry.type === 'Preferred' || entry.type === 'SAFE') ? m.investmentPPS : null;

          byName.set(key, {
            type: entry.type,
            label: entry.name,
            amounts: new Array(result.valuations.length).fill(0),
            converted: new Array(result.valuations.length).fill(null),
            investmentPPS,
            considerationPPS: new Array(result.valuations.length).fill(null),
            seniority: m?.seniority ?? 0,
          });
          nameOrder.push(key);
        }
        const row = byName.get(key)!;
        row.amounts[vi] = entry.amount;

        // Conversion status
        if (entry.type === 'Preferred' || entry.type === 'SAFE') {
          const baseName = entry.name.replace(' (converted)', '').replace(' (participation)', '');
          row.converted[vi] = conversions.has(baseName);

          // Consideration PPS = total payout / total shares
          const m = metrics.get(baseName);
          if (m && m.totalShares > 0) {
            row.considerationPPS[vi] = entry.amount / m.totalShares;
          }
        }
      }
    }

    const typeWeight: Record<string, number> = {
      'Senior Debt': 0, SAFE: 10, Preferred: 20, Common: 900, Options: 910, Warrants: 920,
    };
    return nameOrder
      .map((key) => byName.get(key)!)
      .sort((a, b) => {
        const aWeight = (typeWeight[a.type] ?? 500) + a.seniority;
        const bWeight = (typeWeight[b.type] ?? 500) + b.seniority;
        return aWeight - bWeight;
      });
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('amount')}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              viewMode === 'amount'
                ? 'bg-blue-900/50 text-blue-300'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Amounts
          </button>
          <button
            onClick={() => setViewMode('percent')}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              viewMode === 'percent'
                ? 'bg-blue-900/50 text-blue-300'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Percentages
          </button>
        </div>
        <button
          onClick={() => exportToExcel(result)}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </button>
      </div>

      {/* Chart */}
      {result.valuations.length > 1 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-200">
            Proceeds Distribution by Valuation
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="valuation"
                tickFormatter={fmt}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
              />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                formatter={(value: number) => fmtFull(value)}
                labelFormatter={(label: number) => `Valuation: ${fmt(label)}`}
              />
              <Legend />
              {stakeholderNames.map((name, i) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  fill={COLORS[i % COLORS.length]}
                  stroke={COLORS[i % COLORS.length]}
                  fillOpacity={0.7}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary by Series */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800">
              <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Series / Instrument
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                Inv. PPS
              </th>
              {result.valuations.map((v) => (
                <th
                  key={v}
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  {fmt(v)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {seriesSummary.map((row, ri) => (
              <tr key={`${row.type}-${row.label}-${ri}`} className="hover:bg-slate-800/50">
                <td className="sticky left-0 z-10 bg-slate-900 px-4 py-2.5 font-medium text-slate-200">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${instrumentColor(row.type)}`}
                  >
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                  {row.investmentPPS !== null
                    ? '$' + row.investmentPPS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                    : '—'}
                </td>
                {row.amounts.map((amt, vi) => (
                  <td key={vi} className="px-4 py-2.5 text-right font-mono text-slate-300">
                    <div>
                      {viewMode === 'amount'
                        ? fmtFull(Math.round(amt))
                        : totals[vi] > 0
                        ? ((amt / totals[vi]) * 100).toFixed(1) + '%'
                        : '0%'}
                    </div>
                    {row.converted[vi] !== null && (
                      <div className={`text-[10px] font-sans mt-0.5 ${
                        row.converted[vi] ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {row.converted[vi] ? 'Converted' : 'Preference'}
                      </div>
                    )}
                    {row.considerationPPS[vi] !== null && (
                      <div className="text-[10px] font-sans mt-0.5 text-slate-500">
                        PPS: ${ row.considerationPPS[vi]!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-900/30 font-semibold">
              <td className="sticky left-0 z-10 bg-blue-900/30 px-4 py-3 text-blue-300">
                Common PPS
              </td>
              <td className="px-4 py-3"></td>
              {result.commonPPS.map((pps, i) => (
                <td key={i} className="px-4 py-3 text-right font-mono text-blue-300">
                  {'$' + pps.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </td>
              ))}
            </tr>
            <tr className="bg-slate-800 font-semibold">
              <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-slate-200">
                TOTAL
              </td>
              <td className="px-4 py-3"></td>
              {totals.map((t, i) => (
                <td key={i} className="px-4 py-3 text-right font-mono text-slate-200">
                  {viewMode === 'amount' ? fmtFull(Math.round(t)) : '100%'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Detailed Table by Owner */}
      <h3 className="text-sm font-semibold text-slate-200">Detail by Stakeholder</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800">
              <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Stakeholder
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Instrument
              </th>
              {result.valuations.map((v) => (
                <th
                  key={v}
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  {fmt(v)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {result.aggregated.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-800/50">
                <td className="sticky left-0 z-10 bg-slate-900 px-4 py-2.5 font-medium text-slate-200">
                  {row.stakeholderName}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      instrumentColor(row.instrumentType)
                    }`}
                  >
                    {row.instrumentType}
                  </span>
                </td>
                {row.amounts.map((amt, vi) => (
                  <td key={vi} className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {viewMode === 'amount'
                      ? fmtFull(Math.round(amt))
                      : totals[vi] > 0
                      ? ((amt / totals[vi]) * 100).toFixed(1) + '%'
                      : '0%'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 font-semibold">
              <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-slate-200">
                TOTAL
              </td>
              <td className="px-4 py-3"></td>
              {totals.map((t, i) => (
                <td key={i} className="px-4 py-3 text-right font-mono text-slate-200">
                  {viewMode === 'amount' ? fmtFull(Math.round(t)) : '100%'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function instrumentColor(type: string): string {
  switch (type) {
    case 'Senior Debt':
      return 'bg-red-900/50 text-red-300';
    case 'SAFE':
      return 'bg-amber-900/50 text-amber-300';
    case 'Preferred':
      return 'bg-purple-900/50 text-purple-300';
    case 'Common':
      return 'bg-blue-900/50 text-blue-300';
    case 'Options':
      return 'bg-emerald-900/50 text-emerald-300';
    case 'Warrants':
      return 'bg-cyan-900/50 text-cyan-300';
    default:
      return 'bg-slate-800 text-slate-300';
  }
}

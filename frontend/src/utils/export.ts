import * as XLSX from 'xlsx';
import type { WaterfallResult } from '../types';

export function exportToExcel(result: WaterfallResult, filename = 'waterfall.xlsx') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Waterfall Summary
  const headers = ['Stakeholder', 'Instrument', ...result.valuations.map((v) => formatCurrency(v))];
  const rows = result.aggregated.map((r) => [
    r.stakeholderName,
    r.instrumentType,
    ...r.amounts.map((a) => Math.round(a * 100) / 100),
  ]);

  // Totals row
  const totals = ['TOTAL', '', ...result.valuations.map((_, vi) =>
    result.aggregated.reduce((sum, r) => sum + r.amounts[vi], 0)
  ).map((t) => Math.round(t * 100) / 100)];
  rows.push(totals);

  // Percentage rows
  rows.push([]);
  rows.push(['--- Percentages ---']);
  const pctHeaders = ['Stakeholder', 'Instrument', ...result.valuations.map((v) => formatCurrency(v))];
  rows.push(pctHeaders);

  for (const r of result.aggregated) {
    const pctRow = [r.stakeholderName, r.instrumentType];
    for (let vi = 0; vi < result.valuations.length; vi++) {
      const total = result.aggregated.reduce((sum, row) => sum + row.amounts[vi], 0);
      const pct = total > 0 ? ((r.amounts[vi] / total) * 100).toFixed(1) + '%' : '0%';
      pctRow.push(pct);
    }
    rows.push(pctRow);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths
  ws['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    ...result.valuations.map(() => ({ wch: 18 })),
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Waterfall');

  // Sheet 2: Per-stakeholder detail
  const stakeholders = new Map<string, { instrumentType: string; amounts: number[] }[]>();
  for (const r of result.aggregated) {
    if (!stakeholders.has(r.stakeholderName)) stakeholders.set(r.stakeholderName, []);
    stakeholders.get(r.stakeholderName)!.push({
      instrumentType: r.instrumentType,
      amounts: r.amounts,
    });
  }

  const detailRows: (string | number)[][] = [
    ['Stakeholder', 'Instrument', ...result.valuations.map((v) => formatCurrency(v))],
  ];

  for (const [name, instruments] of stakeholders) {
    for (const inst of instruments) {
      detailRows.push([name, inst.instrumentType, ...inst.amounts.map((a) => Math.round(a * 100) / 100)]);
    }
    const totalAmounts = result.valuations.map((_, vi) =>
      instruments.reduce((sum, inst) => sum + inst.amounts[vi], 0)
    );
    detailRows.push([`${name} TOTAL`, '', ...totalAmounts.map((t) => Math.round(t * 100) / 100)]);
    detailRows.push([]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
  ws2['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    ...result.valuations.map(() => ({ wch: 18 })),
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Detail');

  XLSX.writeFile(wb, filename);
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

import type {
  CompanyData,
  ValuationConfig,
  StakeholderPayout,
  WaterfallResult,
  AggregatedRow,
  SeriesMetrics,
} from '../types';

export function calculateWaterfall(
  data: CompanyData,
  config: ValuationConfig
): WaterfallResult {
  const valuations = getValuations(config);
  const payoutsByValuation = new Map<number, StakeholderPayout[]>();
  const conversionsByValuation = new Map<number, Set<string>>();
  const seriesMetricsByValuation = new Map<number, Map<string, SeriesMetrics>>();
  const commonPPS: number[] = [];

  for (const v of valuations) {
    const { entries, perShare, convertedNames, seriesMetrics } = calculateAtValuation(data, v, config.transactionCosts);
    payoutsByValuation.set(v, entries);
    conversionsByValuation.set(v, convertedNames);
    seriesMetricsByValuation.set(v, seriesMetrics);
    commonPPS.push(perShare);
  }

  const aggregated = aggregate(valuations, payoutsByValuation);
  return { valuations, payoutsByValuation, aggregated, commonPPS, conversionsByValuation, seriesMetricsByValuation };
}

function getValuations(config: ValuationConfig): number[] {
  if (config.mode === 'single') return [config.singleValuation];
  const vals: number[] = [];
  const step =
    config.steps > 1
      ? (config.maxValuation - config.minValuation) / (config.steps - 1)
      : 0;
  for (let i = 0; i < config.steps; i++) {
    vals.push(config.minValuation + step * i);
  }
  return vals;
}

interface PreferredClass {
  id: string;
  name: string;
  totalShares: number;
  preferencePerShare: number;
  liquidationMultiple: number;
  participation: 'non-participating' | 'participating' | 'capped';
  participationCap: number;
  seniority: number;
  conversionRatio: number;
  holders: { name: string; shares: number }[];
  isSafe: boolean;
  instrumentType: string;
}

function calculateAtValuation(
  data: CompanyData,
  valuation: number,
  txCosts: number
): { entries: StakeholderPayout[]; perShare: number; convertedNames: Set<string>; seriesMetrics: Map<string, SeriesMetrics> } {
  const entries: StakeholderPayout[] = [];
  let remaining = Math.max(0, valuation - txCosts);

  // --- STEP 1: Senior Secured Debt ---
  const debts = [...data.seniorDebts].sort((a, b) => a.seniority - b.seniority);
  for (const d of debts) {
    const prepaymentFee = d.principal * (d.prepaymentFeeRate || 0);
    const owed = d.principal + d.accruedInterest + (d.finalPayment || 0) + prepaymentFee;
    const pmt = Math.min(remaining, owed);
    remaining -= pmt;
    entries.push({
      stakeholderName: d.holderName,
      instrumentType: 'Senior Debt',
      instrumentName: d.name,
      amount: pmt,
    });
  }

  if (remaining <= 0) return { entries, perShare: 0, convertedNames: new Set(), seriesMetrics: new Map() };

  // --- STEP 2: Build combined preferred list (SAFEs + Preferred) ---
  const preFDS = getPreSafeFDS(data);

  const allPreferred: PreferredClass[] = [];

  for (const s of data.safes) {
    const convPrice = getSafeConversionPrice(s, preFDS, valuation);
    const shares = convPrice > 0 ? s.investmentAmount / convPrice : 0;
    allPreferred.push({
      id: `safe-${s.id}`,
      name: `SAFE (${s.investorName})`,
      totalShares: shares,
      preferencePerShare: shares > 0 ? s.investmentAmount / shares : 0,
      liquidationMultiple: 1,
      participation: 'non-participating',
      participationCap: 0,
      seniority: 1,
      conversionRatio: 1,
      holders: [{ name: s.investorName, shares }],
      isSafe: true,
      instrumentType: 'SAFE',
    });
  }

  for (const p of data.preferredShares) {
    const totalShares = p.holders.reduce((sum, h) => sum + h.shares, 0);
    allPreferred.push({
      id: p.id,
      name: p.className,
      totalShares,
      preferencePerShare: p.pricePerShare,
      liquidationMultiple: p.liquidationMultiple,
      participation: p.participation,
      participationCap: p.participationCap,
      seniority: p.seniority,
      conversionRatio: p.conversionRatio,
      holders: p.holders,
      isSafe: false,
      instrumentType: 'Preferred',
    });
  }

  allPreferred.sort((a, b) => a.seniority - b.seniority);

  // --- STEP 3: Pay liquidation preferences ---
  const prefReceived = new Map<string, number>();
  const prefEntryIndices = new Map<string, number[]>();

  for (const pref of allPreferred) {
    const totalPref = pref.totalShares * pref.preferencePerShare * pref.liquidationMultiple;
    const pmt = Math.min(remaining, totalPref);
    remaining -= pmt;
    prefReceived.set(pref.id, pmt);

    const indices: number[] = [];
    for (const h of pref.holders) {
      const holderFrac = pref.totalShares > 0 ? h.shares / pref.totalShares : 0;
      indices.push(entries.length);
      entries.push({
        stakeholderName: h.name,
        instrumentType: pref.instrumentType,
        instrumentName: pref.name,
        amount: pmt * holderFrac,
      });
    }
    prefEntryIndices.set(pref.id, indices);
  }

  if (remaining <= 0) return { entries, perShare: 0, convertedNames: new Set(), seriesMetrics: new Map() };

  // --- STEP 4: Iterative equity distribution ---
  const converters = new Set<string>();

  for (let iter = 0; iter < 10; iter++) {
    let equityPool = remaining;
    let totalEquityShares = 0;

    // Common shares
    for (const c of data.commonShares) {
      for (const h of c.holders) totalEquityShares += h.shares;
    }

    // Preferred classes
    for (const pref of allPreferred) {
      if (converters.has(pref.id)) {
        equityPool += prefReceived.get(pref.id) || 0;
        totalEquityShares += pref.totalShares * pref.conversionRatio;
      } else if (pref.participation !== 'non-participating') {
        totalEquityShares += pref.totalShares * pref.conversionRatio;
      }
    }

    // In-the-money options and warrants
    const perShareEst = totalEquityShares > 0 ? equityPool / totalEquityShares : 0;

    for (const o of data.options) {
      if (perShareEst > o.strikePrice) {
        const vestedShares = o.shares * o.vested;
        totalEquityShares += vestedShares;
        equityPool += vestedShares * o.strikePrice;
      }
    }
    for (const w of data.warrants) {
      if (perShareEst > w.exercisePrice) {
        totalEquityShares += w.shares;
        equityPool += w.shares * w.exercisePrice;
      }
    }

    const perShare = totalEquityShares > 0 ? equityPool / totalEquityShares : 0;

    // Check conversion decisions
    const newConverters = new Set<string>();
    for (const pref of allPreferred) {
      const prefPmt = prefReceived.get(pref.id) || 0;
      const asConverted = perShare * pref.totalShares * pref.conversionRatio;

      if (pref.participation === 'non-participating') {
        if (asConverted > prefPmt) newConverters.add(pref.id);
      } else if (pref.participation === 'capped') {
        const participation = perShare * pref.totalShares * pref.conversionRatio;
        const totalCapped = Math.min(
          prefPmt + participation,
          pref.totalShares * pref.preferencePerShare * pref.participationCap
        );
        if (asConverted > totalCapped) newConverters.add(pref.id);
      }
    }

    if (setsEqual(newConverters, converters)) break;
    converters.clear();
    newConverters.forEach((id) => converters.add(id));
  }

  // --- Final distribution ---
  let equityPool = remaining;
  let totalEquityShares = 0;

  for (const c of data.commonShares) {
    for (const h of c.holders) totalEquityShares += h.shares;
  }

  for (const pref of allPreferred) {
    if (converters.has(pref.id)) {
      equityPool += prefReceived.get(pref.id) || 0;
      totalEquityShares += pref.totalShares * pref.conversionRatio;
    } else if (pref.participation !== 'non-participating') {
      totalEquityShares += pref.totalShares * pref.conversionRatio;
    }
  }

  const perShareEst = totalEquityShares > 0 ? equityPool / totalEquityShares : 0;
  let optionExerciseRevenue = 0;
  let warrantExerciseRevenue = 0;

  for (const o of data.options) {
    if (perShareEst > o.strikePrice) {
      const vs = o.shares * o.vested;
      totalEquityShares += vs;
      optionExerciseRevenue += vs * o.strikePrice;
    }
  }
  for (const w of data.warrants) {
    if (perShareEst > w.exercisePrice) {
      totalEquityShares += w.shares;
      warrantExerciseRevenue += w.shares * w.exercisePrice;
    }
  }

  equityPool += optionExerciseRevenue + warrantExerciseRevenue;
  const perShare = totalEquityShares > 0 ? equityPool / totalEquityShares : 0;

  // Distribute to common
  for (const c of data.commonShares) {
    for (const h of c.holders) {
      entries.push({
        stakeholderName: h.name,
        instrumentType: 'Common',
        instrumentName: c.className,
        amount: perShare * h.shares,
      });
    }
  }

  // Converting preferred: replace preference with equity
  for (const pref of allPreferred) {
    if (converters.has(pref.id)) {
      const indices = prefEntryIndices.get(pref.id) || [];
      for (let i = 0; i < pref.holders.length; i++) {
        const h = pref.holders[i];
        const equityAmt = perShare * h.shares * pref.conversionRatio;
        if (indices[i] !== undefined) {
          entries[indices[i]].amount = equityAmt;
          entries[indices[i]].instrumentName = `${pref.name} (converted)`;
        }
      }
    } else if (pref.participation !== 'non-participating') {
      // Participating preferred: add equity participation
      for (const h of pref.holders) {
        let participation = perShare * h.shares * pref.conversionRatio;
        if (pref.participation === 'capped') {
          const prefPmt =
            (prefReceived.get(pref.id) || 0) *
            (pref.totalShares > 0 ? h.shares / pref.totalShares : 0);
          const cap =
            h.shares * pref.preferencePerShare * pref.participationCap - prefPmt;
          participation = Math.min(participation, Math.max(0, cap));
        }
        entries.push({
          stakeholderName: h.name,
          instrumentType: pref.instrumentType,
          instrumentName: `${pref.name} (participation)`,
          amount: participation,
        });
      }
    }
  }

  // Options
  for (const o of data.options) {
    const vs = o.shares * o.vested;
    const payout = Math.max(0, perShare - o.strikePrice) * vs;
    if (payout > 0) {
      entries.push({
        stakeholderName: o.holderName,
        instrumentType: 'Options',
        instrumentName: `Options (strike $${o.strikePrice})`,
        amount: payout,
      });
    }
  }

  // Warrants
  for (const w of data.warrants) {
    const payout = Math.max(0, perShare - w.exercisePrice) * w.shares;
    if (payout > 0) {
      entries.push({
        stakeholderName: w.holderName,
        instrumentType: 'Warrants',
        instrumentName: `Warrant (ex. $${w.exercisePrice})`,
        amount: payout,
      });
    }
  }

  // Build set of converted series names and series metrics
  const convertedNames = new Set<string>();
  const seriesMetrics = new Map<string, SeriesMetrics>();
  for (const pref of allPreferred) {
    if (converters.has(pref.id)) {
      convertedNames.add(pref.name);
    }
    seriesMetrics.set(pref.name, {
      investmentPPS: pref.preferencePerShare,
      totalShares: pref.totalShares,
      seniority: pref.seniority,
    });
  }
  // Add common share metrics
  for (const c of data.commonShares) {
    const totalShares = c.holders.reduce((sum, h) => sum + h.shares, 0);
    seriesMetrics.set(c.className, {
      investmentPPS: 0,
      totalShares,
      seniority: 999,
    });
  }

  return { entries, perShare, convertedNames, seriesMetrics };
}

function getPreSafeFDS(data: CompanyData): number {
  let total = 0;
  for (const c of data.commonShares) {
    for (const h of c.holders) total += h.shares;
  }
  for (const p of data.preferredShares) {
    for (const h of p.holders) total += h.shares;
  }
  for (const o of data.options) total += o.shares * o.vested;
  for (const w of data.warrants) total += w.shares;
  return total || 1;
}

function getSafeConversionPrice(
  safe: { valuationCap: number; discountRate: number; investmentAmount: number },
  preFDS: number,
  valuation: number
): number {
  let price = Infinity;
  if (safe.valuationCap > 0) {
    price = safe.valuationCap / preFDS;
  }
  if (safe.discountRate > 0) {
    const implied = valuation / preFDS;
    const discounted = implied * (1 - safe.discountRate);
    price = Math.min(price, discounted);
  }
  if (!isFinite(price)) {
    price = valuation / preFDS;
  }
  return price;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function aggregate(
  valuations: number[],
  payoutsByValuation: Map<number, StakeholderPayout[]>
): AggregatedRow[] {
  const keyMap = new Map<string, AggregatedRow>();

  for (let vi = 0; vi < valuations.length; vi++) {
    const v = valuations[vi];
    const payouts = payoutsByValuation.get(v) || [];

    // Merge payouts by stakeholder+instrument
    const merged = new Map<string, StakeholderPayout>();
    for (const p of payouts) {
      const key = `${p.stakeholderName}|||${p.instrumentType}`;
      const existing = merged.get(key);
      if (existing) {
        existing.amount += p.amount;
      } else {
        merged.set(key, { ...p });
      }
    }

    for (const [key, p] of merged) {
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          stakeholderName: p.stakeholderName,
          instrumentType: p.instrumentType,
          instrumentName: p.instrumentType,
          amounts: new Array(valuations.length).fill(0),
        });
      }
      keyMap.get(key)!.amounts[vi] = p.amount;
    }
  }

  const rows = Array.from(keyMap.values());
  const typeOrder: Record<string, number> = {
    'Senior Debt': 0,
    SAFE: 1,
    Preferred: 2,
    Common: 3,
    Options: 4,
    Warrants: 5,
  };
  rows.sort(
    (a, b) =>
      (typeOrder[a.instrumentType] ?? 99) - (typeOrder[b.instrumentType] ?? 99) ||
      a.stakeholderName.localeCompare(b.stakeholderName)
  );

  return rows;
}

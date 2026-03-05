import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  CompanyData,
  SeniorDebt,
  Safe,
  PreferredShare,
  CommonShare,
  OptionGrant,
  WarrantGrant,
  Holder,
} from '../types';

interface Props {
  data: CompanyData;
  onChange: (data: CompanyData) => void;
}

let nextId = 1;
const uid = () => `id-${nextId++}-${Date.now()}`;

const inputCls =
  'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';
const btnAdd =
  'inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors';
const btnDel =
  'p-1 text-slate-400 hover:text-red-500 transition-colors';
const thCls = 'px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider';
const tdCls = 'px-3 py-2';

export default function DataEditor({ data, onChange }: Props) {
  const [tab, setTab] = useState<string>('debt');
  const tabs = [
    { key: 'debt', label: 'Senior Debt', count: data.seniorDebts.length },
    { key: 'safe', label: 'SAFEs', count: data.safes.length },
    { key: 'preferred', label: 'Preferred', count: data.preferredShares.length },
    { key: 'common', label: 'Common', count: data.commonShares.length },
    { key: 'options', label: 'Options', count: data.options.length },
    { key: 'warrants', label: 'Warrants', count: data.warrants.length },
  ];

  const descriptions: Record<string, string> = {
    debt: 'Highest priority in the waterfall. Paid first from total proceeds (principal + accrued interest + final payment + prepayment fee). Ordered by seniority. Nothing flows to other instruments until all debt is fully repaid.',
    safe: 'Converts into preferred shares at the lower of the valuation cap price or discounted price. Treated as 1x non-participating preferred. If the as-converted equity value exceeds the preference, the SAFE converts to common equity instead.',
    preferred: 'Paid after debt. Each series receives its liquidation preference (price per share × shares × multiple) in seniority order. Non-participating preferred chooses the better of preference or as-converted common. Participating preferred gets both preference and a share of remaining equity (optionally capped).',
    common: 'Receives a pro-rata share of the remaining equity pool after all preferences are paid. Shares the same per-share price as converting preferred, in-the-money options, and warrants.',
    options: 'Participates in the equity pool alongside common shares. Payout per share equals the common per-share price minus the strike price. Only in-the-money options (where common PPS exceeds strike) receive proceeds. Uses vested shares only.',
    warrants: 'Same priority as common and options in the equity pool. Payout per share equals the common per-share price minus the exercise price. Only in-the-money warrants receive proceeds.',
  };

  return (
    <div>
      <div className="flex border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 mb-4 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        {descriptions[tab]}
      </div>

      <div>
        {tab === 'debt' && <DebtEditor items={data.seniorDebts} onChange={(v) => onChange({ ...data, seniorDebts: v })} />}
        {tab === 'safe' && <SafeEditor items={data.safes} onChange={(v) => onChange({ ...data, safes: v })} />}
        {tab === 'preferred' && <PreferredEditor items={data.preferredShares} onChange={(v) => onChange({ ...data, preferredShares: v })} />}
        {tab === 'common' && <CommonEditor items={data.commonShares} onChange={(v) => onChange({ ...data, commonShares: v })} />}
        {tab === 'options' && <OptionEditor items={data.options} onChange={(v) => onChange({ ...data, options: v })} />}
        {tab === 'warrants' && <WarrantEditor items={data.warrants} onChange={(v) => onChange({ ...data, warrants: v })} />}
      </div>
    </div>
  );
}

// --- Debt ---
function DebtEditor({ items, onChange }: { items: SeniorDebt[]; onChange: (v: SeniorDebt[]) => void }) {
  const add = () =>
    onChange([...items, { id: uid(), name: '', holderName: '', principal: 0, accruedInterest: 0, interestRate: 0, finalPayment: 0, prepaymentFeeRate: 0, seniority: items.length + 1 }]);
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<SeniorDebt>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div>
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Name</th>
                <th className={thCls}>Holder</th>
                <th className={thCls}>Principal</th>
                <th className={thCls}>Accrued Interest</th>
                <th className={thCls}>Rate (%)</th>
                <th className={thCls}>Final Payment</th>
                <th className={thCls}>Prepayment Fee (%)</th>
                <th className={thCls}>Seniority</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((d) => (
                <tr key={d.id}>
                  <td className={tdCls}><input className={inputCls} value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} placeholder="Term Loan A" /></td>
                  <td className={tdCls}><input className={inputCls} value={d.holderName} onChange={(e) => update(d.id, { holderName: e.target.value })} placeholder="Bank of..." /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={d.principal || ''} onChange={(e) => update(d.id, { principal: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={d.accruedInterest || ''} onChange={(e) => update(d.id, { accruedInterest: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={d.interestRate || ''} onChange={(e) => update(d.id, { interestRate: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={d.finalPayment || ''} onChange={(e) => update(d.id, { finalPayment: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={d.prepaymentFeeRate ? d.prepaymentFeeRate * 100 : ''} onChange={(e) => update(d.id, { prepaymentFeeRate: +e.target.value / 100 })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={d.seniority || ''} onChange={(e) => update(d.id, { seniority: +e.target.value })} /></td>
                  <td className={tdCls}><button onClick={() => remove(d.id)} className={btnDel}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={add} className={`${btnAdd} mt-3`}><Plus className="h-3.5 w-3.5" /> Add Debt</button>
    </div>
  );
}

// --- SAFE ---
function SafeEditor({ items, onChange }: { items: Safe[]; onChange: (v: Safe[]) => void }) {
  const add = () =>
    onChange([...items, { id: uid(), investorName: '', investmentAmount: 0, valuationCap: 0, discountRate: 0 }]);
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<Safe>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div>
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Investor</th>
                <th className={thCls}>Investment Amount</th>
                <th className={thCls}>Valuation Cap</th>
                <th className={thCls}>Discount Rate (%)</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((s) => (
                <tr key={s.id}>
                  <td className={tdCls}><input className={inputCls} value={s.investorName} onChange={(e) => update(s.id, { investorName: e.target.value })} placeholder="Y Combinator" /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={s.investmentAmount || ''} onChange={(e) => update(s.id, { investmentAmount: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={s.valuationCap || ''} onChange={(e) => update(s.id, { valuationCap: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={s.discountRate ? s.discountRate * 100 : ''} onChange={(e) => update(s.id, { discountRate: +e.target.value / 100 })} /></td>
                  <td className={tdCls}><button onClick={() => remove(s.id)} className={btnDel}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={add} className={`${btnAdd} mt-3`}><Plus className="h-3.5 w-3.5" /> Add SAFE</button>
    </div>
  );
}

// --- Preferred ---
function PreferredEditor({ items, onChange }: { items: PreferredShare[]; onChange: (v: PreferredShare[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const add = () => {
    const newItem: PreferredShare = {
      id: uid(),
      className: '',
      pricePerShare: 0,
      liquidationMultiple: 1,
      participation: 'non-participating',
      participationCap: 0,
      seniority: items.length + 1,
      conversionRatio: 1,
      holders: [{ name: '', shares: 0 }],
    };
    onChange([...items, newItem]);
    setExpanded(newItem.id);
  };

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<PreferredShare>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addHolder = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) update(id, { holders: [...item.holders, { name: '', shares: 0 }] });
  };
  const removeHolder = (id: string, idx: number) => {
    const item = items.find((i) => i.id === id);
    if (item) update(id, { holders: item.holders.filter((_, i) => i !== idx) });
  };
  const updateHolder = (id: string, idx: number, patch: Partial<Holder>) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      const holders = item.holders.map((h, i) => (i === idx ? { ...h, ...patch } : h));
      update(id, { holders });
    }
  };

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <div key={p.id} className="rounded-lg border border-slate-200 bg-white">
          <button
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>{p.className || 'New Preferred Class'} {p.holders.length > 0 && `(${p.holders.reduce((s, h) => s + h.shares, 0).toLocaleString()} shares)`}</span>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); remove(p.id); }} className={btnDel}><Trash2 className="h-4 w-4" /></button>
              {expanded === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>
          {expanded === p.id && (
            <div className="border-t border-slate-100 px-4 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Class Name</label>
                  <input className={inputCls} value={p.className} onChange={(e) => update(p.id, { className: e.target.value })} placeholder="Series A" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Price / Share</label>
                  <input className={inputCls} type="number" value={p.pricePerShare || ''} onChange={(e) => update(p.id, { pricePerShare: +e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Liquidation Multiple</label>
                  <input className={inputCls} type="number" value={p.liquidationMultiple || ''} onChange={(e) => update(p.id, { liquidationMultiple: +e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Participation</label>
                  <select className={inputCls} value={p.participation} onChange={(e) => update(p.id, { participation: e.target.value as any })}>
                    <option value="non-participating">Non-participating</option>
                    <option value="participating">Participating</option>
                    <option value="capped">Capped</option>
                  </select>
                </div>
                {p.participation === 'capped' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Participation Cap (x)</label>
                    <input className={inputCls} type="number" value={p.participationCap || ''} onChange={(e) => update(p.id, { participationCap: +e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Seniority</label>
                  <input className={inputCls} type="number" value={p.seniority || ''} onChange={(e) => update(p.id, { seniority: +e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Conversion Ratio</label>
                  <input className={inputCls} type="number" value={p.conversionRatio || ''} onChange={(e) => update(p.id, { conversionRatio: +e.target.value })} />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase text-slate-500">Holders</h4>
                <div className="space-y-2">
                  {p.holders.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input className={inputCls} value={h.name} onChange={(e) => updateHolder(p.id, idx, { name: e.target.value })} placeholder="Holder name" />
                      <input className={`${inputCls} w-40`} type="number" value={h.shares || ''} onChange={(e) => updateHolder(p.id, idx, { shares: +e.target.value })} placeholder="Shares" />
                      <button onClick={() => removeHolder(p.id, idx)} className={btnDel}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addHolder(p.id)} className={`${btnAdd} mt-2`}><Plus className="h-3.5 w-3.5" /> Add Holder</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className={btnAdd}><Plus className="h-3.5 w-3.5" /> Add Preferred Class</button>
    </div>
  );
}

// --- Common ---
function CommonEditor({ items, onChange }: { items: CommonShare[]; onChange: (v: CommonShare[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(items[0]?.id || null);

  const add = () => {
    const newItem: CommonShare = { id: uid(), className: 'Common', holders: [{ name: '', shares: 0 }] };
    onChange([...items, newItem]);
    setExpanded(newItem.id);
  };
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<CommonShare>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addHolder = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) update(id, { holders: [...item.holders, { name: '', shares: 0 }] });
  };
  const removeHolder = (id: string, idx: number) => {
    const item = items.find((i) => i.id === id);
    if (item) update(id, { holders: item.holders.filter((_, i) => i !== idx) });
  };
  const updateHolder = (id: string, idx: number, patch: Partial<Holder>) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      const holders = item.holders.map((h, i) => (i === idx ? { ...h, ...patch } : h));
      update(id, { holders });
    }
  };

  return (
    <div className="space-y-3">
      {items.map((c) => (
        <div key={c.id} className="rounded-lg border border-slate-200 bg-white">
          <button
            onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>{c.className || 'Common'} ({c.holders.reduce((s, h) => s + h.shares, 0).toLocaleString()} shares)</span>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); remove(c.id); }} className={btnDel}><Trash2 className="h-4 w-4" /></button>
              {expanded === c.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </button>
          {expanded === c.id && (
            <div className="border-t border-slate-100 px-4 py-4 space-y-3">
              <div className="w-64">
                <label className="mb-1 block text-xs font-medium text-slate-600">Class Name</label>
                <input className={inputCls} value={c.className} onChange={(e) => update(c.id, { className: e.target.value })} />
              </div>
              <h4 className="text-xs font-medium uppercase text-slate-500">Holders</h4>
              <div className="space-y-2">
                {c.holders.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input className={inputCls} value={h.name} onChange={(e) => updateHolder(c.id, idx, { name: e.target.value })} placeholder="Holder name" />
                    <input className={`${inputCls} w-40`} type="number" value={h.shares || ''} onChange={(e) => updateHolder(c.id, idx, { shares: +e.target.value })} placeholder="Shares" />
                    <button onClick={() => removeHolder(c.id, idx)} className={btnDel}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => addHolder(c.id)} className={`${btnAdd} mt-2`}><Plus className="h-3.5 w-3.5" /> Add Holder</button>
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className={btnAdd}><Plus className="h-3.5 w-3.5" /> Add Common Class</button>
    </div>
  );
}

// --- Options ---
function OptionEditor({ items, onChange }: { items: OptionGrant[]; onChange: (v: OptionGrant[]) => void }) {
  const add = () =>
    onChange([...items, { id: uid(), holderName: '', shares: 0, strikePrice: 0, vested: 1 }]);
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<OptionGrant>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div>
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Holder</th>
                <th className={thCls}>Shares</th>
                <th className={thCls}>Strike Price</th>
                <th className={thCls}>Vested (%)</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((o) => (
                <tr key={o.id}>
                  <td className={tdCls}><input className={inputCls} value={o.holderName} onChange={(e) => update(o.id, { holderName: e.target.value })} placeholder="Employee name" /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={o.shares || ''} onChange={(e) => update(o.id, { shares: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={o.strikePrice ?? ''} onChange={(e) => update(o.id, { strikePrice: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={o.vested ? o.vested * 100 : ''} onChange={(e) => update(o.id, { vested: +e.target.value / 100 })} /></td>
                  <td className={tdCls}><button onClick={() => remove(o.id)} className={btnDel}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={add} className={`${btnAdd} mt-3`}><Plus className="h-3.5 w-3.5" /> Add Option Grant</button>
    </div>
  );
}

// --- Warrants ---
function WarrantEditor({ items, onChange }: { items: WarrantGrant[]; onChange: (v: WarrantGrant[]) => void }) {
  const add = () =>
    onChange([...items, { id: uid(), holderName: '', shares: 0, exercisePrice: 0 }]);
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const update = (id: string, patch: Partial<WarrantGrant>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div>
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={thCls}>Holder</th>
                <th className={thCls}>Shares</th>
                <th className={thCls}>Exercise Price</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((w) => (
                <tr key={w.id}>
                  <td className={tdCls}><input className={inputCls} value={w.holderName} onChange={(e) => update(w.id, { holderName: e.target.value })} placeholder="Warrant holder" /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={w.shares || ''} onChange={(e) => update(w.id, { shares: +e.target.value })} /></td>
                  <td className={tdCls}><input className={inputCls} type="number" value={w.exercisePrice || ''} onChange={(e) => update(w.id, { exercisePrice: +e.target.value })} /></td>
                  <td className={tdCls}><button onClick={() => remove(w.id)} className={btnDel}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={add} className={`${btnAdd} mt-3`}><Plus className="h-3.5 w-3.5" /> Add Warrant</button>
    </div>
  );
}

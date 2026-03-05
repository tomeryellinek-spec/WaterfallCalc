import type { ValuationConfig as Config } from '../types';

const inputCls =
  'w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder-slate-500';

interface Props {
  config: Config;
  onChange: (config: Config) => void;
}

export default function ValuationConfig({ config, onChange }: Props) {
  const update = (patch: Partial<Config>) => onChange({ ...config, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            checked={config.mode === 'single'}
            onChange={() => update({ mode: 'single' })}
            className="text-blue-600"
          />
          Single valuation
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            checked={config.mode === 'range'}
            onChange={() => update({ mode: 'range' })}
            className="text-blue-600"
          />
          Valuation range
        </label>
      </div>

      {config.mode === 'single' ? (
        <div className="max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Transaction Value ($)
          </label>
          <input
            className={inputCls}
            type="number"
            value={config.singleValuation || ''}
            onChange={(e) => update({ singleValuation: +e.target.value })}
            placeholder="e.g. 50000000"
          />
        </div>
      ) : (
        <div className="grid max-w-2xl grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Min ($)</label>
            <input
              className={inputCls}
              type="number"
              value={config.minValuation || ''}
              onChange={(e) => update({ minValuation: +e.target.value })}
              placeholder="e.g. 10000000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Max ($)</label>
            <input
              className={inputCls}
              type="number"
              value={config.maxValuation || ''}
              onChange={(e) => update({ maxValuation: +e.target.value })}
              placeholder="e.g. 100000000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Steps</label>
            <input
              className={inputCls}
              type="number"
              value={config.steps || ''}
              onChange={(e) => update({ steps: Math.max(2, +e.target.value) })}
              min={2}
              max={20}
            />
          </div>
        </div>
      )}

      <div className="max-w-xs">
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Transaction Costs ($)
        </label>
        <input
          className={inputCls}
          type="number"
          value={config.transactionCosts || ''}
          onChange={(e) => update({ transactionCosts: +e.target.value })}
          placeholder="0"
        />
      </div>
    </div>
  );
}

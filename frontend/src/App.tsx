import { useState, useCallback, useEffect } from 'react';
import { FileUp, Edit3, Settings, BarChart3, Trash2, GitBranch, Calculator } from 'lucide-react';
import DocumentUpload from './components/DocumentUpload';
import DataEditor from './components/DataEditor';
import ValuationConfigComponent from './components/ValuationConfig';
import WaterfallTable from './components/WaterfallTable';
import WaterfallFlow from './components/WaterfallFlow';
import { calculateWaterfall } from './engine/waterfall';
import type { CompanyData, ValuationConfig, WaterfallResult } from './types';

const STORAGE_KEY_DATA = 'waterfallcalc_data';
const STORAGE_KEY_CONFIG = 'waterfallcalc_config';

const emptyData: CompanyData = {
  seniorDebts: [],
  safes: [],
  preferredShares: [],
  commonShares: [],
  options: [],
  warrants: [],
};

const defaultConfig: ValuationConfig = {
  mode: 'range',
  singleValuation: 50_000_000,
  minValuation: 10_000_000,
  maxValuation: 100_000_000,
  steps: 10,
  transactionCosts: 0,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

type Section = 'upload' | 'data' | 'valuation' | 'results' | 'flow';

export default function App() {
  const [data, setData] = useState<CompanyData>(() => loadFromStorage(STORAGE_KEY_DATA, emptyData));
  const [config, setConfig] = useState<ValuationConfig>(() => loadFromStorage(STORAGE_KEY_CONFIG, defaultConfig));
  const [result, setResult] = useState<WaterfallResult | null>(null);
  const [activeSection, setActiveSection] = useState<Section>(() => {
    const saved = loadFromStorage<CompanyData>(STORAGE_KEY_DATA, emptyData);
    const hasData = saved.seniorDebts.length + saved.safes.length + saved.preferredShares.length +
      saved.commonShares.length + saved.options.length + saved.warrants.length > 0;
    return hasData ? 'data' : 'upload';
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  }, [config]);

  const handleClearData = useCallback(() => {
    if (window.confirm('Clear all instrument data?')) {
      setData(emptyData);
      setResult(null);
      localStorage.removeItem(STORAGE_KEY_DATA);
    }
  }, []);

  const handleParsedData = useCallback((parsed: Partial<CompanyData>) => {
    setData((prev) => mergeData(prev, parsed));
    setActiveSection('data');
  }, []);

  const handleCalculate = useCallback(() => {
    setError(null);
    try {
      const hasData =
        data.seniorDebts.length > 0 ||
        data.safes.length > 0 ||
        data.preferredShares.length > 0 ||
        data.commonShares.length > 0 ||
        data.options.length > 0 ||
        data.warrants.length > 0;

      if (!hasData) {
        setError('Add at least one instrument before calculating.');
        return;
      }

      const r = calculateWaterfall(data, config);
      setResult(r);
      setActiveSection('results');
    } catch (e: any) {
      setError(e.message || 'Calculation failed');
    }
  }, [data, config]);

  const sections: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'upload', label: 'Upload Documents', icon: <FileUp className="h-4 w-4" /> },
    { key: 'data', label: 'Edit Data', icon: <Edit3 className="h-4 w-4" /> },
    { key: 'valuation', label: 'Valuation', icon: <Settings className="h-4 w-4" /> },
    { key: 'results', label: 'Results', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'flow', label: 'Waterfall Flow', icon: <GitBranch className="h-4 w-4" /> },
  ];

  const instrumentCount =
    data.seniorDebts.length +
    data.safes.length +
    data.preferredShares.length +
    data.commonShares.length +
    data.options.length +
    data.warrants.length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Cascade" className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <h1 className="text-lg font-bold text-slate-100">Cascade</h1>
              <p className="text-xs text-slate-400">M&A Waterfall Calculator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {instrumentCount > 0 && (
              <span className="rounded-full bg-blue-900/50 px-3 py-1 text-xs font-medium text-blue-300">
                {instrumentCount} instrument{instrumentCount !== 1 ? 's' : ''} loaded
              </span>
            )}
            {instrumentCount > 0 && (
              <button
                onClick={handleClearData}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Data
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Navigation */}
        <nav className="mb-6 flex gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                activeSection === s.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          {activeSection === 'upload' && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Upload Documents
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                Upload cap tables, loan agreements, SAFE documents, warrants, or option plans.
                AI will extract structured data for the waterfall calculation.
              </p>
              <DocumentUpload onDataParsed={handleParsedData} />
            </div>
          )}

          {activeSection === 'data' && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Instrument Data
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                Review and edit the data below. You can add instruments manually or modify
                data imported from documents.
              </p>
              <DataEditor data={data} onChange={setData} />
            </div>
          )}

          {activeSection === 'valuation' && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Valuation Configuration
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                Set a single transaction value or a range to see the waterfall at multiple
                valuations.
              </p>
              <ValuationConfigComponent config={config} onChange={setConfig} />
            </div>
          )}

          {activeSection === 'results' && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Waterfall Results
              </h2>
              {result ? (
                <WaterfallTable result={result} />
              ) : (
                <p className="text-sm text-slate-400">
                  No results yet. Configure your data and valuation, then calculate.
                </p>
              )}
            </div>
          )}

          {activeSection === 'flow' && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Waterfall Flow
              </h2>
              {result ? (
                <WaterfallFlow result={result} />
              ) : (
                <p className="text-sm text-slate-400">
                  No results yet. Calculate first to see the waterfall flow.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Calculate button */}
        {activeSection !== 'results' && activeSection !== 'flow' && (
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleCalculate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Calculator className="h-4 w-4" />
              Calculate Waterfall
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function mergeData(existing: CompanyData, parsed: Partial<CompanyData>): CompanyData {
  let nextId = Date.now();
  const addIds = <T extends Record<string, any>>(arr: T[]): (T & { id: string })[] =>
    arr.map((item) => ({ ...item, id: item.id || `parsed-${nextId++}` }));

  return {
    seniorDebts: [...existing.seniorDebts, ...addIds(parsed.seniorDebts || [])],
    safes: [...existing.safes, ...addIds(parsed.safes || [])],
    preferredShares: [...existing.preferredShares, ...addIds(parsed.preferredShares || [])],
    commonShares: [...existing.commonShares, ...addIds(parsed.commonShares || [])],
    options: [...existing.options, ...addIds(parsed.options || [])],
    warrants: [...existing.warrants, ...addIds(parsed.warrants || [])],
  };
}

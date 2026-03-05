import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, AlertCircle, Check } from 'lucide-react';
import { parseDocument } from '../api';
import type { CompanyData } from '../types';

const DOC_TYPES = [
  { value: 'cap_table', label: 'Cap Table' },
  { value: 'loan_agreement', label: 'Loan Agreement' },
  { value: 'safe', label: 'SAFE' },
  { value: 'warrant', label: 'Warrant Agreement' },
  { value: 'option_plan', label: 'Option Plan / Grant' },
  { value: 'other', label: 'Other' },
];

interface Props {
  onDataParsed: (data: Partial<CompanyData>) => void;
}

export default function DocumentUpload({ onDataParsed }: Props) {
  const [docType, setDocType] = useState('cap_table');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const result = await parseDocument(file, docType);
        onDataParsed(result.data);
        setSuccess(`Parsed "${file.name}" successfully. Review the data in the tabs below.`);
      } catch (e: any) {
        setError(e.message || 'Failed to parse document');
      } finally {
        setLoading(false);
      }
    },
    [docType, onDataParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700">Document type:</label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {DOC_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="mt-3 text-sm text-slate-600">Parsing document with AI...</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm text-slate-600">
              Drag & drop a file here, or{' '}
              <label className="cursor-pointer font-medium text-blue-600 hover:text-blue-500">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
                  onChange={onFileInput}
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              PDF, Excel, CSV, or Word documents
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="rounded-md bg-slate-50 p-4 text-xs text-slate-500">
        <FileText className="mb-1 inline h-3.5 w-3.5" /> Upload cap tables, loan agreements,
        SAFE documents, warrant certificates, or option plans. The AI will extract structured
        data that you can review and edit in the tabs below.
      </div>
    </div>
  );
}

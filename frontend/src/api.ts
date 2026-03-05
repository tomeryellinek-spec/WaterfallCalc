import type { CompanyData } from './types';

export interface ParsedDocument {
  documentType: string;
  data: Partial<CompanyData>;
  rawText: string;
}

export async function parseDocument(file: File, documentType: string): Promise<ParsedDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);

  const res = await fetch('/api/parse-document', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }

  return res.json();
}

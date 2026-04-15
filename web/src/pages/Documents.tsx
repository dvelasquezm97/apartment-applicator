import { useState, useRef } from 'react';
import { useDocuments, useUploadDocument, useDeleteDocument } from '../hooks/useApi.js';

const DOC_TYPES = ['CV', 'INCOME_PROOF', 'COVER_LETTER', 'SCHUFA', 'OTHER'] as const;

const TYPE_LABELS: Record<string, string> = {
  CV: 'CV / Resume',
  INCOME_PROOF: 'Income Proof',
  COVER_LETTER: 'Cover Letter',
  SCHUFA: 'SCHUFA Report',
  OTHER: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  CV: 'bg-blue-100 text-blue-800',
  INCOME_PROOF: 'bg-green-100 text-green-800',
  COVER_LETTER: 'bg-purple-100 text-purple-800',
  SCHUFA: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

export function Documents() {
  const { data, isLoading } = useDocuments();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();
  const [selectedType, setSelectedType] = useState<string>('CV');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = data?.documents || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadMutation.mutateAsync({ file, type: selectedType });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Documents</h2>

      <div className="bg-white rounded-lg border p-4 mb-6">
        <h3 className="font-semibold mb-3">Upload Document</h3>
        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {DOC_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleUpload}
            className="text-sm"
          />
          {uploadMutation.isPending && <span className="text-sm text-gray-500">Uploading...</span>}
          {uploadMutation.isError && <span className="text-sm text-red-600">Upload failed</span>}
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-500">No documents uploaded yet. Upload your CV, income proof, SCHUFA, etc.</p>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[doc.type] || TYPE_COLORS.OTHER}`}>
                  {TYPE_LABELS[doc.type] || doc.type}
                </span>
                <span className="text-sm">{doc.filename}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {new Date(doc.uploadedAt).toLocaleDateString('de-DE')}
                </span>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

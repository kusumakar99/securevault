import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import api from '../services/api';

export default function DocumentUploader({ onExtracted, onFilesReady }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const handleFiles = useCallback((newFiles) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const valid = Array.from(newFiles).filter(f => allowed.includes(f.type));
    if (valid.length !== newFiles.length) {
      setError('Some files were skipped. Only PDF, JPEG, PNG, WebP allowed.');
    }
    const updated = [...files, ...valid].slice(0, 5);
    setFiles(updated);
    onFilesReady(updated);
  }, [files, onFilesReady]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesReady(updated);
  };

  const handleExtract = async () => {
    if (!consentGiven) {
      setError('Please acknowledge the privacy notice before proceeding.');
      return;
    }
    if (files.length === 0) {
      setError('Please upload at least one document.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('documents', f));

      const res = await api.post('/extract/real_estate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      if (res.data.success && res.data.extracted) {
        onExtracted(res.data.extracted);
        setExtracted(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Extraction failed. Please try again or fill in manually.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-800">Upload Property Documents</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Upload property documents (sale deed, registration certificate, etc.). They'll be stored securely and details can be auto-extracted.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
        }`}
        onClick={() => document.getElementById('doc-upload-input').click()}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          Drag & drop files here or <span className="text-indigo-600 font-medium">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG, WebP • Max 10MB each • Up to 5 files</p>
        <input
          id="doc-upload-input"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm border">
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate flex-1">{file.name}</span>
              <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Privacy consent + extract button */}
      {files.length > 0 && !extracted && (
        <>
          <label className="flex items-start gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-600">
              <AlertTriangle className="w-3 h-3 inline text-amber-500 mr-1" />
              I understand that document contents will be sent to AI for text extraction.
              Documents will be stored encrypted in the vault.
            </span>
          </label>

          <button
            type="button"
            onClick={handleExtract}
            disabled={loading}
            className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Extracting...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Extract & Auto-fill
              </>
            )}
          </button>
        </>
      )}

      {extracted && (
        <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          ✓ Details extracted and form auto-filled. Documents will be saved with the entry.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
      )}
    </div>
  );
}

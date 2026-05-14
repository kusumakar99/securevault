import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Save, FileText, Download, X } from 'lucide-react';
import DocumentUploader from '../components/DocumentUploader';

export default function EntryForm() {
  const { category, id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [schema, setSchema] = useState(null);
  const [title, setTitle] = useState('');
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existingDocs, setExistingDocs] = useState([]);

  // Handle extracted data from document uploader
  const handleDocumentExtracted = (extracted) => {
    setFormData(prev => {
      const merged = { ...prev };
      Object.entries(extracted).forEach(([key, value]) => {
        if (value && !merged[key]) {
          merged[key] = value;
        }
      });
      return merged;
    });
    if (!title && (extracted.description || extracted.address)) {
      setTitle(extracted.description || extracted.address);
    }
  };

  // Track files for upload after entry is saved
  const handleFilesReady = useCallback((files) => {
    setPendingFiles(files);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const schemaRes = await api.get(`/vault/categories/${category}/schema`);
        setSchema(schemaRes.data);

        if (isEdit) {
          const [entryRes, docsRes] = await Promise.all([
            api.get(`/vault/entries/${category}/${id}`),
            api.get(`/vault/entries/${category}/${id}/documents`),
          ]);
          setTitle(entryRes.data.title);
          setFormData(entryRes.data.data || {});
          setExistingDocs(docsRes.data.documents || []);
        }
      } catch (err) {
        setError('Failed to load');
      }
      setLoading(false);
    };
    load();
  }, [category, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const finalTitle = title || schema?.fields?.[0]?.name && formData[schema.fields[0].name] || 'Untitled';

    try {
      let entryId = id;

      if (isEdit) {
        await api.put(`/vault/entries/${category}/${id}`, { title: finalTitle, data: formData });
      } else {
        const res = await api.post(`/vault/entries/${category}`, { title: finalTitle, data: formData });
        entryId = res.data.id;
      }

      // Upload pending documents to the entry
      if (pendingFiles.length > 0 && entryId) {
        const docFormData = new FormData();
        pendingFiles.forEach(f => docFormData.append('documents', f));
        await api.post(`/vault/entries/${category}/${entryId}/documents`, docFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate(`/category/${category}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    }
    setSaving(false);
  };

  const handleViewDocument = async (docId) => {
    try {
      const res = await api.get(`/vault/documents/${docId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch {
      alert('Failed to open document');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.delete(`/vault/documents/${docId}`);
      setExistingDocs(prev => prev.filter(d => d.id !== docId));
    } catch {
      alert('Failed to delete document');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/category/${category}`} className="p-2 hover:bg-gray-200 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit' : 'New'} {schema?.label} Entry</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Document upload + auto-extraction for real estate */}
      {category === 'real_estate' && (
        <DocumentUploader onExtracted={handleDocumentExtracted} onFilesReady={handleFilesReady} />
      )}

      {/* Existing documents (edit mode) */}
      {isEdit && existingDocs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" /> Stored Documents
          </h3>
          <div className="space-y-2">
            {existingDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-400">{(doc.file_size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button type="button" onClick={() => handleViewDocument(doc.id)}
                  className="p-2 hover:bg-indigo-100 rounded-lg" title="View/Download">
                  <Download className="w-4 h-4 text-indigo-600" />
                </button>
                <button type="button" onClick={() => handleDeleteDocument(doc.id)}
                  className="p-2 hover:bg-red-100 rounded-lg" title="Delete">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Entry Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. SBI Savings Account"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
        </div>

        <hr className="my-4" />

        {schema?.fields?.map(field => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-400">*</span>}
              {field.sensitive && <span className="ml-1 text-xs text-amber-500">🔒 encrypted</span>}
            </label>
            {field.type === 'select' ? (
              <select value={formData[field.name] || ''} onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none">
                <option value="">Select...</option>
                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea value={formData[field.name] || ''} onChange={e => setFormData({ ...formData, [field.name]: e.target.value })} rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
            ) : (
              <input type={field.type === 'password' ? 'password' : 'text'}
                value={formData[field.name] || ''} onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                required={field.required}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
            )}
          </div>
        ))}

        <div className="pt-4 flex gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Entry'}
          </button>
          <Link to={`/category/${category}`}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

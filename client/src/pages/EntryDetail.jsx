import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, Edit, Trash2, Eye, EyeOff, Copy, CheckCircle, FileText, Download, X } from 'lucide-react';

export default function EntryDetail() {
  const { category, id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [schema, setSchema] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [revealedFields, setRevealedFields] = useState({});
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/vault/entries/${category}/${id}`),
      api.get(`/vault/categories/${category}/schema`),
      api.get(`/vault/entries/${category}/${id}/documents`),
    ]).then(([entRes, schemaRes, docsRes]) => {
      setEntry(entRes.data);
      setSchema(schemaRes.data);
      setDocuments(docsRes.data.documents || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [category, id]);

  const toggleReveal = (name) => {
    setRevealedFields(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const copyValue = (name, value) => {
    navigator.clipboard.writeText(value);
    setCopied(name);
    setTimeout(() => setCopied(''), 1500);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this entry? This cannot be undone.')) return;
    try {
      await api.delete(`/vault/entries/${category}/${id}`);
      navigate(`/category/${category}`);
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleViewDocument = async (docId, fileName) => {
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
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch {
      alert('Failed to delete document');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;
  if (!entry) return <div className="text-center py-20 text-gray-400">Entry not found</div>;

  const fieldSchema = schema?.fields || [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/category/${category}`} className="p-2 hover:bg-gray-200 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold text-gray-900">{entry.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link to={`/category/${category}/${id}/edit`}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition text-sm">
            <Edit className="w-4 h-4" /> Edit
          </Link>
          <button onClick={handleDelete}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-sm">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
        {fieldSchema.map(field => {
          const value = entry.data?.[field.name];
          if (!value && value !== 0) return null;

          const isSensitive = field.sensitive || field.type === 'password';
          const isRevealed = revealedFields[field.name];

          return (
            <div key={field.name} className="px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 mb-1">{field.label}</p>
                <p className="text-gray-900 font-medium break-words">
                  {isSensitive && !isRevealed ? '••••••••' : value}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isSensitive && (
                  <button onClick={() => toggleReveal(field.name)} className="p-2 hover:bg-gray-100 rounded-lg" title={isRevealed ? 'Hide' : 'Reveal'}>
                    {isRevealed ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </button>
                )}
                <button onClick={() => copyValue(field.name, value)} className="p-2 hover:bg-gray-100 rounded-lg" title="Copy">
                  {copied === field.name ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Attached Documents */}
      {documents.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" /> Attached Documents
          </h3>
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-400">{(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleViewDocument(doc.id, doc.file_name)}
                  className="p-2 hover:bg-indigo-100 rounded-lg" title="View/Download">
                  <Download className="w-4 h-4 text-indigo-600" />
                </button>
                <button onClick={() => handleDeleteDocument(doc.id)}
                  className="p-2 hover:bg-red-100 rounded-lg" title="Delete">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400 text-center">
        Created: {new Date(entry.created_at).toLocaleString()} | Updated: {new Date(entry.updated_at).toLocaleString()}
      </div>
    </div>
  );
}

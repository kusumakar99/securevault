import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Plus, X, Copy, CheckCircle } from 'lucide-react';

export default function Nominees() {
  const [nominees, setNominees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', relationship: '' });
  const [newCode, setNewCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadNominees = () => {
    api.get('/nominees').then(res => setNominees(res.data.nominees)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(loadNominees, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/nominees', form);
      setNewCode({ name: res.data.name, code: res.data.accessCode });
      setShowForm(false);
      setForm({ name: '', email: '', relationship: '' });
      loadNominees();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add nominee');
    }
  };

  const handleRemove = async (id, name) => {
    if (!window.confirm(`Remove ${name} as nominee?`)) return;
    await api.delete(`/nominees/${id}`);
    loadNominees();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(newCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-emerald-600" /> Nominees
        </h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Add Nominee
        </button>
      </div>

      {/* New code alert */}
      {newCode && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-emerald-800 mb-2">✅ Nominee Added: {newCode.name}</h3>
          <p className="text-sm text-emerald-700 mb-3">Share this access code with them securely. <strong>It will not be shown again.</strong></p>
          <div className="bg-white rounded-lg p-3 flex items-center gap-2 border">
            <code className="flex-1 text-xl font-mono tracking-[0.3em] text-gray-900 text-center">{newCode.code}</code>
            <button onClick={copyCode} className="p-2 hover:bg-gray-100 rounded">
              {copied ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-gray-400" />}
            </button>
          </div>
          <button onClick={() => setNewCode(null)} className="mt-3 text-sm text-emerald-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Add New Nominee</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg mb-3 text-sm">{error}</div>}
          <form onSubmit={handleAdd} className="space-y-3">
            <input type="text" placeholder="Full Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none" />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none" />
            <input type="text" placeholder="Relationship (e.g., Spouse, Child)" value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none" />
            <button type="submit" className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition">
              Add & Generate Code
            </button>
          </form>
        </div>
      )}

      {/* Nominees list */}
      {nominees.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No nominees added yet</p>
          <p className="text-sm text-gray-400">Add nominees who should access your vault in case of emergency</p>
        </div>
      ) : (
        <div className="space-y-3">
          {nominees.map(n => (
            <div key={n.id} className={`bg-white rounded-xl border p-5 ${n.is_active ? 'border-gray-100' : 'border-red-100 opacity-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{n.name}</h3>
                  <p className="text-sm text-gray-500">{n.email} {n.relationship && `• ${n.relationship}`}</p>
                  <p className="text-xs text-gray-400 mt-1">Access: {n.access_level} • Added: {new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                {n.is_active && (
                  <button onClick={() => handleRemove(n.id, n.name)}
                    className="text-sm text-red-500 hover:text-red-700 px-3 py-1 rounded border border-red-200 hover:bg-red-50">
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-2">How it works</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Add a nominee and share the access code with them securely</li>
          <li>In an emergency, they visit the activation page and enter their code</li>
          <li>You receive an email notification and can approve/deny from your vault</li>
          <li>If you don't respond within the configured period, access is automatically granted</li>
        </ol>
      </div>
    </div>
  );
}

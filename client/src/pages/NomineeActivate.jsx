import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Shield, CheckCircle } from 'lucide-react';

export default function NomineeActivate() {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/nominees/activate', { email, accessCode: accessCode.toUpperCase().replace(/\s/g, '') });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Activation failed');
    }
    setLoading(false);
  };

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted</h1>
          <p className="text-gray-600 mb-4">{result.message}</p>
          <p className="text-sm text-gray-400">
            The vault owner has been notified. If they don't respond by {new Date(result.expiresAt).toLocaleDateString()}, you'll receive access automatically.
          </p>
          <Link to="/login" className="inline-block mt-6 text-emerald-600 hover:underline text-sm">← Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nominee Access</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            Enter your email and the access code shared with you to request vault access.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Code</label>
            <input type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} required maxLength={8}
              placeholder="e.g. ABCD1234"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-lg tracking-[0.2em] text-center uppercase" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Activating...' : 'Request Access'}
          </button>
        </form>

        <div className="mt-6 bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-700">
          <p className="font-medium mb-1">⚠️ How this works:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>The vault owner will be notified of your request</li>
            <li>They can approve or deny your access</li>
            <li>If they don't respond within the configured period, access is auto-granted</li>
          </ul>
        </div>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">← Back to owner login</Link>
        </div>
      </div>
    </div>
  );
}

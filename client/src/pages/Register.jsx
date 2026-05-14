import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Lock, Copy, CheckCircle, Shield, ArrowRight } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', masterPassword: '', confirmPassword: '' });
  const [recoveryKey, setRecoveryKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.masterPassword !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (form.masterPassword.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    setLoading(true);
    try {
      const res = await register(form.email, form.name, form.masterPassword);
      setRecoveryKey(res.recoveryKey);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
    setLoading(false);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (recoveryKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg animate-fade-in-up">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-4 animate-pulse-glow">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Vault Created!</h1>
            <p className="text-gray-500 mt-1">Your digital legacy is now protected</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 bg-amber-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">⚠️</div>
              <div>
                <h3 className="font-bold text-amber-900">Save Your Recovery Key</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This key recovers your vault when the dead man's switch activates. Write it down and store it safely. <strong>It will never be shown again.</strong>
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 flex items-center gap-3 border-2 border-dashed border-amber-300">
              <code className="flex-1 text-xl font-mono tracking-wider text-gray-900 select-all text-center">{recoveryKey}</code>
              <button onClick={copyKey} className="p-2.5 hover:bg-amber-50 rounded-xl transition" title="Copy">
                {copied ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-amber-600" />}
              </button>
            </div>
            {copied && <p className="text-center text-sm text-emerald-600 mt-2 font-medium">✓ Copied to clipboard</p>}
          </div>
          <button onClick={() => navigate('/')} 
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2">
            Enter Your Vault <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-32 left-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        </div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h2 className="text-4xl font-bold leading-tight mb-6">
            Build your<br /><span className="text-emerald-400">digital safety net</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-md mb-10">
            Store bank accounts, investments, property details, and important documents — 
            all encrypted with military-grade security.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {['Bank Accounts', 'Share/Demat', 'Insurance', 'Real Estate', 'Gold & Metals', 'Mutual Funds', 'EPF/PPF/NPS', 'Documents'].map((cat, i) => (
              <div key={i} className="glass rounded-xl px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                {cat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">SecureVault</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Create Your Vault</h2>
              <p className="text-gray-500 mt-1">Set up your secure digital legacy</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 border border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xs">!</div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-gray-50 hover:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-gray-50 hover:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Master Password</label>
                <input type="password" value={form.masterPassword} onChange={e => setForm({ ...form, masterPassword: e.target.value })} required
                  placeholder="Min 8 characters — this encrypts everything"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-gray-50 hover:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} required
                  placeholder="Re-enter your master password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-gray-50 hover:bg-white" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] mt-2">
                {loading ? 'Creating Vault...' : 'Create Vault'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have a vault? <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Lock, Eye, EyeOff, Shield, KeyRound, Fingerprint } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password, totpCode || undefined);
      if (res.requires2FA) {
        setShow2FA(true);
        setLoading(false);
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30 animate-pulse-glow">
              <Shield className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">SecureVault</h1>
              <p className="text-emerald-400/80 text-sm font-medium">Digital Legacy Protection</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-6">
            Protect what matters<br />
            <span className="text-emerald-400">for those who matter</span>
          </h2>

          <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-md">
            Your financial legacy, encrypted and secure. Accessible only to you — 
            and to your loved ones when they need it most.
          </p>

          <div className="space-y-4">
            {[
              { icon: Lock, text: 'Military-grade AES-256 encryption' },
              { icon: KeyRound, text: 'Dead man\'s switch for nominee access' },
              { icon: Fingerprint, text: 'Your master password never leaves your device' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">SecureVault</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 mt-1">Enter your credentials to unlock your vault</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 border border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">!</div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all bg-gray-50 hover:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Master Password</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all pr-12 bg-gray-50 hover:bg-white" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {show2FA && (
                <div className="animate-fade-in-up">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">2FA Code</label>
                  <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)} maxLength={6} placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-center tracking-[0.3em] text-lg font-mono bg-gray-50" />
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Unlocking...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" /> Unlock Vault
                  </span>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center space-y-3">
            <p className="text-gray-500 text-sm">
              Don't have a vault? <Link to="/register" className="text-emerald-600 font-semibold hover:text-emerald-700 transition">Create one</Link>
            </p>
            <p className="text-gray-500 text-sm">
              Forgot password? <Link to="/recover" className="text-amber-600 font-semibold hover:text-amber-700 transition">Reset via email</Link>
            </p>
            <Link to="/nominee-activate" 
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition px-4 py-2 rounded-lg hover:bg-white/50">
              <Shield className="w-3.5 h-3.5" /> I'm a nominee requesting access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

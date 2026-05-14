import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { KeyRound, Eye, EyeOff, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import api from '../services/api';

export default function RecoverAccount() {
  const [step, setStep] = useState('email'); // email -> otp -> newpassword
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuthData } = useAuth();
  const navigate = useNavigate();

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/recover/request-otp', { email });
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters');
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/recover/verify-otp', {
        email,
        otp: otp.trim(),
        newMasterPassword: newPassword,
      });

      localStorage.setItem('sv_token', res.data.token);
      localStorage.setItem('sv_user', JSON.stringify(res.data.user));
      setAuthData(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Recovery failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-amber-600" />
          </div>
          <span className="text-2xl font-bold text-gray-900">Account Recovery</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
          {/* Step 1: Enter email */}
          {step === 'email' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Reset Master Password</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  We'll send a one-time code to your email to verify your identity.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm border border-red-100">{error}</div>
              )}

              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all bg-gray-50 hover:bg-white" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" /> {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            </>
          )}

          {/* Step 2: Enter OTP + new password */}
          {step === 'otp' && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-xl font-bold text-gray-900">Verify & Reset</h2>
                </div>
                <p className="text-gray-500 text-sm">
                  Enter the 6-digit code sent to <strong>{email}</strong> and set your new password.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm border border-red-100">{error}</div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">OTP Code</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value)} required
                    maxLength={6} placeholder="Enter 6-digit code"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-center tracking-[0.3em] text-lg font-mono bg-gray-50" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Master Password</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                      placeholder="Min 8 characters"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all pr-12 bg-gray-50 hover:bg-white" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all bg-gray-50 hover:bg-white" />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25">
                  {loading ? 'Resetting...' : 'Reset Password & Login'}
                </button>
              </form>

              <button onClick={() => { setStep('email'); setError(''); }}
                className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 transition py-2">
                Didn't receive it? Go back and try again
              </button>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

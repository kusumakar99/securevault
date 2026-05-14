import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { 
  Landmark, TrendingUp, PieChart, Shield, Home, Gem, Wallet, Banknote, 
  CreditCard, Receipt, FileText, FolderLock, Globe, Heart, Plus, Users, Bell, Lock, ArrowRight
} from 'lucide-react';

const iconMap = {
  Landmark, TrendingUp, PieChart, Shield, Home, Gem, Wallet, Banknote,
  CreditCard, Receipt, FileText, FolderLock, Globe, Heart,
};

const categoryGradients = {
  bank_account: 'from-blue-500 to-blue-600',
  broker_demat: 'from-green-500 to-emerald-600',
  mutual_fund: 'from-purple-500 to-violet-600',
  insurance: 'from-orange-500 to-amber-600',
  real_estate: 'from-rose-500 to-pink-600',
  gold: 'from-yellow-500 to-amber-500',
  epf_ppf_nps: 'from-teal-500 to-cyan-600',
  fixed_deposit: 'from-indigo-500 to-blue-600',
  credit_card: 'from-red-500 to-rose-600',
  loan: 'from-amber-600 to-orange-600',
  tax_record: 'from-slate-500 to-gray-600',
  document: 'from-cyan-500 to-teal-600',
  digital_asset: 'from-violet-500 to-purple-600',
  personal_note: 'from-pink-500 to-rose-500',
};

const categoryBg = {
  bank_account: 'bg-blue-50 border-blue-100',
  broker_demat: 'bg-green-50 border-green-100',
  mutual_fund: 'bg-purple-50 border-purple-100',
  insurance: 'bg-orange-50 border-orange-100',
  real_estate: 'bg-rose-50 border-rose-100',
  gold: 'bg-yellow-50 border-yellow-100',
  epf_ppf_nps: 'bg-teal-50 border-teal-100',
  fixed_deposit: 'bg-indigo-50 border-indigo-100',
  credit_card: 'bg-red-50 border-red-100',
  loan: 'bg-amber-50 border-amber-100',
  tax_record: 'bg-slate-50 border-slate-200',
  document: 'bg-cyan-50 border-cyan-100',
  digital_asset: 'bg-violet-50 border-violet-100',
  personal_note: 'bg-pink-50 border-pink-100',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/vault/dashboard'),
      api.get('/vault/categories'),
    ]).then(([dashRes, catRes]) => {
      setData(dashRes.data);
      setCategories(catRes.data.categories);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-emerald-200 border-t-emerald-600" />
        <p className="text-sm text-gray-400 font-medium">Decrypting vault...</p>
      </div>
    </div>
  );

  const countMap = {};
  (data?.categoryCounts || []).forEach(c => { countMap[c.category] = c.count; });

  const stats = [
    { label: 'Vault Entries', value: data?.totalEntries || 0, icon: Lock, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50' },
    { label: 'Active Nominees', value: data?.activeNominees || 0, icon: Users, gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
    { label: 'Pending Requests', value: data?.pendingAccessRequests || 0, icon: Bell, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50' },
    { label: 'Categories', value: categories.length, icon: Shield, gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Your Vault</h1>
        <p className="text-gray-500 mt-1">Manage your financial legacy securely</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, gradient, bg }, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all group" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5 font-medium">{label}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center shadow-lg opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {data?.pendingAccessRequests > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">You have {data.pendingAccessRequests} pending access request(s)</p>
              <p className="text-sm text-amber-700">A nominee has requested access to your vault</p>
            </div>
          </div>
          <Link to="/access-requests" className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition font-medium text-sm">
            Review <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Categories Grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Asset Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat, i) => {
            const Icon = iconMap[cat.icon] || Lock;
            const count = countMap[cat.key] || 0;
            const gradient = categoryGradients[cat.key] || 'from-gray-500 to-gray-600';
            const bg = categoryBg[cat.key] || 'bg-gray-50 border-gray-100';

            return (
              <Link key={cat.key} to={`/category/${cat.key}`}
                className={`rounded-2xl border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group animate-fade-in-up ${bg}`}
                style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  {count > 0 && (
                    <span className="text-2xl font-bold text-gray-300 group-hover:text-gray-400 transition">{count}</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-gray-800">{cat.label}</h3>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  {count === 0 ? (
                    <><Plus className="w-3 h-3" /> Add first entry</>
                  ) : (
                    `${count} ${count === 1 ? 'entry' : 'entries'}`
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

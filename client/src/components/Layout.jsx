import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { Shield, Home, Users, Bell, LogOut, Lock, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/nominees', icon: Users, label: 'Nominees' },
  { to: '/access-requests', icon: Bell, label: 'Access Requests' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Top Nav */}
      <nav className="bg-slate-900/95 backdrop-blur-xl text-white shadow-xl shadow-slate-900/10 sticky top-0 z-50 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Lock className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">SecureVault</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-emerald-500/15 text-emerald-400 shadow-inner' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-gray-300 font-medium">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/5 rounded-xl transition group" title="Logout">
              <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition" />
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 hover:bg-white/5 rounded-xl">
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden border-t border-slate-700/50 px-4 py-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                onClick={() => setMobileMenu(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                    isActive ? 'bg-emerald-500/15 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }>
                <Icon className="w-4 h-4" /> {label}
              </NavLink>
            ))}
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 w-full">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

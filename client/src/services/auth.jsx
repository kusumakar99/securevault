import { useState, useEffect, createContext, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sv_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, masterPassword, totpCode) => {
    const res = await api.post('/auth/login', { email, masterPassword, totpCode });
    if (res.data.requires2FA) return { requires2FA: true };
    localStorage.setItem('sv_token', res.data.token);
    localStorage.setItem('sv_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, name, masterPassword) => {
    const res = await api.post('/auth/register', { email, name, masterPassword });
    localStorage.setItem('sv_token', res.data.token);
    localStorage.setItem('sv_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('sv_token');
    localStorage.removeItem('sv_user');
    setUser(null);
  };

  const setAuthData = (userData, token) => {
    localStorage.setItem('sv_token', token);
    localStorage.setItem('sv_user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, setAuthData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

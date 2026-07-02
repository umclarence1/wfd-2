import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    return data.user;
  };

  const adminLogin = async (email, password) => {
    const { data } = await api.post('/auth/admin/login', { email, password });
    return data;
  };

  const adminVerifyOtp = async (pendingToken, otp) => {
    const { data } = await api.post('/auth/admin/login/verify-otp', { pendingToken, otp });
    setUser(data.user);
    return data.user;
  };

  const adminResendOtp = async (pendingToken) => {
    const { data } = await api.post('/auth/admin/login/resend-otp', { pendingToken });
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      adminLogin,
      adminVerifyOtp,
      adminResendOtp,
      logout,
      refreshUser,
      isAdmin: ['admin', 'super_admin', 'support'].includes(user?.role),
    }),
    [user, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

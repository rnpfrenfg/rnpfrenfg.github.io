import { createContext, useContext, useState, useEffect } from 'react';
import { getStoredUser, setAuth as saveAuth, clearAuth, MIN_ADMIN_ROLE } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const login = (userData, token) => {
    saveAuth(userData, token);
    setUser(userData);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  const isAdmin = user && user.role >= MIN_ADMIN_ROLE;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

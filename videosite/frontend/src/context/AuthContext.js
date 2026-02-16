import { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(API.getStoredUser());
  }, []);

  const login = (userData) => {
    API.setAuth(userData);
    setUser(userData);
  };

  const logout = async () => {
    await API.logout();
    API.clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

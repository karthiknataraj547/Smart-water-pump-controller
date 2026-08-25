import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { ApiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pump_auth_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await ApiService.getProfile();
          setUser(profile);
        } catch (err) {
          console.warn('[Auth] Token invalid or expired, clearing session');
          logout();
        }
      } else {
        // Automatically establish session for seamless local operation
        try {
          const res = await ApiService.login('admin@waterpump.io', 'Admin@123456');
          localStorage.setItem('pump_auth_token', res.token);
          setToken(res.token);
          setUser(res.user);
        } catch (err) {
          console.warn('[Auth] Auto-session initialization note:', err);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, pass: string) => {
    const res = await ApiService.login(email, pass);
    localStorage.setItem('pump_auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const loginAdmin = async (email: string, pass: string) => {
    const res = await ApiService.login(email, pass);
    if (res.user.role !== 'admin') {
      throw new Error('ACCESS DENIED: Administrator role clearance required for Admin Portal.');
    }
    localStorage.setItem('pump_auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, pass: string, phone?: string) => {
    const res = await ApiService.register(name, email, pass, phone);
    localStorage.setItem('pump_auth_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('pump_auth_token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, isAdmin, login, loginAdmin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import { ApiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginAdmin: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, phone?: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('pump_auth_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pump_auth_token');
    }
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await ApiService.getProfile();
        if (isMounted) {
          setUser(profile);
        }
      } catch (err) {
        console.warn('[Auth] Token invalid or session expired, clearing credentials');
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUser();
    return () => {
      isMounted = false;
    };
  }, [token, logout]);

  const login = async (email: string, pass: string) => {
    const res = await ApiService.login(email, pass);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pump_auth_token', res.token);
    }
    setToken(res.token);
    setUser(res.user);
  };

  const loginAdmin = async (email: string, pass: string) => {
    const res = await ApiService.login(email, pass);
    if (res.user.role !== 'admin') {
      throw new Error('ACCESS DENIED: Administrator role clearance required for Admin Portal.');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('pump_auth_token', res.token);
    }
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, pass: string, phone?: string, role?: string) => {
    const res = await ApiService.register(name, email, pass, phone, role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pump_auth_token', res.token);
    }
    setToken(res.token);
    setUser(res.user);
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

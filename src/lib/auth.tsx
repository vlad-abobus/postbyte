import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { forumService } from '../services/forumService';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  isStaff: boolean;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function isStaffRole(role?: string | null): boolean {
  const normalized = (role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'moderator';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await forumService.me();
      setUser(res.user);
      return res.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await forumService.logout();
    setUser(null);
  }, []);

  const isStaff = isStaffRole(user?.role);

  return (
    <AuthContext.Provider value={{ user, authLoading, isStaff, refreshUser, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

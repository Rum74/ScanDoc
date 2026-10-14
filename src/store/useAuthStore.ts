import { create } from 'zustand';
import { api, ApiUser, getStoredToken } from '../lib/api.ts';

interface AuthState {
  user: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    try {
      set({ isLoading: true });
      const res = await api.getMe();
      set({ user: res.user, isAuthenticated: true, error: null });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, pass: string) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.login(email, pass);
      set({ user: res.user, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email: string, pass: string, name?: string) => {
    try {
      set({ isLoading: true, error: null });
      const res = await api.register(email, pass, name);
      set({ user: res.user, isAuthenticated: true, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng ký thất bại';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await api.logout();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

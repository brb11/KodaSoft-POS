import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  branchId?: string;
  tenant?: { name: string; slug: string };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken: localStorage.getItem('accessToken'),

  setAuth: (user, accessToken) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    set({ user, accessToken });
  },

  setAccessToken: (accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    set({ accessToken });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null });
  },
}));

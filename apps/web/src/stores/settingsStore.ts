import { create } from 'zustand';
import { api } from '../lib/api';

export interface StoreSettings {
  storeName: string;
  vatNumber: string;
  receiptFooter: string;
  trackInventory: boolean;
}

interface SettingsState {
  settings: StoreSettings | null;
  loaded: boolean;
  load: () => Promise<void>;
  set: (settings: StoreSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loaded: false,

  load: async () => {
    try {
      const res = await api.get('/settings');
      set({ settings: res.data.data as StoreSettings, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  set: (settings) => set({ settings }),
}));

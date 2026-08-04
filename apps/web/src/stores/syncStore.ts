import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export interface PendingOrder {
  id: string;
  payload: any;
  timestamp: number;
}

export interface SyncState {
  pendingOrders: PendingOrder[];
  isOnline: boolean;
  isSyncing: boolean;
  addPendingOrder: (payload: any) => void;
  removePendingOrder: (id: string) => void;
  setOnlineStatus: (status: boolean) => void;
  syncOrders: () => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set: any, get: any) => ({
      pendingOrders: [],
      isOnline: navigator.onLine,
      isSyncing: false,

      setOnlineStatus: (status: boolean) => {
        set({ isOnline: status });
        if (status) {
          get().syncOrders();
        }
      },

      addPendingOrder: (payload: any) => {
        const order: PendingOrder = {
          id: crypto.randomUUID(),
          payload,
          timestamp: Date.now(),
        };
        set((state: SyncState) => ({
          pendingOrders: [...state.pendingOrders, order],
        }));
      },

      removePendingOrder: (id: string) => {
        set((state: SyncState) => ({
          pendingOrders: state.pendingOrders.filter((o: PendingOrder) => o.id !== id),
        }));
      },

      syncOrders: async () => {
        const { pendingOrders, isOnline, isSyncing, removePendingOrder } = get();
        if (!isOnline || isSyncing || pendingOrders.length === 0) return;

        set({ isSyncing: true });

        for (const order of pendingOrders) {
          try {
            await api.post('/orders', order.payload);
            removePendingOrder(order.id);
          } catch (error) {
            console.error('Failed to sync order', order.id, error);
          }
        }

        set({ isSyncing: false });
      },
    }),
    {
      name: 'casheer-offline-sync',
      partialize: (state: any) => ({ pendingOrders: state.pendingOrders }),
    }
  ) as any
);

window.addEventListener('online', () => {
  useSyncStore.getState().setOnlineStatus(true);
});

window.addEventListener('offline', () => {
  useSyncStore.getState().setOnlineStatus(false);
});

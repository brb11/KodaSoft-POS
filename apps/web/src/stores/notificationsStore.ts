import { create } from 'zustand';
import { api } from '../lib/api';

export interface AppNotificationData {
  milestoneDays?: number;
  planName?: string;
  planKey?: string;
  periodEnd?: string;
  status?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: AppNotificationData | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  open: boolean;
  fetch: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setOpen: (open: boolean) => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  open: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/notifications');
      const data = res.data.data as { items: AppNotification[]; total: number; unread: number };
      set({ items: data.items, unread: data.unread, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  refreshUnread: async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      set({ unread: (res.data.data as { count: number }).count });
    } catch {
      // Ignore transient failures — the badge will be re-synced on next poll.
    }
  },

  markRead: async (id) => {
    await api.post(`/notifications/${id}/read`);
    set({
      items: get().items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
      unread: Math.max(0, get().unread - 1),
    });
  },

  markAllRead: async () => {
    await api.post('/notifications/read-all');
    set({
      items: get().items.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      unread: 0,
    });
  },

  setOpen: (open) => set({ open }),
  reset: () => set({ items: [], unread: 0, open: false }),
}));

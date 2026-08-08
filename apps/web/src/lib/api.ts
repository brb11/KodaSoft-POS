import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

export const api = axios.create({
  baseURL: '/api/v1',
  // Required so the httpOnly refresh-token cookie is sent with every request.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Single in-flight refresh: concurrent 401s share one refresh call instead of
// firing a burst of overlapping requests.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await api.post('/auth/refresh');
    const { accessToken } = res.data.data;
    useAuthStore.getState().setAccessToken(accessToken);
    return true;
  } catch {
    // Refresh failed (expired/revoked): clear local auth and redirect.
    useAuthStore.getState().logout();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return false;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    // One transparent retry after a successful refresh.
    if (status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        const token = useAuthStore.getState().accessToken;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }

    if (status === 402 && (error.response?.data as { code?: string } | undefined)?.code === 'SUBSCRIPTION_INACTIVE') {
      window.dispatchEvent(new CustomEvent('casheer:subscription-inactive'));
    }

    return Promise.reject(error);
  }
);

// Server-side logout: revokes the refresh session and clears the cookie, then
// drops the local auth state. Safe to call even if the session already expired.
export async function apiLogout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore — the session is gone either way; we still clear local state.
  }
  useAuthStore.getState().logout();
}

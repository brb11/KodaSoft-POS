export interface ReportFilters {
  period: string;
  from?: string;
  to?: string;
  branchId?: string;
}

export function toQuery(filters: ReportFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  if (filters.period === 'custom') {
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
  } else if (filters.period !== 'all') {
    params.set('period', filters.period);
  }
  if (filters.branchId) params.set('branchId', filters.branchId);
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleString();
}

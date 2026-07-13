import { getApiBase } from './getApiBase';

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  role?: string;
  pointsBalance?: number;
  walletBalanceUsd?: number;
  avatarUrl?: string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
};

export type FetchAdminUsersOptions = {
  search?: string;
  limit?: number;
  sort?: 'created' | 'points';
  minPoints?: boolean;
};

export async function fetchAdminUsers(
  getAdminHeaders: () => Record<string, string>,
  opts: FetchAdminUsersOptions = {}
): Promise<AdminUserRow[]> {
  const params = new URLSearchParams();
  const limit = opts.limit ?? (opts.search?.trim() ? 100 : 5000);
  params.set('limit', String(limit));
  if (opts.search?.trim()) params.set('search', opts.search.trim());
  if (opts.sort === 'points') params.set('sort', 'points');
  if (opts.minPoints) params.set('minPoints', '1');

  const res = await fetch(`${getApiBase()}/users?${params}`, {
    headers: getAdminHeaders() as HeadersInit,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to load users (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

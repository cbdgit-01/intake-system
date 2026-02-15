// Centralized API client - replaces Supabase client

const API_BASE = import.meta.env.VITE_API_URL || '';

// Token management
export function getToken(): string | null {
  return localStorage.getItem('cbd-intake-token');
}

export function setToken(token: string): void {
  localStorage.setItem('cbd-intake-token', token);
}

export function clearToken(): void {
  localStorage.removeItem('cbd-intake-token');
}

// Generic fetch wrapper with JWT auth
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.error || 'Request failed');
  }

  return response.json();
}

// ============ Auth API ============

export interface UserResponse {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => apiFetch<UserResponse>('/api/auth/me'),
};

// ============ Users API ============

export interface CreateUserDTO {
  username: string;
  display_name: string;
  password: string;
  role: string;
}

export interface UpdateUserDTO {
  username?: string;
  display_name?: string;
  password?: string;
  role?: string;
}

export const usersApi = {
  list: () => apiFetch<UserResponse[]>('/api/users'),

  create: (data: CreateUserDTO) =>
    apiFetch<UserResponse>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateUserDTO) =>
    apiFetch<UserResponse>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
};

// ============ Forms Sync API ============

export interface SyncOperation {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
}

export interface SyncPushResult {
  type: string;
  id: string;
  success: boolean;
  error?: string;
}

export interface SyncPullResponse {
  forms: Record<string, unknown>[];
  deleted_ids: string[];
  server_time: string;
}

export const formsApi = {
  pushSync: (operations: SyncOperation[]) =>
    apiFetch<{ results: SyncPushResult[] }>('/api/forms/sync/push', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    }),

  pullSync: (since?: string) =>
    apiFetch<SyncPullResponse>(
      `/api/forms/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`
    ),

  deleteAll: () =>
    apiFetch<void>('/api/forms', { method: 'DELETE' }),
};

// ============ Consigners API ============

export interface ConsignerResponse {
  id: string;
  consignerNumber: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const consignersApi = {
  list: () => apiFetch<ConsignerResponse[]>('/api/consigners'),

  save: (data: { consignerNumber?: string; name: string; address?: string; phone?: string; email?: string }) =>
    apiFetch<{ success: boolean; action: string }>('/api/consigners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  search: (q: string) =>
    apiFetch<ConsignerResponse[]>(`/api/consigners/search?q=${encodeURIComponent(q)}`),

  lookup: (params: { number?: string; name?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.number) searchParams.set('number', params.number);
    if (params.name) searchParams.set('name', params.name);
    return apiFetch<ConsignerResponse | null>(`/api/consigners/lookup?${searchParams.toString()}`);
  },

  deleteAll: () =>
    apiFetch<void>('/api/consigners', { method: 'DELETE' }),
};

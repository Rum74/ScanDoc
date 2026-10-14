export interface ApiUser {
  id: string;
  email: string;
  name?: string;
  usedBytes: number;
  maxBytes: number;
}

const TOKEN_KEY = 'scandoc_auth_token';
const REFRESH_KEY = 'scandoc_refresh_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Do not set Content-Type if body is FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(endpoint, { credentials: 'include', ...options, headers });

  // Handle Token Refresh on 401
  if (res.status === 401) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setStoredTokens(data.accessToken, data.refreshToken);
          headers.set('Authorization', `Bearer ${data.accessToken}`);
          // Retry original request
          res = await fetch(endpoint, { credentials: 'include', ...options, headers });
        } else {
          clearStoredTokens();
        }
      } catch {
        clearStoredTokens();
      }
    }
  }

  if (!res.ok) {
    let errorMsg = `Lỗi yêu cầu (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  async register(email: string, password: string, name?: string) {
    const data = await request<{ user: ApiUser; accessToken: string; refreshToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setStoredTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async login(email: string, password: string) {
    const data = await request<{ user: ApiUser; accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearStoredTokens();
    }
  },

  async getMe() {
    return request<{ user: ApiUser }>('/api/me');
  },

  // Documents Sync
  async getDocuments(updatedSince?: number) {
    const q = updatedSince ? `?updatedSince=${updatedSince}` : '';
    return request<{ documents: any[]; pages: any[]; serverTimestamp: number }>(`/api/documents${q}`);
  },

  async saveDocument(doc: any) {
    return request<{ document: any }>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  },

  async updateDocument(id: string, doc: any) {
    return request<{ document: any }>(`/api/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(doc),
    });
  },

  async deleteDocument(id: string) {
    return request<{ message: string; deletedAt: number }>(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  },

  // Pages
  async updatePage(id: string, pageData: any) {
    return request<{ page: any }>(`/api/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pageData),
    });
  },

  async uploadPageFiles(pageId: string, originalBlob: Blob, thumbnailBlob: Blob) {
    const formData = new FormData();
    formData.append('original', originalBlob, `page-${pageId}-orig.jpg`);
    formData.append('thumbnail', thumbnailBlob, `page-${pageId}-thumb.jpg`);

    return request<{ originalFileId: string; thumbnailFileId: string; usedBytes: number }>(
      `/api/pages/${pageId}/files`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  // Files
  async fetchFileBlob(fileId: string): Promise<Blob> {
    const token = getStoredToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`/api/files/${fileId}`, { headers });
    if (!res.ok) throw new Error('Không thể tải tệp');
    return res.blob();
  },

  // Health
  async checkHealth() {
    return request<{ status: string; uptimeSeconds: number }>('/api/health');
  },
};

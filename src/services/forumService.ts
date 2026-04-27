import { Board, IpAction, Post, Report, Thread, User } from '../types';

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE?.toString().trim().replace(/\/+$/, '') ||
  'http://localhost:5000';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const hasJsonBody = typeof init?.body === 'string';
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const j = (await res.json().catch(() => null)) as any;
      const msg = j?.error || j?.message || `Request failed: ${res.status}`;
      throw new Error(msg);
    }
    const text = await res.text().catch(() => '');
    const m = text.match(/<p>(.*?)<\/p>/i);
    throw new Error((m?.[1] || text || `Request failed: ${res.status}`).trim());
  }
  return (await res.json()) as T;
}

export const forumService = {
  // Auth + Captcha
  async getCaptcha(): Promise<{ captchaId: string; image: string }> {
    return await api<{ captchaId: string; image: string }>('/api/captcha');
  },

  async me(): Promise<{ user: User | null }> {
    return await api<{ user: User | null }>('/api/auth/me');
  },

  async login(args: { login: string; password: string; captchaId: string; captchaAnswer: string }): Promise<User> {
    const res = await api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return res.user;
  },

  async register(args: { email: string; username: string; password: string; captchaId: string; captchaAnswer: string }): Promise<User> {
    const res = await api<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return res.user;
  },

  async logout(): Promise<void> {
    await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  },

  // Image Upload
  async uploadImage(file: File): Promise<{ url: string; filename: string; size: number }> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/uploads`, { method: 'POST', body: form, credentials: 'include' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Failed to upload image. Please try again later.');
      }
      const uploaded = (await res.json()) as any;
      const url = uploaded.url?.startsWith('http') ? uploaded.url : `${API_BASE}${uploaded.url}`;
      return { url, filename: uploaded.filename || file.name, size: uploaded.size || file.size } as any;
    } catch (e) {
      console.error("Storage Error:", e);
      throw new Error("Failed to upload image. Please try again later.");
    }
  },

  // Boards
  async getBoards(): Promise<Board[]> {
    return await api<Board[]>('/api/boards');
  },

  async getBoard(boardId: string): Promise<Board | null> {
    return await api<Board | null>(`/api/boards/${encodeURIComponent(boardId)}`);
  },

  // Threads
  async getThreads(boardId: string): Promise<Thread[]> {
    return await api<Thread[]>(`/api/boards/${encodeURIComponent(boardId)}/threads`);
  },

  // Full Thread (Thread + Posts)
  async getThread(boardId: string, threadId: string): Promise<Thread | null> {
    try {
      return await api<Thread>(`/api/boards/${encodeURIComponent(boardId)}/threads/${encodeURIComponent(threadId)}`);
    } catch {
      return null;
    }
  },

  async getPosts(boardId: string, threadId: string): Promise<Post[]> {
    return await api<Post[]>(
      `/api/boards/${encodeURIComponent(boardId)}/threads/${encodeURIComponent(threadId)}/posts`,
    );
  },

  // Profiles (not implemented yet)
  async syncUser(_unused: any): Promise<User> {
    const me = await forumService.me();
    if (me.user) return me.user;
    return {
      uid: 'anonymous',
      email: '',
      role: 'user',
      displayName: 'Anonymous',
      photoURL: '',
      bio: '',
      createdAt: new Date().toISOString(),
    };
  },

  async updateUserProfile(_uid: string, _data: Partial<User>): Promise<void> {
    throw new Error('Profile editing is not enabled yet.');
  },

  async getUserProfile(_uid: string): Promise<User | null> {
    const res = await api<{ user: User }>(`/api/users/${encodeURIComponent(_uid)}`);
    return res.user;
  },

  async getUserPosts(_uid: string): Promise<Post[]> {
    return await api<Post[]>(`/api/users/${encodeURIComponent(_uid)}/posts`);
  },

  async updateMeProfile(data: { displayName?: string; bio?: string; photoURL?: string }): Promise<User> {
    const res = await api<{ user: User }>(`/api/users/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.user;
  },

  async uploadMyAvatar(file: File): Promise<User> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/users/me/avatar`, { method: 'POST', body: form, credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to upload avatar');
    }
    const j = (await res.json()) as any;
    return j.user as User;
  },

  // Reporting
  async reportPost(boardId: string, threadId: string, postId: string, reason: string): Promise<void> {
    await api(`/api/reports`, {
      method: 'POST',
      body: JSON.stringify({ boardId, threadId, postId, reason }),
    });
  },

  async getReports(): Promise<Report[]> {
    const adminKey = (import.meta as any).env?.VITE_ADMIN_KEY;
    return await api<Report[]>('/api/reports', {
      headers: adminKey ? { 'X-Admin-Key': adminKey } : {},
    });
  },

  async adminListUsers(): Promise<User[]> {
    return await api<User[]>('/api/admin/users');
  },

  async adminSetUserRole(uid: string, role: 'admin' | 'moderator' | 'user'): Promise<User> {
    const res = await api<{ user: User }>(`/api/admin/users/${encodeURIComponent(uid)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    return res.user;
  },

  async adminListIpActions(): Promise<IpAction[]> {
    return await api<IpAction[]>('/api/admin/ip-actions');
  },

  async adminCreateIpAction(args: { type: 'ban' | 'mute'; ip: string; reason?: string; durationHours?: number | null }): Promise<IpAction> {
    const res = await api<{ item: IpAction }>('/api/admin/ip-actions', {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return res.item;
  },

  async adminDisableIpAction(type: 'ban' | 'mute', id: string): Promise<void> {
    await api(`/api/admin/ip-actions/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async adminClearIpActionsByIp(ip: string, type?: 'ban' | 'mute'): Promise<number> {
    const res = await api<{ ok: boolean; changed: number }>('/api/admin/ip-actions/clear', {
      method: 'POST',
      body: JSON.stringify({ ip, type: type || '' }),
    });
    return res.changed || 0;
  },

  // Posting (Updated to include author details)
  async createThread(boardId: string, title: string, authorName: string, content: string, image?: any): Promise<string> {
    return await api<string>(`/api/boards/${encodeURIComponent(boardId)}/threads`, {
      method: 'POST',
      body: JSON.stringify({ title, authorName, content, image: image || null }),
    });
  },

  async createReply(boardId: string, threadId: string, authorName: string, content: string, image?: any): Promise<void> {
    await api(`/api/boards/${encodeURIComponent(boardId)}/threads/${encodeURIComponent(threadId)}/posts`, {
      method: 'POST',
      body: JSON.stringify({ authorName, content, image: image || null }),
    });
  },

  // Admin Actions
  async deletePost(boardId: string, threadId: string, postId: string): Promise<void> {
    const adminKey = (import.meta as any).env?.VITE_ADMIN_KEY;
    await api(`/api/boards/${encodeURIComponent(boardId)}/threads/${encodeURIComponent(threadId)}/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: adminKey ? { 'X-Admin-Key': adminKey } : {},
    });
  },

  async togglePin(boardId: string, threadId: string, isPinned: boolean): Promise<void> {
    throw new Error('Not implemented in Flask backend build.');
  },

  async toggleLock(boardId: string, threadId: string, isLocked: boolean): Promise<void> {
    throw new Error('Not implemented in Flask backend build.');
  },

  async seedData(): Promise<void> {
    // Flask backend seeds boards on startup.
    return;
  },
  async bootstrapAdmin(uid: string, email: string): Promise<void> {
    return;
  }
};

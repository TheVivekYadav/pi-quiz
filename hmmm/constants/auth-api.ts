import { apiUrl } from './api';

export interface AuthToken {
  userId: number;
  rollNumber: string;
  role: 'admin' | 'user';
  token: string;
  sessionId: string;
}

export interface AuthUser {
  authenticated: boolean;
  userId?: number;
  rollNumber?: string;
  role?: string;
  sessionId?: string;
}

export interface SessionItem {
  sessionId: string;
  deviceName?: string | null;
  platform?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastSeenAt: string;
  isBlocked: boolean;
  blockedAt?: string | null;
  blockedReason?: string | null;
  revokedAt?: string | null;
  current: boolean;
}

export interface SessionListResponse {
  maxActiveDevices: number;
  sessions: SessionItem[];
}

export interface AuthLogEntry {
  id: number;
  user_id: number;
  session_id: string | null;
  event_type: string;
  details: Record<string, any>;
  created_at: string;
}

export interface AuthLogResponse {
  userId: number;
  count: number;
  logs: AuthLogEntry[];
}

async function json(response: Promise<Response>) {
  const res = await response;
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.message || 'Request failed');
  }
  return payload;
}

export async function login(
  rollNumber: string,
  name?: string,
  email?: string,
  branch?: string,
  year?: number,
  deviceName?: string,
  deviceId?: string,
  platform?: string,
): Promise<AuthToken> {
  return json(
    fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber, name, email, branch, year, deviceName, deviceId, platform }),
    })
  );
}

export async function logout(token: string): Promise<{ success: boolean }> {
  return json(
    fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return json(
    fetch(apiUrl('/auth/me'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function getSessions(token: string): Promise<SessionListResponse> {
  return json(
    fetch(apiUrl('/auth/sessions'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function blockSession(token: string, sessionId: string, reason?: string): Promise<{ success: boolean }> {
  return json(
    fetch(apiUrl(`/auth/sessions/${sessionId}/block`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    })
  );
}

export async function unblockSession(token: string, sessionId: string): Promise<{ success: boolean }> {
  return json(
    fetch(apiUrl(`/auth/sessions/${sessionId}/unblock`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function getAuthLogs(token: string, limit = 100): Promise<AuthLogResponse> {
  return json(
    fetch(apiUrl(`/auth/logs?limit=${limit}`), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

import { apiUrl } from './api';

export interface AuthToken {
  userId: number;
  rollNumber: string;
  role: 'admin' | 'user';
  token: string;
}

export interface AuthUser {
  authenticated: boolean;
  userId?: number;
  rollNumber?: string;
  role?: string;
}

async function json(response: Promise<Response>) {
  const res = await response;
  return res.json();
}

export async function login(rollNumber: string, name?: string, email?: string): Promise<AuthToken> {
  return json(
    fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollNumber, name, email }),
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

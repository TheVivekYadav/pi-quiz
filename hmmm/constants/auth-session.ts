// Simple in-memory storage for auth token
let storedToken: string | null = null;
let storedUser:
  | {
      userId: number;
      rollNumber: string;
      role: 'admin' | 'user';
      sessionId?: string;
      branch?: string;
      year?: number;
    }
  | null = null;

export function setAuthToken(
  token: string,
  userId: number,
  rollNumber: string,
  role: 'admin' | 'user',
  sessionId?: string,
  branch?: string,
  year?: number,
) {
  storedToken = token;
  storedUser = { userId, rollNumber, role, sessionId, branch, year };
}

export function getAuthToken(): string | null {
  return storedToken;
}

export function getAuthUser() {
  return storedUser;
}

export function isAuthenticated(): boolean {
  return storedToken !== null;
}

export function clearAuth() {
  storedToken = null;
  storedUser = null;
}

export function isAdmin(): boolean {
  return storedUser?.role === 'admin' || false;
}

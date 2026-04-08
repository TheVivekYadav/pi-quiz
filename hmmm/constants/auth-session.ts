// Simple auth session storage — persists to AsyncStorage so users stay logged in across app restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pi_quiz_auth';

type StoredUser = {
  userId: number;
  rollNumber: string;
  role: 'admin' | 'user';
  sessionId?: string;
  branch?: string;
  year?: number;
};

type StoredAuth = {
  token: string;
  user: StoredUser;
};

// In-memory cache for synchronous reads within the same session
let _token: string | null = null;
let _user: StoredUser | null = null;

/** Load persisted auth from AsyncStorage (call once at app startup). */
export async function loadPersistedAuth(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredAuth = JSON.parse(raw);
      _token = parsed.token ?? null;
      _user = parsed.user ?? null;
      return;
    }
  } catch {
    // Ignore — try fallback
  }

  // Fallback for web builds when AsyncStorage may not be available
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: StoredAuth = JSON.parse(raw);
        _token = parsed.token ?? null;
        _user = parsed.user ?? null;
      }
    }
  } catch {
    // ignore
  }
}

export function setAuthToken(
  token: string,
  userId: number,
  rollNumber: string,
  role: 'admin' | 'user',
  sessionId?: string,
  branch?: string,
  year?: number,
) {
  _token = token;
  _user = { userId, rollNumber, role, sessionId, branch, year };
  const payload: StoredAuth = { token, user: _user };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {}
}

export function getAuthToken(): string | null {
  return _token;
}

export function getAuthUser(): StoredUser | null {
  return _user;
}

export function isAuthenticated(): boolean {
  return _token !== null;
}

export function clearAuth() {
  _token = null;
  _user = null;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function isAdmin(): boolean {
  return _user?.role === 'admin' || false;
}

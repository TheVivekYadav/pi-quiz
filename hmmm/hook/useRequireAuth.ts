import { isAuthenticated } from '@/constants/auth-session';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

/**
 * Redirect unauthenticated users to the login screen.
 * Call this hook at the top of any screen that requires authentication.
 *
 * @param redirectBack - optional path to redirect back to after login (passed as query param)
 */
export function useRequireAuth(redirectBack?: string): void {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isAuthenticated()) {
      const dest = redirectBack ? `/login?redirectTo=${encodeURIComponent(redirectBack)}` : '/login';
      router.replace(dest as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);
}

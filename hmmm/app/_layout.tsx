import { getCurrentUser } from "@/constants/auth-api";
import { clearAuth, loadPersistedAuth, setAuthToken } from "@/constants/auth-session";
import { loadPersistedResults, loadPersistedTimers } from "@/constants/quiz-session";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await loadPersistedAuth().catch((err) => console.error('Auth load error:', err));
      await loadPersistedResults().catch(() => { });
      await loadPersistedTimers().catch(() => { });

      // Re-verify token and sync role from server so a tampered localStorage
      // cannot grant stale admin privileges.
      try {
        const { getAuthToken, getAuthUser } = await import("@/constants/auth-session");
        const token = getAuthToken();
        const localUser = getAuthUser();
        if (token && localUser) {
          const me = await getCurrentUser(token);
          if (!me.authenticated) {
            // Token rejected by server — clear local auth
            clearAuth();
          } else if (me.role && me.role !== localUser.role) {
            // Role changed on server — update local cache
            setAuthToken(
              token,
              me.userId!,
              me.rollNumber!,
              me.role as 'admin' | 'user',
              me.sessionId,
              me.branch,
              me.year,
            );
          }
        }
      } catch {
        // Network may be down — keep cached auth as-is
      }
    };

    init().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quiz/[id]" />
      <Stack.Screen name="quiz/[id]/lobby" />
      <Stack.Screen name="quiz/[id]/question/[index]" />
      <Stack.Screen name="quiz/[id]/result" />
      <Stack.Screen name="quiz/[id]/winners" />
      <Stack.Screen name="quiz/[id]/report" />
      <Stack.Screen name="admin/user-sessions" />
      <Stack.Screen name="create" />
      <Stack.Screen name="create-quiz" />
      <Stack.Screen name="forms/index" />
      <Stack.Screen name="fill/[id]" />
      <Stack.Screen name="responses/[id]" />
    </Stack>
  );
}

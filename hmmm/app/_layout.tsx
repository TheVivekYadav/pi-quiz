import { loadPersistedAuth } from "@/constants/auth-session";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPersistedAuth().catch((err) => console.error('Auth load error:', err)).finally(() => setReady(true));
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
      <Stack.Screen name="forms" />
      <Stack.Screen name="fill/[id]" />
      <Stack.Screen name="responses/[id]" />
    </Stack>
  );
}

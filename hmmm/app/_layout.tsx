import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="quiz/[id]" />
      <Stack.Screen name="quiz/[id]/lobby" />
      <Stack.Screen name="quiz/[id]/question/[index]" />
      <Stack.Screen name="quiz/[id]/result" />
      <Stack.Screen name="create" />
      <Stack.Screen name="forms" />
      <Stack.Screen name="fill/[id]" />
      <Stack.Screen name="responses/[id]" />
    </Stack>
  );
}

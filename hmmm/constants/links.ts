const configuredApkUrl = process.env.EXPO_PUBLIC_ANDROID_APK_URL?.trim();

export const ANDROID_APK_URL =
  configuredApkUrl || "https://pit.engineer/downloads/pi-quiz.apk";

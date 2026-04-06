import { Platform } from "react-native";

const fallbackBase =
  Platform.OS === "web" ? "/api" : "https://pit.engineer/api";

const configuredBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = configuredBase || fallbackBase;

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

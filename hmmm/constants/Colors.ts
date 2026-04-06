const Colors = {
  light: {
    // 🌕 Base
    background: "#ffffff",
    surface: "#f9fafb",
    surfaceLight: "#f3f4f6",
    border: "#e5e7eb",
    divider: "#d4d4d8",

    // 🍑 Primary (Peach)
    primary: "#ff8a61",
    primaryHover: "#ff7043",
    primaryMuted: "rgba(255, 138, 97, 0.15)",

    // 💎 Accent (Emerald)
    accent: "#059669",
    accentMuted: "rgba(5, 150, 105, 0.15)",

    // 🌿 Success (Green)
    success: "#16a34a",
    successMuted: "rgba(22, 163, 74, 0.15)",

    // ❌ Error
    error: "#dc2626",
    errorMuted: "rgba(220, 38, 38, 0.15)",

    // ⚠️ Warning
    warning: "#d97706",
    warningMuted: "rgba(217, 119, 6, 0.15)",

    // 📝 Text
    textPrimary: "#111827",
    textSecondary: "#374151",
    textMuted: "#6b7280",
    textInverse: "#ffffff",

    // 🎯 Quiz states
    optionDefault: "#f3f4f6",
    optionSelected: "#059669",
    optionCorrect: "#16a34a",
    optionWrong: "#dc2626",

    // 🔘 Buttons
    buttonPrimary: "#ff8a61",
    buttonSecondary: "#e5e7eb",
    buttonDisabled: "#d1d5db",

    shadow: "rgba(0,0,0,0.1)",
  },

  dark: {
    // 🌑 Base
    background: "#0b0b0c",
    surface: "#121214",
    surfaceLight: "#1c1c1f",
    border: "#2a2a2e",
    divider: "#3a3a3f",

    // 🍑 Primary
    primary: "#ff9e7a",
    primaryHover: "#ff8a61",
    primaryMuted: "rgba(255, 158, 122, 0.15)",

    // 💎 Accent
    accent: "#10b981",
    accentMuted: "rgba(16, 185, 129, 0.15)",

    // 🌿 Success
    success: "#22c55e",
    successMuted: "rgba(34, 197, 94, 0.15)",

    // ❌ Error
    error: "#ef4444",
    errorMuted: "rgba(239, 68, 68, 0.15)",

    // ⚠️ Warning
    warning: "#f59e0b",
    warningMuted: "rgba(245, 158, 11, 0.15)",

    // 📝 Text
    textPrimary: "#f4f4f5",
    textSecondary: "#a1a1aa",
    textMuted: "#71717a",
    textInverse: "#09090b",

    // 🎯 Quiz states
    optionDefault: "#1c1c1f",
    optionSelected: "#10b981",
    optionCorrect: "#22c55e",
    optionWrong: "#ef4444",

    // 🔘 Buttons
    buttonPrimary: "#ff9e7a",
    buttonSecondary: "#27272a",
    buttonDisabled: "#3f3f46",

    shadow: "rgba(0,0,0,0.5)",
  },
} as const;

export default Colors;
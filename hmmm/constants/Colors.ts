const Colors = {
  light: {
    background: "#eeebf7",
    surface: "#f6f4fd",
    surfaceLight: "#ffffff",
    border: "#dcd7f2",
    divider: "#d4cef0",

    primary: "#3f51b5",
    primaryHover: "#3344a5",
    primaryMuted: "rgba(63, 81, 181, 0.14)",

    accent: "#00bcd4",
    accentMuted: "rgba(0, 188, 212, 0.16)",

    success: "#0c8f73",
    successMuted: "rgba(12, 143, 115, 0.14)",

    error: "#d93c67",
    errorMuted: "rgba(217, 60, 103, 0.14)",

    warning: "#f5c518",
    warningMuted: "rgba(245, 197, 24, 0.2)",

    textPrimary: "#171748",
    textSecondary: "#3f3f73",
    textMuted: "#7a7aa4",
    textInverse: "#ffffff",

    optionDefault: "#dfdaf4",
    optionSelected: "#00bcd4",
    optionCorrect: "#0c8f73",
    optionWrong: "#d93c67",

    buttonPrimary: "#3f51b5",
    buttonSecondary: "#e4e0f4",
    buttonDisabled: "#c7c2df",

    shadow: "rgba(35, 29, 84, 0.16)",
  },

  dark: {
    background: "#111128",
    surface: "#1a1a3d",
    surfaceLight: "#242451",
    border: "#35356f",
    divider: "#3d3d7f",

    primary: "#7f90ff",
    primaryHover: "#6e81fa",
    primaryMuted: "rgba(127, 144, 255, 0.2)",

    accent: "#3dd5eb",
    accentMuted: "rgba(61, 213, 235, 0.2)",

    success: "#48c2a6",
    successMuted: "rgba(72, 194, 166, 0.2)",

    error: "#ff6f98",
    errorMuted: "rgba(255, 111, 152, 0.2)",

    warning: "#ffe066",
    warningMuted: "rgba(255, 224, 102, 0.2)",

    textPrimary: "#f0efff",
    textSecondary: "#cbc8ec",
    textMuted: "#a19cc7",
    textInverse: "#0f0e26",

    optionDefault: "#29295b",
    optionSelected: "#3dd5eb",
    optionCorrect: "#48c2a6",
    optionWrong: "#ff6f98",

    buttonPrimary: "#7f90ff",
    buttonSecondary: "#2f2f64",
    buttonDisabled: "#44447c",

    shadow: "rgba(0,0,0,0.45)",
  },
} as const;

export default Colors;
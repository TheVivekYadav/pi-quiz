import { isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
    const theme = useTheme();
    const adminView = isAdmin();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textMuted,
                tabBarStyle: {
                    backgroundColor: theme.surfaceLight,
                    borderTopColor: theme.border,
                    height: 68,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Dashboard",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="grid-outline" color={color} size={size} />
                    ),
                }}
            />
            <Tabs.Screen
                name="quizzes"
                options={{
                    title: "Quizzes",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="help-circle-outline" color={color} size={size} />
                    ),
                }}
            />
            {adminView && (
                <Tabs.Screen
                    name="reports"
                    options={{
                        title: "Reports",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="bar-chart-outline" color={color} size={size} />
                        ),
                    }}
                />
            )}
            <Tabs.Screen
                name="settings"
                options={{
                    title: "Settings",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="settings-outline" color={color} size={size} />
                    ),
                }}
            />
            {adminView && (
                <Tabs.Screen
                    name="admin"
                    options={{
                        title: "Admin",
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="shield-checkmark-outline" color={color} size={size} />
                        ),
                    }}
                />
            )}
        </Tabs>
    );
}

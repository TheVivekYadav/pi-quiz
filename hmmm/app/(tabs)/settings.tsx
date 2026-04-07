import { useTheme } from "@/hook/theme";
import { clearAuth, getAuthUser, isAdmin } from "@/constants/auth-session";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsTab() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const user = getAuthUser();
    const adminView = isAdmin();

    const handleLogout = () => {
        clearAuth();
        router.replace("/login" as any);
    };

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>PROFILE</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Ionicons name="person-circle-outline" size={26} color={theme.primary} />
                <View>
                    <Text style={[styles.name, { color: theme.textPrimary }]}>{user?.rollNumber ?? "Unknown User"}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>{adminView ? "Administrator" : "Learner"}</Text>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Ionicons name="notifications-outline" size={22} color={theme.primary} />
                <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>Notifications</Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color={theme.primary} />
                <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>Privacy</Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Ionicons name="color-palette-outline" size={22} color={theme.primary} />
                <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>Theme</Text>
            </View>

            {adminView && (
                <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}> 
                    <Ionicons name="shield-outline" size={22} color={theme.primary} />
                    <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>Admin privileges enabled</Text>
                </View>
            )}

            <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: pressed ? 0.85 : 1,
                    },
                ]}
            >
                <Ionicons name="log-out-outline" size={22} color={theme.error} />
                <Text style={[styles.itemLabel, { color: theme.error }]}>Logout</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, marginBottom: 12, fontSize: 34, fontWeight: "800" },
    card: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    name: { fontSize: 19, fontWeight: "700" },
    meta: { fontSize: 13 },
    itemLabel: { fontSize: 16, fontWeight: "600" },
});

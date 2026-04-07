import { isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminTab() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    if (!isAdmin()) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={[styles.denied, { color: theme.error }]}>Access denied</Text>
                <Text style={[styles.deniedSub, { color: theme.textSecondary }]}>This section is available for admins only.</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN CONSOLE</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Manage Platform</Text>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Quiz Management</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Create, publish, and monitor quizzes.</Text>
                <Pressable
                    onPress={() => router.push("/create" as any)}
                    style={({ pressed }) => [
                        styles.action,
                        { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
                    ]}
                >
                    <Ionicons name="add-circle-outline" size={18} color={theme.textInverse} />
                    <Text style={[styles.actionText, { color: theme.textInverse }]}>Open Creator</Text>
                </Pressable>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Analytics</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Review enrollments, attempts, and leaderboard trends.</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Admin Status</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>You are signed in with admin privileges.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, marginBottom: 12, fontSize: 34, fontWeight: "800" },
    denied: { fontSize: 22, fontWeight: "800" },
    deniedSub: { marginTop: 6, fontSize: 14 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    cardTitle: { fontSize: 20, fontWeight: "700" },
    cardSub: { marginTop: 6, fontSize: 14, lineHeight: 20 },
    action: {
        marginTop: 12,
        alignSelf: "flex-start",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    actionText: { fontSize: 13, fontWeight: "700" },
});

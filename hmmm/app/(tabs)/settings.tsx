import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsTab() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

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
                    <Text style={[styles.name, { color: theme.textPrimary }]}>Alex Rivera</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>Premium Learner</Text>
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

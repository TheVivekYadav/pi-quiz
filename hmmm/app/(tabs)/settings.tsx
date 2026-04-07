import { blockSession, getAuthLogs, getSessions, logout, SessionItem, unblockSession } from "@/constants/auth-api";
import { clearAuth, getAuthToken, getAuthUser, isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsTab() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const user = getAuthUser();
    const adminView = isAdmin();
    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [logs, setLogs] = useState<Array<{ id: number; event_type: string; created_at: string }>>([]);
    const [maxActiveDevices, setMaxActiveDevices] = useState(2);

    const handleLogout = async () => {
        const token = getAuthToken();
        if (token) {
            try {
                await logout(token);
            } catch {
                // proceed with local logout even if API call fails
            }
        }
        clearAuth();
        router.replace("/login" as any);
    };

    useEffect(() => {
        const run = async () => {
            const token = getAuthToken();
            if (!token) return;

            try {
                const sessionPayload = await getSessions(token);
                setSessions(sessionPayload.sessions || []);
                setMaxActiveDevices(sessionPayload.maxActiveDevices || 2);

                const logsPayload = await getAuthLogs(token, 25);
                setLogs((logsPayload.logs || []).map((l) => ({ id: l.id, event_type: l.event_type, created_at: l.created_at })));
            } catch (error) {
                console.error("Failed to load security data", error);
            }
        };

        run();
    }, []);

    const handleSessionToggle = async (session: SessionItem) => {
        const token = getAuthToken();
        if (!token) return;

        try {
            if (session.isBlocked) {
                await unblockSession(token, session.sessionId);
            } else {
                await blockSession(token, session.sessionId, "Blocked from settings");
            }

            const payload = await getSessions(token);
            setSessions(payload.sessions || []);
        } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to update device state");
        }
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

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Device Sessions ({sessions.filter((s) => !s.revokedAt && !s.isBlocked).length}/{maxActiveDevices})</Text>
            {sessions.map((session) => (
                <View key={session.sessionId} style={[styles.sessionCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.name, { color: theme.textPrimary }]}>
                        {session.deviceName || session.platform || "Unknown Device"} {session.current ? "(Current)" : ""}
                    </Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>Last seen: {new Date(session.lastSeenAt).toLocaleString()}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>Status: {session.isBlocked ? "Blocked" : session.revokedAt ? "Logged out" : "Active"}</Text>
                    {!session.current && !session.revokedAt && (
                        <Pressable
                            onPress={() => handleSessionToggle(session)}
                            style={({ pressed }) => [
                                styles.smallBtn,
                                {
                                    backgroundColor: session.isBlocked ? theme.buttonPrimary : theme.error,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.smallBtnText, { color: theme.textInverse }]}>{session.isBlocked ? "Unblock" : "Block"}</Text>
                        </Pressable>
                    )}
                </View>
            ))}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Auth Logs</Text>
            {logs.map((log) => (
                <View key={log.id} style={[styles.logCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.itemLabel, { color: theme.textPrimary }]}>{log.event_type}</Text>
                    <Text style={[styles.meta, { color: theme.textMuted }]}>{new Date(log.created_at).toLocaleString()}</Text>
                </View>
            ))}

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
    sectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 20, fontWeight: "800" },
    sessionCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
    logCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
    smallBtn: {
        marginTop: 8,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
    },
    smallBtnText: { fontSize: 12, fontWeight: "700" },
});

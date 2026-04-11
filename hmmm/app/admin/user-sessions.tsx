import { adminBlockUserSession, adminListUserSessions, adminRemoveUserSession, adminUnblockUserSession, SessionItem } from "@/constants/auth-api";
import { getAuthToken } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminUserSessionsScreen() {
    const { userId, userName } = useLocalSearchParams<{ userId: string; userName?: string }>();
    const targetUserId = useMemo(() => Number(Array.isArray(userId) ? userId[0] : userId), [userId]);
    const displayName = Array.isArray(userName) ? userName[0] : userName;

    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const load = async () => {
        const token = getAuthToken();
        if (!token || !targetUserId) return;
        setLoading(true);
        try {
            const result = await adminListUserSessions(token, targetUserId);
            setSessions(result);
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to load sessions.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [targetUserId]);

    const blockSession = async (session: SessionItem, reason?: string) => {
        const token = getAuthToken();
        if (!token) return;
        setActioningId(session.sessionId);
        try {
            await adminBlockUserSession(token, session.sessionId, reason || undefined);
            await load();
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to block session.");
        } finally {
            setActioningId(null);
        }
    };

    const handleBlock = (session: SessionItem) => {
        const label = session.deviceName ?? session.sessionId.slice(0, 8);

        if (Platform.OS === "ios" && typeof (Alert as any).prompt === "function") {
            (Alert as any).prompt(
                "Block Session",
                `Enter reason for blocking session (${label}):`,
                (reason: string) => {
                    void blockSession(session, reason);
                },
                "plain-text",
            );
            return;
        }

        Alert.alert(
            "Block Session",
            `Block session ${label}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block",
                    style: "destructive",
                    onPress: () => {
                        void blockSession(session);
                    },
                },
            ],
        );
    };

    const handleUnblock = (session: SessionItem) => {
        Alert.alert(
            "Unblock Session",
            `Unblock session for ${session.deviceName ?? session.sessionId.slice(0, 8)}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unblock",
                    onPress: async () => {
                        const token = getAuthToken();
                        if (!token) return;
                        setActioningId(session.sessionId);
                        try {
                            await adminUnblockUserSession(token, session.sessionId);
                            await load();
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "Failed to unblock session.");
                        } finally {
                            setActioningId(null);
                        }
                    },
                },
            ]
        );
    };

    const handleRemove = (session: SessionItem) => {
        Alert.alert(
            "Remove Session",
            `Remove session for ${session.deviceName ?? session.sessionId.slice(0, 8)}? This will sign the device out immediately.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        const token = getAuthToken();
                        if (!token) return;
                        setActioningId(session.sessionId);
                        try {
                            await adminRemoveUserSession(token, session.sessionId);
                            await load();
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "Failed to remove session.");
                        } finally {
                            setActioningId(null);
                        }
                    },
                },
            ]
        );
    };

    const statusLabel = (s: SessionItem) => {
        if (s.isBlocked) return "Blocked";
        if (s.revokedAt) return "Revoked";
        return "Active";
    };

    const statusColor = (s: SessionItem) => {
        if (s.isBlocked) return theme.error;
        if (s.revokedAt) return theme.textMuted;
        return theme.success;
    };

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Pressable onPress={() => router.back()} style={styles.back}>
                <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN • USER SESSIONS</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{displayName ?? `User #${targetUserId}`}</Text>

            {loading ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
            ) : sessions.length === 0 ? (
                <Text style={[styles.empty, { color: theme.textMuted }]}>No sessions found for this user.</Text>
            ) : (
                sessions.map((s) => (
                    <View
                        key={s.sessionId}
                        style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                    >
                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={[styles.device, { color: theme.textPrimary }]}>
                                    {s.deviceName ?? "Unknown device"} {s.platform ? `(${s.platform})` : ""}
                                </Text>
                                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                                    Last seen: {new Date(s.lastSeenAt).toLocaleString()}
                                </Text>
                                {s.ipAddress && (
                                    <Text style={[styles.meta, { color: theme.textMuted }]}>IP: {s.ipAddress}</Text>
                                )}
                                {s.isBlocked && s.blockedReason && (
                                    <Text style={[styles.meta, { color: theme.error }]}>Reason: {s.blockedReason}</Text>
                                )}
                            </View>
                            <View style={[styles.badge, { backgroundColor: `${statusColor(s)}22` }]}>
                                <Text style={[styles.badgeText, { color: statusColor(s) }]}>{statusLabel(s)}</Text>
                            </View>
                        </View>

                        <View style={styles.actions}>
                            {actioningId === s.sessionId ? (
                                <ActivityIndicator color={theme.primary} />
                            ) : null}
                            {!actioningId && !s.revokedAt && !s.isBlocked && (
                                <Pressable
                                    onPress={() => handleBlock(s)}
                                    style={[styles.actionBtn, { backgroundColor: theme.error }]}
                                >
                                    <Ionicons name="ban-outline" size={14} color={theme.textInverse} />
                                    <Text style={[styles.actionText, { color: theme.textInverse }]}>Block</Text>
                                </Pressable>
                            )}
                            {!actioningId && s.isBlocked && (
                                <Pressable
                                    onPress={() => handleUnblock(s)}
                                    style={[styles.actionBtn, { backgroundColor: theme.success }]}
                                >
                                    <Ionicons name="lock-open-outline" size={14} color={theme.textInverse} />
                                    <Text style={[styles.actionText, { color: theme.textInverse }]}>Unblock</Text>
                                </Pressable>
                            )}
                            {!actioningId && (
                                <Pressable
                                    onPress={() => handleRemove(s)}
                                    style={[styles.actionBtn, { backgroundColor: theme.textMuted }]}
                                >
                                    <Ionicons name="trash-outline" size={14} color={theme.textInverse} />
                                    <Text style={[styles.actionText, { color: theme.textInverse }]}>Remove</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    back: { marginBottom: 8 },
    backText: { fontSize: 15, fontWeight: "700" },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, fontSize: 34, lineHeight: 38, fontWeight: "800", marginBottom: 16 },
    empty: { marginTop: 20, fontSize: 15 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    device: { fontSize: 15, fontWeight: "700" },
    meta: { fontSize: 12, marginTop: 2 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    badgeText: { fontSize: 12, fontWeight: "700" },
    actions: { marginTop: 10, flexDirection: "row", gap: 8 },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    actionText: { fontSize: 13, fontWeight: "700" },
});

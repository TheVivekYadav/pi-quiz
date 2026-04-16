import { adminGenerateAttendanceToken, adminGetAttendanceToken, adminSetAttendanceRequired, AttendanceTokenPayload } from "@/constants/quiz-api";
import { getAuthToken, isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AttendanceQRScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [payload, setPayload] = useState<AttendanceTokenPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Guard: admins only
    const adminCheck = isAdmin();

    const load = async () => {
        if (!quizId) return;
        try {
            const data = await adminGetAttendanceToken(quizId);
            setPayload(data);
            setError(null);
        } catch (err: any) {
            setError(err?.message ?? "Failed to load attendance info");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId]);

    const handleGenerate = async () => {
        if (!quizId) return;
        setRefreshing(true);
        try {
            const data = await adminGenerateAttendanceToken(quizId);
            setPayload(data);
            setError(null);
        } catch (err: any) {
            Alert.alert("Error", err?.message ?? "Failed to generate QR code");
        } finally {
            setRefreshing(false);
        }
    };

    const handleToggleRequired = async (value: boolean) => {
        if (!quizId) return;
        setToggling(true);
        try {
            await adminSetAttendanceRequired(quizId, value);
            setPayload((prev) => prev ? { ...prev, attendanceRequired: value } : prev);
        } catch (err: any) {
            Alert.alert("Error", err?.message ?? "Failed to update setting");
        } finally {
            setToggling(false);
        }
    };

    if (!adminCheck) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.error, fontSize: 15 }}>Admin access required.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const isRequired = payload?.attendanceRequired ?? false;
    const hasToken = !!(payload?.token && payload.qrDataUrl);
    const expiresAt = payload?.expiresAt ? new Date(payload.expiresAt) : null;
    const expired = expiresAt ? Date.now() > expiresAt.getTime() : false;

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom + 32,
                paddingHorizontal: 16,
            }}
        >
            <Pressable onPress={() => router.back()} style={styles.backRow}>
                <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
                <Text style={[styles.backText, { color: theme.textSecondary }]}>Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Attendance QR</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Enable QR attendance and display this code to participants so they can check in on-site before starting the quiz.
            </Text>

            {error && (
                <View style={[styles.alertBox, { backgroundColor: theme.errorMuted, borderColor: theme.error }]}>
                    <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
                    <Text style={[styles.alertText, { color: theme.error }]}>{error}</Text>
                </View>
            )}

            {/* Toggle: attendance required */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.settingRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Require QR Check-In</Text>
                        <Text style={[styles.settingHint, { color: theme.textSecondary }]}>
                            When enabled, participants must scan the QR code before they can start the quiz.
                        </Text>
                    </View>
                    {toggling ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                        <Switch
                            value={isRequired}
                            onValueChange={handleToggleRequired}
                            trackColor={{ true: theme.primary, false: theme.border }}
                            thumbColor={theme.textInverse}
                        />
                    )}
                </View>
            </View>

            {/* QR display */}
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Session QR Code</Text>
                <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
                    This code is valid for 4 hours. Participants must scan it with their device while on-site.
                    Tap "Refresh QR" to invalidate all previous codes and generate a new one.
                </Text>

                {hasToken && !expired ? (
                    <>
                        <View style={styles.qrWrapper}>
                            <Image
                                source={{ uri: payload!.qrDataUrl }}
                                style={styles.qrImage}
                                resizeMode="contain"
                            />
                        </View>
                        {expiresAt && (
                            <View style={[styles.expiryBadge, { backgroundColor: theme.primaryMuted }]}>
                                <Ionicons name="time-outline" size={13} color={theme.primary} />
                                <Text style={[styles.expiryText, { color: theme.primary }]}>
                                    Expires: {expiresAt.toLocaleString([], {
                                        month: "short", day: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                    })}
                                </Text>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={[styles.qrPlaceholder, { borderColor: theme.border }]}>
                        <Ionicons name="qr-code-outline" size={64} color={theme.textMuted} />
                        <Text style={[styles.qrPlaceholderText, { color: theme.textMuted }]}>
                            {expired ? "QR code has expired" : "No QR code yet"}
                        </Text>
                        <Text style={[styles.qrPlaceholderHint, { color: theme.textMuted }]}>
                            Tap "Generate QR" below to create one
                        </Text>
                    </View>
                )}

                <Pressable
                    onPress={handleGenerate}
                    disabled={refreshing}
                    style={({ pressed }) => [
                        styles.generateBtn,
                        {
                            backgroundColor: refreshing ? theme.buttonDisabled : theme.buttonPrimary,
                            opacity: pressed ? 0.9 : 1,
                            marginTop: 16,
                        },
                    ]}
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color={theme.textInverse} />
                    ) : (
                        <>
                            <Ionicons name="refresh-outline" size={18} color={theme.textInverse} />
                            <Text style={[styles.generateBtnText, { color: theme.textInverse }]}>
                                {hasToken ? "Refresh QR" : "Generate QR"}
                            </Text>
                        </>
                    )}
                </Pressable>
            </View>

            {/* Instructions */}
            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>How It Works</Text>
                {[
                    "Enable 'Require QR Check-In' above.",
                    "Generate a fresh QR code before the quiz starts.",
                    "Display this screen (full-brightness) to participants.",
                    "Each participant scans the QR with their phone.",
                    "After scanning, they will be marked as present and the Start Quiz button will be unlocked.",
                    "Refresh the QR code if you suspect it has been shared outside the venue.",
                ].map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                        <View style={[styles.stepBadge, { backgroundColor: theme.primaryMuted }]}>
                            <Text style={[styles.stepNum, { color: theme.primary }]}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    backText: { fontSize: 14, fontWeight: "600" },
    eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 4 },
    title: { fontSize: 30, fontWeight: "800", marginBottom: 6 },
    subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

    alertBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
    alertText: { flex: 1, fontSize: 13, fontWeight: "600" },

    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
    cardHint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },

    settingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    settingLabel: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
    settingHint: { fontSize: 12, lineHeight: 16 },

    qrWrapper: { alignItems: "center", marginVertical: 12 },
    qrImage: { width: 260, height: 260, borderRadius: 12 },
    expiryBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "center",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        marginBottom: 4,
    },
    expiryText: { fontSize: 12, fontWeight: "700" },

    qrPlaceholder: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderStyle: "dashed",
        borderRadius: 16,
        padding: 32,
        marginVertical: 8,
        gap: 8,
    },
    qrPlaceholderText: { fontSize: 15, fontWeight: "700" },
    qrPlaceholderHint: { fontSize: 12 },

    generateBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 14,
        paddingVertical: 14,
    },
    generateBtnText: { fontSize: 15, fontWeight: "700" },

    stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    stepBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
    },
    stepNum: { fontSize: 12, fontWeight: "800" },
    stepText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

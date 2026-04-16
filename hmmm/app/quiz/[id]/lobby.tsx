import { fetchQuizLobby } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const POLL_INTERVAL_MS = 5_000;

export default function LobbyScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [data, setData] = useState<any>(null);
    const [seconds, setSeconds] = useState(0);
    const [lockedSeconds, setLockedSeconds] = useState(0);
    const [windowSecondsLeft, setWindowSecondsLeft] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rulesExpanded, setRulesExpanded] = useState(true);

    // Attendance check-in state (server-sourced from lobby payload)
    const attendanceRequired: boolean = !!data?.attendanceRequired;
    const isCheckedIn: boolean = !!data?.isCheckedIn;

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadLobby = async () => {
        if (!quizId) return;
        try {
            const payload = await fetchQuizLobby(quizId);
            setData(payload);
            setSeconds(payload.startsInSeconds ?? 0);
            setLockedSeconds(payload.enrollment?.lockedSeconds ?? 0);
            // Compute remaining window from quizEndsAtIso if available
            if (payload.quizEndsAtIso) {
                const remaining = Math.max(0, Math.floor((new Date(payload.quizEndsAtIso).getTime() - Date.now()) / 1000));
                setWindowSecondsLeft(remaining);
            }
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load lobby');
        }
    };

    // Initial load + polling while countdown > 0
    useEffect(() => {
        loadLobby();

        pollRef.current = setInterval(() => {
            // Only re-fetch while there is still a countdown (server may start quiz early)
            setSeconds((prev) => {
                if (prev > 0) {
                    loadLobby();
                }
                return prev;
            });
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId]);

    // Local countdown ticker
    useEffect(() => {
        if (seconds > 0) {
            const timer = setInterval(() => setSeconds((prev) => Math.max(0, prev - 1)), 1000);
            return () => clearInterval(timer);
        }
        return;
    }, [seconds]);

    useEffect(() => {
        if (lockedSeconds <= 0) return;
        const timer = setInterval(() => setLockedSeconds((prev) => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(timer);
    }, [lockedSeconds]);

    useEffect(() => {
        if (windowSecondsLeft === null || windowSecondsLeft <= 0) return;
        const timer = setInterval(() => setWindowSecondsLeft((prev) => (prev !== null ? Math.max(0, prev - 1) : null)), 1000);
        return () => clearInterval(timer);
    }, [windowSecondsLeft]);

    if (!data) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                {error ? (
                    <>
                        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                        <Pressable onPress={loadLobby} style={[styles.retryBtn, { backgroundColor: theme.buttonPrimary }]}>
                            <Text style={[styles.retryText, { color: theme.textInverse }]}>Retry</Text>
                        </Pressable>
                    </>
                ) : (
                    <ActivityIndicator size="large" color={theme.primary} />
                )}
            </View>
        );
    }

    const formatCountdown = (totalSeconds: number) => {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const days = Math.floor(safeSeconds / 86400);
        const hours = Math.floor((safeSeconds % 86400) / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const secs = safeSeconds % 60;

        return { days, hours, minutes, secs };
    };

    const countdownParts = formatCountdown(seconds);
    const lockoutParts = formatCountdown(lockedSeconds);

    const quizEndsAtIso: string | undefined = data?.quizEndsAtIso;
    const windowClosed = quizEndsAtIso ? Date.now() > new Date(quizEndsAtIso).getTime() : false;
    const fmtDeadline = quizEndsAtIso ? new Date(quizEndsAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

    const renderTimeChip = (value: number, label: string, keyName: string) => (
        <View key={keyName} style={[styles.timeChip, { backgroundColor: theme.surfaceLight, borderColor: theme.primary }]}>
            <Text style={[styles.timeValue, { color: theme.primary }]}>{String(value).padStart(2, "0")}</Text>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>{label}</Text>
        </View>
    );

    const renderCountdown = (parts: { days: number; hours: number; minutes: number; secs: number }) => {
        const chips: any[] = [];
        if (parts.days > 0) chips.push(renderTimeChip(parts.days, "DAYS", "days"));
        if (parts.days > 0 || parts.hours > 0) chips.push(renderTimeChip(parts.hours, "HRS", "hours"));
        chips.push(renderTimeChip(parts.minutes, "MIN", "minutes"));
        chips.push(renderTimeChip(parts.secs, "SEC", "seconds"));
        return chips;
    };

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            {/* Leave lobby */}
            <Pressable
                onPress={() => quizId && router.replace({ pathname: "/quiz/[id]", params: { id: quizId } } as any)}
                style={styles.leaveBtn}
            >
                <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
                <Text style={[styles.leaveBtnText, { color: theme.textSecondary }]}>Leave Lobby</Text>
            </Pressable>

            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{data.quizTitle}</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{seconds > 0 ? "Starting Soon" : windowClosed ? "Ended" : "Ready"}</Text>

            {/* Quiz window deadline info */}
            {fmtDeadline && !windowClosed && (
                <View style={[styles.deadlineBanner, { backgroundColor: theme.warningMuted, borderColor: theme.warning }]}>
                    <Ionicons name="time-outline" size={15} color={theme.textPrimary} />
                    <Text style={[styles.deadlineText, { color: theme.textPrimary }]}>
                        Must complete by <Text style={{ fontWeight: "800" }}>{fmtDeadline}</Text>
                        {windowSecondsLeft !== null && windowSecondsLeft < 3600 && (
                            <Text style={{ color: windowSecondsLeft < 300 ? theme.error : theme.textPrimary }}>
                                {" "}({Math.floor(windowSecondsLeft / 60)}m left)
                            </Text>
                        )}
                    </Text>
                </View>
            )}

            {windowClosed && (
                <View style={[styles.deadlineBanner, { backgroundColor: theme.errorMuted, borderColor: theme.error }]}>
                    <Ionicons name="alert-circle-outline" size={15} color={theme.error} />
                    <Text style={[styles.deadlineText, { color: theme.error }]}>
                        The quiz window has closed. Submissions are no longer accepted.
                    </Text>
                </View>
            )}

            <View style={styles.timerRow}>
                {renderCountdown(countdownParts)}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Pressable
                    onPress={() => setRulesExpanded((prev) => !prev)}
                    style={styles.rulesHeader}
                >
                    <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 0 }]}>Quiz Rules</Text>
                    <Ionicons name={rulesExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
                </Pressable>
                {rulesExpanded && (
                    <View style={{ marginTop: 8 }}>
                        {(data.rules ?? []).map((rule: string, idx: number) => (
                            <Text key={`${rule}-${idx}`} style={[styles.rule, { color: theme.textSecondary }]}>{idx + 1}. {rule}</Text>
                        ))}
                    </View>
                )}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Lobby</Text>
                <Text style={[styles.rule, { color: theme.textSecondary }]}>{data?.lobby?.waitingCount} users currently enrolled</Text>
                {(data?.lobby?.sampleUsers ?? []).map((user: { name: string; status: string }, idx: number) => (
                    <View key={`${user.name}-${idx}`} style={[styles.userRow, { borderColor: theme.border }]}>
                        <Ionicons name="ellipse" size={8} color={theme.success} />
                        <Text style={[styles.userName, { color: theme.textPrimary }]}>{user.name}</Text>
                        <Text style={[styles.ready, { color: theme.primary }]}>READY</Text>
                    </View>
                ))}
            </View>

            {data?.enrollment?.isCompleted ? (
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
                    <Text style={[styles.cardTitle, { color: theme.primary }]}>Quiz Completed ✓</Text>
                    <Text style={[styles.rule, { color: theme.textSecondary }]}>
                        You have already completed this quiz.
                    </Text>
                    <Pressable
                        style={({ pressed }) => [
                            styles.startBtn,
                            { backgroundColor: theme.buttonPrimary, marginTop: 8, opacity: pressed ? 0.9 : 1 },
                        ]}
                        onPress={() => quizId && router.push({ pathname: "/quiz/[id]/winners", params: { id: quizId } } as any)}
                    >
                        <Text style={[styles.startText, { color: theme.textInverse }]}>🏆 See Winners</Text>
                    </Pressable>
                </View>
            ) : lockedSeconds > 0 ? (
                <View style={[styles.startBtn, { alignItems: 'center', paddingVertical: 16 }]}>
                    <Text style={[styles.startText, { color: theme.textSecondary }]}>You are temporarily locked out from attempting this quiz.</Text>
                    <View style={[styles.lockoutRow, { marginTop: 10 }]}>{renderCountdown(lockoutParts)}</View>
                </View>
            ) : windowClosed ? (
                <View style={[styles.startBtn, { backgroundColor: theme.buttonDisabled, alignItems: 'center' }]}>
                    <Text style={[styles.startText, { color: theme.textInverse }]}>Quiz Window Closed</Text>
                </View>
            ) : attendanceRequired && !isCheckedIn ? (
                /* ── Attendance gate ── */
                <View style={[styles.card, { backgroundColor: theme.warningMuted, borderColor: theme.warning, marginTop: 16 }]}>
                    <View style={styles.attendanceHeader}>
                        <Ionicons name="qr-code-outline" size={28} color={theme.textPrimary} />
                        <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 0, flex: 1 }]}>
                            Attendance Required
                        </Text>
                    </View>
                    <Text style={[styles.rule, { color: theme.textSecondary, marginTop: 8 }]}>
                        Your admin requires you to verify your on-site presence before you can start the quiz.
                        Please scan the QR code displayed by your admin.
                    </Text>
                    <Text style={[styles.rule, { color: theme.textSecondary, fontSize: 13 }]}>
                        After scanning the QR code this screen will automatically update. You can also refresh the lobby manually.
                    </Text>
                    <Pressable
                        style={({ pressed }) => [
                            styles.startBtn,
                            { backgroundColor: theme.buttonPrimary, marginTop: 12, opacity: pressed ? 0.9 : 1 },
                        ]}
                        onPress={loadLobby}
                    >
                        <Text style={[styles.startText, { color: theme.textInverse }]}>↻ Refresh After Scanning</Text>
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    style={({ pressed }) => [
                        styles.startBtn,
                        {
                            backgroundColor: seconds > 0 ? theme.buttonDisabled : theme.buttonPrimary,
                            opacity: pressed ? 0.95 : 1,
                        },
                    ]}
                    disabled={seconds > 0}
                    onPress={() =>
                        quizId &&
                        router.replace({ pathname: "/quiz/[id]/summary", params: { id: quizId } } as any)
                    }
                >
                    <Text style={[styles.startText, { color: theme.textInverse }]}>{seconds > 0 ? 'Starting Soon' : 'Start Quiz'}</Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    errorText: { fontSize: 15, textAlign: "center", marginBottom: 16 },
    retryBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
    retryText: { fontSize: 15, fontWeight: "700" },
    leaveBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    leaveBtnText: { fontSize: 14, fontWeight: "600" },
    brand: { fontSize: 20, fontWeight: "800" },
    subtitle: { marginTop: 12, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" },
    title: { marginTop: 8, fontSize: 58, lineHeight: 60, fontWeight: "800" },
    timerRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 },
    timeChip: { borderWidth: 2, borderRadius: 18, minWidth: 82, alignItems: "center", paddingVertical: 14, paddingHorizontal: 16 },
    timeValue: { fontSize: 36, fontWeight: "800", lineHeight: 40 },
    timeLabel: { fontSize: 11, fontWeight: "800", marginTop: 2, letterSpacing: 1 },
    lockoutRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
    deadlineBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
    deadlineText: { flex: 1, fontSize: 14, fontWeight: "600" },
    card: { marginTop: 16, borderWidth: 1, borderRadius: 16, padding: 14 },
    cardTitle: { fontSize: 34, fontWeight: "800", marginBottom: 8 },
    rule: { fontSize: 16, lineHeight: 26, marginBottom: 6 },
    rulesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    userRow: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    userName: { flex: 1, fontSize: 15, fontWeight: "600" },
    ready: { fontSize: 12, fontWeight: "700" },
    startBtn: {
        marginTop: 16,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
    },
    startText: { fontSize: 17, fontWeight: "700" },
    attendanceHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
});

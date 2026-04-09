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
    const [error, setError] = useState<string | null>(null);
    const [rulesExpanded, setRulesExpanded] = useState(true);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadLobby = async () => {
        if (!quizId) return;
        try {
            const payload = await fetchQuizLobby(quizId);
            setData(payload);
            setSeconds(payload.startsInSeconds ?? 0);
            setLockedSeconds(payload.enrollment?.lockedSeconds ?? 0);
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
            <Text style={[styles.title, { color: theme.textPrimary }]}>Starting Soon</Text>

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
                        router.replace({ pathname: "/quiz/[id]/question/[index]", params: { id: quizId, index: "1" } } as any)
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
    timerRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 },
    timeChip: { borderWidth: 1, borderRadius: 16, minWidth: 74, alignItems: "center", paddingVertical: 10, paddingHorizontal: 12 },
    timeValue: { fontSize: 30, fontWeight: "800", lineHeight: 34 },
    timeLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },
    lockoutRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
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
});

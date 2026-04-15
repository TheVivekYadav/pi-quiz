import { fetchQuizLobby } from "@/constants/quiz-api";
import { clearQuizAnswers, setExamStartedAt } from "@/constants/quiz-session";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SummaryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!quizId) return;
        const run = async () => {
            try {
                const payload = await fetchQuizLobby(quizId);
                setData(payload);
            } catch (err: any) {
                setError(err?.message || "Failed to load quiz details.");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [quizId]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (error || !data) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{error ?? "Something went wrong."}</Text>
                <Pressable
                    onPress={() => quizId && router.replace({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any)}
                    style={[styles.backBtn, { backgroundColor: theme.buttonPrimary }]}
                >
                    <Text style={[styles.backBtnText, { color: theme.textInverse }]}>Back to Lobby</Text>
                </Pressable>
            </View>
        );
    }

    const totalQuestions: number = data.totalQuestions ?? 0;
    const durationMinutes: number = data.durationMinutes ?? 0;
    const totalSeconds = durationMinutes * 60;
    const timePerQuestion = totalQuestions > 0
        ? Math.min(120, Math.max(10, Math.floor(totalSeconds / totalQuestions)))
        : 0;

    const quizEndsAtIso: string | undefined = data.quizEndsAtIso;
    const windowClosed = quizEndsAtIso ? Date.now() > new Date(quizEndsAtIso).getTime() : false;
    const fmtDeadline = quizEndsAtIso
        ? new Date(quizEndsAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : null;

    const handleBeginQuiz = () => {
        if (!quizId) return;
        clearQuizAnswers(quizId);
        setExamStartedAt(quizId);
        router.replace({ pathname: "/quiz/[id]/question/[index]", params: { id: quizId, index: "1" } } as any);
    };

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        >
            {/* Back to lobby */}
            <Pressable
                onPress={() => quizId && router.replace({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any)}
                style={styles.backLink}
            >
                <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
                <Text style={[styles.backLinkText, { color: theme.textSecondary }]}>Back to Lobby</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>READY TO BEGIN?</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{data.quizTitle ?? "Quiz"}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Review the details below before starting.
            </Text>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="help-circle-outline" size={24} color={theme.primary} />
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>{totalQuestions}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Questions</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="hourglass-outline" size={24} color={theme.accent} />
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>{durationMinutes} min</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Time</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="timer-outline" size={24} color={theme.warning} />
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>{timePerQuestion}s</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Per Question</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="repeat-outline" size={24} color={theme.error} />
                    <Text style={[styles.statValue, { color: theme.textPrimary }]}>{data.enrollment?.maxAttempts ?? 2}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Max Attempts</Text>
                </View>
            </View>

            {/* Deadline warning */}
            {fmtDeadline && !windowClosed && (
                <View style={[styles.deadlineCard, { backgroundColor: theme.warningMuted, borderColor: theme.warning }]}>
                    <Ionicons name="time-outline" size={18} color={theme.textPrimary} />
                    <Text style={[styles.deadlineText, { color: theme.textPrimary }]}>
                        Must complete before <Text style={{ fontWeight: "800" }}>{fmtDeadline}</Text>. The quiz auto-submits when time runs out.
                    </Text>
                </View>
            )}

            {windowClosed && (
                <View style={[styles.deadlineCard, { backgroundColor: theme.errorMuted, borderColor: theme.error }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
                    <Text style={[styles.deadlineText, { color: theme.error }]}>
                        The quiz window has closed. You can no longer attempt this quiz.
                    </Text>
                </View>
            )}

            {/* Quiz rules */}
            {(data.rules ?? []).length > 0 && (
                <View style={[styles.rulesCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.rulesTitle, { color: theme.textPrimary }]}>📋 Rules</Text>
                    {(data.rules ?? []).map((rule: string, idx: number) => (
                        <View key={`rule-${idx}`} style={styles.ruleRow}>
                            <View style={[styles.ruleDot, { backgroundColor: theme.primary }]} />
                            <Text style={[styles.ruleText, { color: theme.textSecondary }]}>{rule}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Begin Quiz button */}
            {!windowClosed && (
                <Pressable
                    style={({ pressed }) => [
                        styles.beginBtn,
                        { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.92 : 1 },
                    ]}
                    onPress={handleBeginQuiz}
                >
                    <Ionicons name="play-circle-outline" size={20} color={theme.textInverse} />
                    <Text style={[styles.beginBtnText, { color: theme.textInverse }]}>Begin Quiz</Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

    errorText: { fontSize: 15, textAlign: "center", marginBottom: 16 },
    backBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
    backBtnText: { fontSize: 15, fontWeight: "700" },

    backLink: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
    backLinkText: { fontSize: 14, fontWeight: "600" },

    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700", marginBottom: 6 },
    title: { fontSize: 32, fontWeight: "800", lineHeight: 36, marginBottom: 6 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20 },

    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    statCard: {
        flex: 1,
        minWidth: "44%",
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        alignItems: "center",
        gap: 6,
    },
    statValue: { fontSize: 22, fontWeight: "800" },
    statLabel: { fontSize: 12, fontWeight: "600" },

    deadlineCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    deadlineText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },

    rulesCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 },
    rulesTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
    ruleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
    ruleDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
    ruleText: { flex: 1, fontSize: 14, lineHeight: 20 },

    beginBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 16,
        paddingVertical: 16,
        marginTop: 4,
    },
    beginBtnText: { fontSize: 17, fontWeight: "800" },
});

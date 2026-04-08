import { adminDeclareWinners, adminFetchQuizReport } from "@/constants/quiz-api";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuizReportScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [declaring, setDeclaring] = useState(false);

    const load = async () => {
        if (!quizId) return;
        setLoading(true);
        try {
            const data = await adminFetchQuizReport(quizId);
            setReport(data);
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to load report.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [quizId]);

    const handleDeclareWinners = () => {
        Alert.alert(
            "Declare Winners",
            "Are you sure you want to officially declare winners for this quiz? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Declare",
                    onPress: async () => {
                        if (!quizId) return;
                        setDeclaring(true);
                        try {
                            await adminDeclareWinners(quizId);
                            Alert.alert("Success", "Winners have been declared!");
                            await load();
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "Failed to declare winners.");
                        } finally {
                            setDeclaring(false);
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const quiz = report?.quiz ?? {};
    const stats = report?.stats ?? {};
    const topScorers: any[] = report?.topScorers ?? [];
    const winnersDeclared = quiz.winnersDeclared;

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Pressable onPress={() => router.back()} style={styles.back}>
                <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN • QUIZ REPORT</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{quiz.title}</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {quiz.category} • {quiz.level} • {quiz.startsAtIso ? new Date(quiz.startsAtIso).toLocaleString() : ""}
            </Text>

            {/* Stats */}
            <View style={styles.statsRow}>
                {[
                    { label: "ENROLLED", value: stats.totalEnrolled },
                    { label: "COMPLETED", value: stats.totalCompleted },
                    { label: "ATTEMPTS", value: stats.totalAttempts },
                    { label: "AVG SCORE", value: stats.avgScore },
                    { label: "MAX SCORE", value: stats.maxScore },
                ].map((s) => (
                    <View key={s.label} style={[styles.statBox, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>{s.label}</Text>
                        <Text style={[styles.statValue, { color: theme.primary }]}>{s.value ?? 0}</Text>
                    </View>
                ))}
            </View>

            {/* Declare winners */}
            {winnersDeclared ? (
                <View style={[styles.winnerBanner, { backgroundColor: `${theme.primary}22`, borderColor: theme.primary }]}>
                    <Text style={[styles.winnerBannerText, { color: theme.primary }]}>
                        🏆 Winners declared on {quiz.winnersDeclaredAt ? new Date(quiz.winnersDeclaredAt).toLocaleString() : ""}
                    </Text>
                    <Pressable
                        onPress={() => router.push({ pathname: "/quiz/[id]/winners", params: { id: quizId } } as any)}
                    >
                        <Text style={[styles.winnerLink, { color: theme.primary }]}>View Winners →</Text>
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    onPress={handleDeclareWinners}
                    disabled={declaring}
                    style={[styles.declareBtn, { backgroundColor: declaring ? theme.buttonDisabled : theme.buttonPrimary }]}
                >
                    <Text style={[styles.declareBtnText, { color: theme.textInverse }]}>
                        {declaring ? "Declaring..." : "🏆 Declare Winners"}
                    </Text>
                </Pressable>
            )}

            {/* Top scorers */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Top Scorers</Text>
            {topScorers.length === 0 ? (
                <Text style={[styles.empty, { color: theme.textMuted }]}>No attempts yet.</Text>
            ) : (
                topScorers.map((scorer: any) => (
                    <View key={scorer.rollNumber} style={[styles.scorerRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.scorerRank, { color: theme.textMuted }]}>#{scorer.rank}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.scorerName, { color: theme.textPrimary }]}>{scorer.user}</Text>
                            <Text style={[styles.scorerRoll, { color: theme.textSecondary }]}>{scorer.rollNumber}</Text>
                        </View>
                        <Text style={[styles.scorerScore, { color: theme.primary }]}>{scorer.score} pts</Text>
                    </View>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    back: { marginBottom: 8 },
    backText: { fontSize: 15, fontWeight: "700" },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, fontSize: 36, lineHeight: 40, fontWeight: "800" },
    meta: { marginTop: 6, fontSize: 14, marginBottom: 12 },
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    statBox: { flex: 1, minWidth: "40%", borderWidth: 1, borderRadius: 14, padding: 10 },
    statLabel: { fontSize: 11, letterSpacing: 1, fontWeight: "700" },
    statValue: { marginTop: 4, fontSize: 24, fontWeight: "800" },
    winnerBanner: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 6 },
    winnerBannerText: { fontSize: 15, fontWeight: "700" },
    winnerLink: { fontSize: 14, fontWeight: "700" },
    declareBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 16 },
    declareBtnText: { fontSize: 17, fontWeight: "700" },
    sectionTitle: { fontSize: 24, fontWeight: "800", marginBottom: 10 },
    empty: { fontSize: 15 },
    scorerRow: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        gap: 10,
    },
    scorerRank: { fontSize: 14, fontWeight: "700", width: 30 },
    scorerName: { fontSize: 15, fontWeight: "700" },
    scorerRoll: { fontSize: 12, marginTop: 2 },
    scorerScore: { fontSize: 15, fontWeight: "800" },
});

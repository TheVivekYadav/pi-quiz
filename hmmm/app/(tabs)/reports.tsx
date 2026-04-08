import { fetchReportsOverview } from "@/constants/quiz-api";
import { isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReportsTab() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const adminView = isAdmin();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            try {
                const payload = await fetchReportsOverview();
                setData(payload);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, []);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    // ─── Admin overview ──────────────────────────────────────────────────────
    if (adminView && data?.admin) {
        const m = data.metrics ?? {};
        const summaries: any[] = data.quizSummaries ?? [];

        return (
            <ScrollView
                style={[styles.root, { backgroundColor: theme.background }]}
                contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
            >
                <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN • PLATFORM OVERVIEW</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Reports</Text>

                <View style={styles.metricRow}>
                    {[
                        { label: "USERS", value: m.totalUsers },
                        { label: "QUIZZES", value: m.totalQuizzes },
                        { label: "ENROLLED", value: m.totalEnrolled },
                        { label: "ATTEMPTS", value: m.totalAttempts },
                    ].map((item) => (
                        <View key={item.label} style={[styles.miniMetric, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                            <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{item.label}</Text>
                            <Text style={[styles.miniValue, { color: theme.primary }]}>{item.value ?? 0}</Text>
                        </View>
                    ))}
                </View>

                <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>AVG ACCURACY</Text>
                    <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{m.avgAccuracy ?? 0}%</Text>
                </View>

                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quiz Breakdown</Text>
                {summaries.length === 0 && (
                    <Text style={[styles.insight, { color: theme.textMuted }]}>No quizzes yet.</Text>
                )}
                {summaries.map((quiz: any) => (
                    <Pressable
                        key={quiz.id}
                        onPress={() => router.push({ pathname: "/quiz/[id]/report", params: { id: quiz.id } } as any)}
                        style={[styles.quizRow, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.quizTitle, { color: theme.textPrimary }]} numberOfLines={1}>{quiz.title}</Text>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]}>
                                {quiz.category} • Enrolled: {quiz.enrolled} • Attempts: {quiz.attempts}
                            </Text>
                            {quiz.winnersDeclared && (
                                <Text style={[styles.quizMeta, { color: theme.primary }]}>🏆 Winners declared</Text>
                            )}
                        </View>
                        <Text style={[styles.quizScore, { color: theme.primary }]}>Top: {quiz.topScore}pts</Text>
                    </Pressable>
                ))}
            </ScrollView>
        );
    }

    // ─── User overview ───────────────────────────────────────────────────────
    const metrics = data?.metrics ?? {};
    const totalEnrolled = Number(metrics.totalEnrolled ?? 0);
    const activeNow = Number(metrics.activeNow ?? 0);
    const completed = Number(metrics.completed ?? 0);
    const upcoming = data?.upcomingQuizzes ?? data?.upcoming ?? [];
    const insights = data?.insights ?? [];

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>EXECUTIVE OVERVIEW</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Platform Pulse</Text>

            <View style={[styles.metricCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>TOTAL ENROLLED</Text>
                <Text style={[styles.metricValue, { color: theme.primary }]}>{totalEnrolled}</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>ACTIVE NOW</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{activeNow}</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.metricLabel, { color: theme.textMuted }]}>COMPLETED</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{completed}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Upcoming Quizzes</Text>
            {upcoming.map((item: any) => (
                <View key={item.id} style={[styles.item, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.itemMeta, { color: theme.textMuted }]}>{item.category}</Text>
                </View>
            ))}
            {!upcoming.length && <Text style={[styles.insight, { color: theme.textMuted }]}>No upcoming quizzes right now.</Text>}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Insights</Text>
            {insights.map((insight: string, idx: number) => (
                <Text key={`${insight}-${idx}`} style={[styles.insight, { color: theme.textSecondary }]}>• {insight}</Text>
            ))}
            {!insights.length && <Text style={[styles.insight, { color: theme.textMuted }]}>Your insights will appear after quiz activity.</Text>}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { fontSize: 42, lineHeight: 46, fontWeight: "800", marginTop: 8, marginBottom: 12 },
    metricCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
    metricLabel: { fontSize: 12, letterSpacing: 1, fontWeight: "700" },
    metricValue: { marginTop: 6, fontSize: 50, lineHeight: 54, fontWeight: "800" },
    metricRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
    miniMetric: { flex: 1, minWidth: "40%", borderWidth: 1, borderRadius: 14, padding: 10 },
    miniLabel: { fontSize: 11, letterSpacing: 1, fontWeight: "700" },
    miniValue: { marginTop: 4, fontSize: 26, fontWeight: "800" },
    sectionTitle: { fontSize: 30, fontWeight: "800", marginTop: 16, marginBottom: 8 },
    item: { borderBottomWidth: 1, paddingVertical: 10 },
    itemTitle: { fontSize: 18, fontWeight: "700" },
    itemMeta: { fontSize: 13, marginTop: 2 },
    insight: { fontSize: 15, lineHeight: 24, marginBottom: 6 },
    quizRow: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    quizTitle: { fontSize: 15, fontWeight: "700" },
    quizMeta: { fontSize: 12, marginTop: 2 },
    quizScore: { fontSize: 14, fontWeight: "700" },
});

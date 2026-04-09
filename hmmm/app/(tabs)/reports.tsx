import { isAdmin } from "@/constants/auth-session";
import { fetchReportsOverview } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useLoadTimeout } from "@/hook/useLoadTimeout";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ReportRange = "today" | "week" | "month" | "all";

const RANGE_OPTIONS: Array<{ key: ReportRange; label: string }> = [
    { key: "today", label: "Today" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "all", label: "All Time" },
];

const formatDelta = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}`;
};

const trendArrow = (value: number) => (value > 0 ? "↑" : value < 0 ? "↓" : "→");

export default function ReportsTab() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const adminView = isAdmin();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timedOut, setTimedOut] = useState(false);
    const [range, setRange] = useState<ReportRange>("week");

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setTimedOut(false);
        try {
            const payload = await fetchReportsOverview(range);
            setData(payload);
        } catch (err: any) {
            setError(err?.message || 'Failed to load reports');
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { load(); }, [load]);
    useLoadTimeout(loading, () => { setTimedOut(true); setLoading(false); });

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (timedOut || error) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={{ color: '#b91c1c', fontSize: 15, textAlign: 'center', marginBottom: 16 }}>
                    {timedOut ? 'Could not connect — tap to retry.' : `⚠ ${error}`}
                </Text>
                <Pressable onPress={load} style={{ backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    if (!adminView) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}> 
                <Text style={{ color: '#b91c1c', fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Access denied</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
                    Reports are available for admins only.
                </Text>
            </View>
        );
    }

    // ─── Admin overview ──────────────────────────────────────────────────────
    if (adminView && data?.admin) {
        const m = data.metrics ?? {};
        const summaries: any[] = data.quizSummaries ?? [];
        const insights: string[] = data.insights ?? [];
        const trends = m.trends ?? {};
        const dist = data.accuracyDistribution ?? {};
        const totalDist = Number(dist.under40 ?? 0) + Number(dist.between40to60 ?? 0) + Number(dist.between60to80 ?? 0) + Number(dist.above80 ?? 0);

        let dominantBand = "No attempts yet";
        if (totalDist > 0) {
            const bands = [
                { label: "below 40%", value: Number(dist.under40 ?? 0) },
                { label: "40–60%", value: Number(dist.between40to60 ?? 0) },
                { label: "60–80%", value: Number(dist.between60to80 ?? 0) },
                { label: "80%+", value: Number(dist.above80 ?? 0) },
            ].sort((a, b) => b.value - a.value);
            dominantBand = `Most users score ${bands[0].label}`;
        }

        return (
            <ScrollView
                style={[styles.root, { backgroundColor: theme.background }]}
                contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
            >
                <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN • PLATFORM OVERVIEW</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Reports</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {RANGE_OPTIONS.map((item) => {
                        const active = range === item.key;
                        return (
                            <Pressable
                                key={item.key}
                                onPress={() => setRange(item.key)}
                                style={[
                                    styles.filterChip,
                                    {
                                        backgroundColor: active ? theme.primary : theme.surfaceLight,
                                        borderColor: active ? theme.primary : theme.border,
                                    },
                                ]}
                            >
                                <Text style={{ color: active ? "#fff" : theme.textSecondary, fontWeight: "700", fontSize: 12 }}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                <View style={styles.metricRow}>
                    <View style={[styles.priorityCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.priorityLabel, { color: theme.textMuted }]}>📊 ATTEMPTS</Text>
                        <Text style={[styles.priorityValue, { color: theme.textPrimary }]}>{m.totalAttempts ?? 0}</Text>
                        <Text style={[styles.metricHint, { color: theme.textSecondary }]}>
                            {Number(m.attemptsPerUser ?? 0).toFixed(1)}/user • {trendArrow(Number(trends.totalAttempts ?? 0))} {formatDelta(Number(trends.totalAttempts ?? 0))}
                        </Text>
                    </View>

                    <View style={[styles.priorityCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.priorityLabel, { color: theme.textMuted }]}>🎯 AVG ACCURACY</Text>
                        <Text style={[styles.priorityValue, { color: theme.primary }]}>{m.avgAccuracy ?? 0}%</Text>
                        <Text style={[styles.metricHint, { color: theme.textSecondary }]}>
                            {dominantBand} • {trendArrow(Number(trends.avgAccuracy ?? 0))} {formatDelta(Number(trends.avgAccuracy ?? 0))}%
                        </Text>
                    </View>
                </View>

                <View style={styles.metricRow}>
                    <View style={[styles.miniMetric, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.miniLabel, { color: theme.textMuted }]}>👥 USERS</Text>
                        <Text style={[styles.miniValue, { color: theme.primary }]}>{m.totalUsers ?? 0}</Text>
                        <Text style={[styles.miniHint, { color: theme.textSecondary }]}>{formatDelta(Number(trends.totalUsers ?? 0))} this period</Text>
                    </View>
                    <View style={[styles.miniMetric, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.miniLabel, { color: theme.textMuted }]}>📝 ENROLLED</Text>
                        <Text style={[styles.miniValue, { color: theme.primary }]}>{m.totalEnrolled ?? 0}</Text>
                        <Text style={[styles.miniHint, { color: theme.textSecondary }]}>
                            {Number(m.enrollmentsPerUser ?? 0).toFixed(1)}/user • {formatDelta(Number(trends.totalEnrolled ?? 0))}
                        </Text>
                    </View>
                    <View style={[styles.miniMetric, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.miniLabel, { color: theme.textMuted }]}>🧩 QUIZZES</Text>
                        <Text style={[styles.miniValue, { color: theme.primary }]}>{m.totalQuizzes ?? 0}</Text>
                        <Text style={[styles.miniHint, { color: theme.textSecondary }]}>Total published</Text>
                    </View>
                </View>

                <View style={[styles.insightCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.insightTitle, { color: theme.textPrimary }]}>🔥 Quick Insights</Text>
                    {insights.length ? insights.map((line, idx) => (
                        <Text key={`${line}-${idx}`} style={[styles.insight, { color: theme.textSecondary }]}>• {line}</Text>
                    )) : (
                        <Text style={[styles.insight, { color: theme.textMuted }]}>Insights will appear once activity starts.</Text>
                    )}
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
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]}>{quiz.category}</Text>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]}>👥 {quiz.enrolled} enrolled   ✍ {quiz.attempts} attempts</Text>
                            <Text style={[styles.quizMeta, { color: theme.primary }]}>🏆 Top Score: {quiz.topScore} pts</Text>
                            {quiz.winnersDeclared && (
                                <Text style={[styles.quizMeta, { color: theme.primary }]}>🏆 Winners declared</Text>
                            )}
                            {Number(quiz.attempts ?? 0) === 0 && (
                                <Text style={[styles.quizMeta, { color: '#b45309' }]}>⚠️ No attempts yet</Text>
                            )}
                        </View>
                        <Text style={[styles.quizScore, { color: theme.primary }]}>→</Text>
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
    filterRow: { gap: 8, marginBottom: 10 },
    filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    priorityCard: { flex: 1, minWidth: "48%", borderWidth: 1, borderRadius: 18, padding: 14 },
    priorityLabel: { fontSize: 12, letterSpacing: 1, fontWeight: "700" },
    priorityValue: { marginTop: 6, fontSize: 34, lineHeight: 38, fontWeight: "800" },
    metricHint: { marginTop: 4, fontSize: 12, fontWeight: "600" },
    miniMetric: { flex: 1, minWidth: "40%", borderWidth: 1, borderRadius: 14, padding: 10 },
    miniLabel: { fontSize: 11, letterSpacing: 1, fontWeight: "700" },
    miniValue: { marginTop: 4, fontSize: 26, fontWeight: "800" },
    miniHint: { marginTop: 4, fontSize: 12 },
    insightCard: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8 },
    insightTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
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

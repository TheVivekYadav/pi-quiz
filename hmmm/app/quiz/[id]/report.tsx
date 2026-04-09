import { adminDeclareWinners, adminFetchQuizReport } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
    const [confirmDeclare, setConfirmDeclare] = useState(false);

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
        if (Platform.OS === 'web') {
            setConfirmDeclare(true);
        } else {
            Alert.alert(
                "Declare Winners",
                "Are you sure you want to officially declare winners for this quiz? This cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Declare", onPress: doDeclareWinners },
                ]
            );
        }
    };

    const doDeclareWinners = async () => {
        if (!quizId) return;
        setConfirmDeclare(false);
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

    const totalEnrolled = Number(stats.totalEnrolled ?? 0);
    const totalCompleted = Number(stats.totalCompleted ?? 0);
    const totalAttempts = Number(stats.totalAttempts ?? 0);
    const avgScore = Number(stats.avgScore ?? 0);
    const maxScore = Number(stats.maxScore ?? 0);
    const completionRate = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;
    const attemptsPerUser = totalEnrolled > 0 ? (totalAttempts / totalEnrolled).toFixed(2) : "0.00";
    const avgScorePercent = maxScore > 0 ? Math.round((avgScore / maxScore) * 100) : 0;
    const topScorer = topScorers[0];
    const medalByRank: Record<number, { emoji: string; color: string }> = {
        1: { emoji: "🥇", color: theme.warning },
        2: { emoji: "🥈", color: theme.textSecondary },
        3: { emoji: "🥉", color: "#c68b4a" },
    };

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

            <View style={[styles.quickSummary, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <View style={styles.quickSummaryItem}>
                    <Text style={[styles.quickSummaryValue, { color: theme.primary }]}>{totalEnrolled}</Text>
                    <Text style={[styles.quickSummaryLabel, { color: theme.textSecondary }]}>Enrolled</Text>
                </View>
                <View style={styles.quickSummaryDivider} />
                <View style={styles.quickSummaryItem}>
                    <Text style={[styles.quickSummaryValue, { color: theme.success }]}>{completionRate}%</Text>
                    <Text style={[styles.quickSummaryLabel, { color: theme.textSecondary }]}>Completed</Text>
                </View>
            </View>

            <View style={[styles.quickMetaRow, { borderColor: theme.border }]}>
                <View style={[styles.quickMetaPill, { backgroundColor: `${theme.primary}12`, borderColor: theme.border }]}>
                    <Text style={[styles.quickMetaValue, { color: theme.primary }]}>{quiz.level}</Text>
                    <Text style={[styles.quickMetaLabel, { color: theme.textSecondary }]}>Difficulty</Text>
                </View>
                <View style={[styles.quickMetaPill, { backgroundColor: `${theme.success}12`, borderColor: theme.border }]}>
                    <Text style={[styles.quickMetaValue, { color: theme.success }]}>{attemptsPerUser}</Text>
                    <Text style={[styles.quickMetaLabel, { color: theme.textSecondary }]}>Attempts / user</Text>
                </View>
                <View style={[styles.quickMetaPill, { backgroundColor: `${theme.warning}12`, borderColor: theme.border }]}>
                    <Text style={[styles.quickMetaValue, { color: theme.warning }]}>{avgScorePercent}%</Text>
                    <Text style={[styles.quickMetaLabel, { color: theme.textSecondary }]}>Avg of max</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsStack}>
                <View style={[styles.heroStatCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.heroStatLabel, { color: theme.textSecondary }]}>Completion rate</Text>
                    <Text style={[styles.heroStatValue, { color: theme.primary }]}>{completionRate}%</Text>
                    <Text style={[styles.heroStatSub, { color: theme.textSecondary }]}>
                        {totalCompleted} / {totalEnrolled} completed
                    </Text>
                </View>

                <View style={styles.miniStatsRow}>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg score</Text>
                        <Text style={[styles.statValue, { color: theme.primary }]}>
                            {avgScore} / {maxScore || 0}
                        </Text>
                        <Text style={[styles.statHint, { color: theme.textSecondary }]}>
                            {avgScorePercent}% of max
                        </Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>Attempts</Text>
                        <Text style={[styles.statValue, { color: theme.primary }]}>{totalAttempts}</Text>
                        <Text style={[styles.statHint, { color: theme.textSecondary }]}>
                            {attemptsPerUser} per user
                        </Text>
                    </View>
                </View>

                <View style={styles.miniStatsRow}>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>Enrolled</Text>
                        <Text style={[styles.statValue, { color: theme.primary }]}>{totalEnrolled}</Text>
                        <Text style={[styles.statHint, { color: theme.textSecondary }]}>Registered users</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <Text style={[styles.statLabel, { color: theme.textMuted }]}>Max score</Text>
                        <Text style={[styles.statValue, { color: theme.primary }]}>{maxScore}</Text>
                        <Text style={[styles.statHint, { color: theme.textSecondary }]}>Best attempt</Text>
                    </View>
                </View>
            </View>

            {totalCompleted === 0 && (
                <View style={[styles.noticeCard, { backgroundColor: `${theme.warning}16`, borderColor: theme.warning }]}>
                    <Text style={[styles.noticeTitle, { color: theme.warning }]}>⚠ No one has completed this quiz yet</Text>
                    <Text style={[styles.noticeText, { color: theme.textSecondary }]}>Use the report and response tools to track participation once the quiz is live.</Text>
                </View>
            )}

            {/* Declare winners */}
            {winnersDeclared ? (
                <View style={[styles.winnerBanner, { backgroundColor: `${theme.warning}16`, borderColor: theme.warning }]}>
                    <Text style={[styles.winnerBadge, { color: theme.warning }]}>🏆 Winners declared</Text>
                    <Text style={[styles.winnerBannerText, { color: theme.textPrimary }]}>
                        {quiz.winnersDeclaredAt ? new Date(quiz.winnersDeclaredAt).toLocaleString() : "Declared"}
                    </Text>
                    <Pressable
                        onPress={() => router.push({ pathname: "/quiz/[id]/winners", params: { id: quizId } } as any)}
                        style={[styles.winnerAction, { backgroundColor: theme.warning }]}
                    >
                        <Text style={[styles.winnerActionText, { color: "#2d2500" }]}>View Winners</Text>
                    </Pressable>
                </View>
            ) : confirmDeclare ? (
                <View style={[styles.confirmBox, { backgroundColor: `${theme.warning}22`, borderColor: theme.warning }]}>
                    <Text style={[styles.confirmText, { color: theme.textPrimary }]}>
                        Officially declare winners for this quiz? This cannot be undone.
                    </Text>
                    <View style={styles.confirmBtns}>
                        <Pressable
                            onPress={doDeclareWinners}
                            disabled={declaring}
                            style={[styles.confirmYes, { backgroundColor: theme.warning }]}
                        >
                            <Text style={[styles.confirmYesText, { color: "#2d2500" }]}>
                                {declaring ? "Declaring..." : "Declare"}
                            </Text>
                        </Pressable>
                        <Pressable onPress={() => setConfirmDeclare(false)} style={styles.confirmNo}>
                            <Text style={[styles.confirmNoText, { color: theme.textSecondary }]}>Cancel</Text>
                        </Pressable>
                    </View>
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

            {/* View responses button */}
            <Pressable
                onPress={() => router.push({ pathname: "/quiz/[id]/admin-responses", params: { id: quizId } } as any)}
                style={({ pressed }) => [styles.responsesBtn, { borderColor: theme.border, backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
            >
                <Text style={[styles.responsesBtnText, { color: theme.textInverse }]}>📋 View User Responses</Text>
            </Pressable>

            <View style={[styles.insightCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Insight</Text>
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                    {topScorers.length > 0
                        ? `Current leader: ${topScorer.user} with ${topScorer.score} pts.`
                        : "No score distribution yet — waiting for the first attempts."}
                </Text>
            </View>

            {/* Top scorers */}
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Top Scorers</Text>
            {topScorers.length === 0 ? (
                <View style={[styles.emptyStateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.empty, { color: theme.textMuted }]}>No attempts yet.</Text>
                </View>
            ) : (
                topScorers.map((scorer: any) => (
                    <View key={scorer.rollNumber} style={[styles.scorerRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <View style={[styles.rankBadge, { backgroundColor: medalByRank[scorer.rank]?.color ? `${medalByRank[scorer.rank].color}18` : `${theme.primary}12` }]}>
                            <Text style={styles.rankEmoji}>{medalByRank[scorer.rank]?.emoji ?? `#${scorer.rank}`}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.scorerName, { color: theme.textPrimary }]}>{scorer.user}</Text>
                            <Text style={[styles.scorerRoll, { color: theme.textSecondary }]} numberOfLines={1}>{scorer.rollNumber}</Text>
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
    quickSummary: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
    quickSummaryItem: { flex: 1, alignItems: "center" },
    quickSummaryValue: { fontSize: 26, fontWeight: "800" },
    quickSummaryLabel: { marginTop: 4, fontSize: 12, fontWeight: "600" },
    quickSummaryDivider: { width: 1, height: 34, marginHorizontal: 10, opacity: 0.35 },
    quickMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
    quickMetaPill: { flexGrow: 1, minWidth: "30%", borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12 },
    quickMetaValue: { fontSize: 16, fontWeight: "800" },
    quickMetaLabel: { marginTop: 3, fontSize: 11, fontWeight: "700" },
    statsStack: { gap: 10, marginBottom: 16 },
    heroStatCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
    heroStatLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
    heroStatValue: { marginTop: 8, fontSize: 38, lineHeight: 42, fontWeight: "900" },
    heroStatSub: { marginTop: 6, fontSize: 13, fontWeight: "600" },
    miniStatsRow: { flexDirection: "row", gap: 8 },
    statBox: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12 },
    statLabel: { fontSize: 11, letterSpacing: 1, fontWeight: "700" },
    statValue: { marginTop: 4, fontSize: 24, fontWeight: "800" },
    statHint: { marginTop: 4, fontSize: 12, fontWeight: "600" },
    noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 4 },
    noticeTitle: { fontSize: 14, fontWeight: "800" },
    noticeText: { fontSize: 13, lineHeight: 19 },
    winnerBanner: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 6 },
    winnerBadge: { fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    winnerBannerText: { fontSize: 15, fontWeight: "700" },
    winnerAction: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
    winnerActionText: { fontSize: 14, fontWeight: "800" },
    declareBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 16 },
    declareBtnText: { fontSize: 17, fontWeight: "700" },
    confirmBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16, gap: 12 },
    confirmText: { fontSize: 15, lineHeight: 22 },
    confirmBtns: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    confirmYes: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    confirmYesText: { fontSize: 14, fontWeight: "700" },
    confirmNo: { justifyContent: "center" },
    confirmNoText: { fontSize: 14, fontWeight: "600" },
    responsesBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 16 },
    responsesBtnText: { fontSize: 15, fontWeight: "700" },
    sectionTitle: { fontSize: 24, fontWeight: "800", marginBottom: 10 },
    empty: { fontSize: 15 },
    emptyStateCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
    scorerRow: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        gap: 10,
    },
    rankBadge: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    rankEmoji: { fontSize: 18, fontWeight: "800" },
    scorerName: { fontSize: 15, fontWeight: "700" },
    scorerRoll: { fontSize: 12, marginTop: 2 },
    scorerScore: { fontSize: 15, fontWeight: "800" },
    insightCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
    insightText: { fontSize: 13, lineHeight: 19 },
});

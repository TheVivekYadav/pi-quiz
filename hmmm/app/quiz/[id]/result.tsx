import { fetchQuizLeaderboard, fetchQuizWinners } from "@/constants/quiz-api";
import { getQuizResult } from "@/constants/quiz-session";
import { formatOrdinalRank } from "@/constants/rank-format";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function getFeedback(accuracyRate: number): { emoji: string; message: string } {
    if (accuracyRate >= 80) return { emoji: "🚀", message: "Outstanding! Keep it up!" };
    if (accuracyRate >= 60) return { emoji: "🙂", message: "Good attempt! Room to improve." };
    if (accuracyRate >= 40) return { emoji: "📚", message: "Keep practising — you'll get there!" };
    return { emoji: "😢", message: "Needs improvement. Try again!" };
}

export default function ResultScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [resultDeclared, setResultDeclared] = useState<boolean | null>(null);
    const [declarationError, setDeclarationError] = useState(false);
    const result = quizId ? getQuizResult(quizId) : null;

    useEffect(() => {
        if (!quizId) return;
        const run = async () => {
            const [lb, winnersResult] = await Promise.allSettled([
                fetchQuizLeaderboard(quizId),
                fetchQuizWinners(quizId),
            ]);
            if (lb.status === "fulfilled") setLeaderboard(lb.value);
            if (winnersResult.status === "fulfilled") {
                setResultDeclared(!!(winnersResult.value as any).declared);
            } else {
                setDeclarationError(true);
                setResultDeclared(false);
            }
        };
        run();
    }, [quizId]);

    // Redirect to lobby if there is no local quiz session (e.g. direct URL access)
    if (!result) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: "center", marginBottom: 16 }}>
                    Result not available. It may have been cleared.
                </Text>
                <Pressable
                    style={[styles.ctaPrimary, { backgroundColor: theme.buttonPrimary }]}
                    onPress={() => router.replace("/" as any)}
                >
                    <Text style={[styles.ctaText, { color: theme.textInverse }]}>Back to Dashboard</Text>
                </Pressable>
            </View>
        );
    }

    // Show spinner while we check whether results have been declared
    if (resultDeclared === null) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    // Results not yet officially declared by the organiser (or declaration status could not be fetched)
    if (!resultDeclared) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>{declarationError ? "⚠️" : "⏳"}</Text>
                <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
                    {declarationError ? "Could Not Load Status" : "Results Pending"}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: "center", marginBottom: 24 }}>
                    {declarationError
                        ? "We couldn't check whether results have been declared. Please check your connection and try again."
                        : "The quiz organiser has not yet declared the results. Please check back soon."}
                </Text>
                <Pressable
                    style={[styles.ctaPrimary, { backgroundColor: theme.buttonPrimary }]}
                    onPress={() => router.replace("/" as any)}
                >
                    <Ionicons name="home-outline" size={18} color={theme.textInverse} />
                    <Text style={[styles.ctaText, { color: theme.textInverse }]}>Back to Dashboard</Text>
                </Pressable>
            </View>
        );
    }

    const feedback = getFeedback(result.accuracyRate);

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            {/* Header */}
            <Text style={[styles.eyebrow, { color: theme.primary }]}>QUIZ COMPLETED</Text>

            {/* Score hero card */}
            <View style={[styles.heroCard, { backgroundColor: theme.buttonPrimary }]}>
                <Text style={styles.heroEmoji}>{feedback.emoji}</Text>
                <Text style={[styles.heroScore, { color: theme.textInverse }]}>
                    {result.score} / {result.total}
                </Text>
                <Text style={[styles.heroAccuracy, { color: theme.textInverse }]}>{result.accuracyRate}% Accuracy</Text>
                <View style={[styles.feedbackPill, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={[styles.feedbackText, { color: theme.textInverse }]}>{feedback.message}</Text>
                </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: theme.successMuted, borderColor: theme.border }]}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                    <Text style={[styles.statValue, { color: theme.success }]}>{result.breakdown.correct}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Correct</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.errorMuted, borderColor: theme.border }]}>
                    <Ionicons name="close-circle" size={20} color={theme.error} />
                    <Text style={[styles.statValue, { color: theme.error }]}>{result.breakdown.incorrect}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Wrong</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.primaryMuted, borderColor: theme.border }]}>
                    <Ionicons name="time-outline" size={20} color={theme.primary} />
                    <Text style={[styles.statValue, { color: theme.primary }]}>{result.breakdown.timeTakenMinutes}m</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Time</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.accentMuted, borderColor: theme.border }]}>
                    <Ionicons name="trophy-outline" size={20} color={theme.accent} />
                    <Text style={[styles.statValue, { color: theme.accent }]}>Top {100 - result.percentile}%</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Rank</Text>
                </View>
            </View>

            {/* Badge */}
            {!!result.badge && (
                <View style={[styles.badgeCard, { backgroundColor: theme.warningMuted, borderColor: theme.warning }]}>
                    <Text style={styles.badgeIcon}>🎖️</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.badgeTitle, { color: theme.textPrimary }]}>New Badge Earned!</Text>
                        <Text style={[styles.badgeName, { color: theme.textPrimary }]}>{result.badge}</Text>
                        <Text style={[styles.badgeSubtitle, { color: theme.textSecondary }]}>
                            Awarded for participating in this quiz
                        </Text>
                    </View>
                </View>
            )}

            {/* Activity Overview — time efficiency card */}
            <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>⏱ Activity Overview</Text>
                <View style={styles.activityRow}>
                    <View style={[styles.activityChip, { backgroundColor: theme.primaryMuted }]}>
                        <Text style={[styles.activityChipValue, { color: theme.primary }]}>{result.breakdown.timeTakenMinutes}m</Text>
                        <Text style={[styles.activityChipLabel, { color: theme.textSecondary }]}>Time Taken</Text>
                    </View>
                    <View style={[styles.activityChip, { backgroundColor: result.breakdown.correct > result.breakdown.incorrect ? theme.successMuted : theme.errorMuted }]}>
                        <Text style={[styles.activityChipValue, { color: result.breakdown.correct > result.breakdown.incorrect ? theme.success : theme.error }]}>
                            {result.breakdown.correct}/{result.breakdown.correct + result.breakdown.incorrect}
                        </Text>
                        <Text style={[styles.activityChipLabel, { color: theme.textSecondary }]}>Correct</Text>
                    </View>
                    <View style={[styles.activityChip, { backgroundColor: theme.accentMuted }]}>
                        <Text style={[styles.activityChipValue, { color: theme.accent }]}>{result.accuracyRate}%</Text>
                        <Text style={[styles.activityChipLabel, { color: theme.textSecondary }]}>Accuracy</Text>
                    </View>
                </View>
                {result.breakdown.correct + result.breakdown.incorrect > 0 && (
                    <View style={{ marginTop: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                            <Text style={[styles.activityChipLabel, { color: theme.textSecondary }]}>Correct vs Wrong</Text>
                            <Text style={[styles.activityChipLabel, { color: theme.textSecondary }]}>{result.breakdown.correct} / {result.breakdown.incorrect}</Text>
                        </View>
                        <View style={[styles.activityBar, { backgroundColor: theme.divider }]}>
                            <View style={[styles.activityBarFill, {
                                backgroundColor: theme.success,
                                width: (`${(result.breakdown.correct / (result.breakdown.correct + result.breakdown.incorrect)) * 100}%` as `${number}%`),
                            }]} />
                        </View>
                    </View>
                )}
            </View>

            {/* Leaderboard */}
            <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>🏆 Leaderboard</Text>
                {leaderboard.length === 0 && (
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>Loading results…</Text>
                )}
                {leaderboard.map((row) => {
                    const medal = RANK_MEDALS[row.rank];
                    const initials = (row.user as string)
                        .split(" ")
                        .map((w: string) => w[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();
                    return (
                        <View
                            key={`${row.rank}-${row.user}`}
                            style={[
                                styles.lbRow,
                                {
                                    borderColor: row.currentUser ? theme.primary : theme.border,
                                    backgroundColor: row.currentUser ? theme.primaryMuted : theme.surfaceLight,
                                    borderWidth: row.currentUser ? 2 : 1,
                                },
                            ]}
                        >
                            {medal ? (
                                <Text style={styles.lbMedal}>{medal}</Text>
                            ) : (
                                <Text style={[styles.lbRankText, { color: theme.textSecondary }]}>
                                    {formatOrdinalRank(row.rank)}
                                </Text>
                            )}
                            <View style={[styles.avatar, { backgroundColor: row.currentUser ? theme.primary : theme.primaryMuted }]}>
                                <Text style={[styles.avatarText, { color: row.currentUser ? theme.textInverse : theme.primary }]}>
                                    {initials}
                                </Text>
                            </View>
                            <Text style={[styles.lbUser, { color: theme.textPrimary }]}>
                                {row.user}
                                {row.currentUser ? " (You)" : ""}
                            </Text>
                            <Text style={[styles.lbScore, { color: theme.primary }]}>
                                {row.score}/{result.total}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Action buttons */}
            <Pressable
                style={[styles.ctaSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => quizId && router.push({ pathname: "/quiz/[id]/my-responses", params: { id: quizId } } as any)}
            >
                <Ionicons name="list-outline" size={18} color={theme.primary} />
                <Text style={[styles.ctaText, { color: theme.primary }]}>View My Answers</Text>
            </Pressable>

            <Pressable
                style={[styles.ctaSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => quizId && router.push({ pathname: "/quiz/[id]/winners", params: { id: quizId } } as any)}
            >
                <Ionicons name="trophy-outline" size={18} color={theme.accent} />
                <Text style={[styles.ctaText, { color: theme.accent }]}>See Winners</Text>
            </Pressable>

            <Pressable
                style={[styles.ctaPrimary, { backgroundColor: theme.buttonPrimary }]}
                onPress={() => router.replace("/" as any)}
            >
                <Ionicons name="home-outline" size={18} color={theme.textInverse} />
                <Text style={[styles.ctaText, { color: theme.textInverse }]}>Back to Dashboard</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700", marginBottom: 8 },

    heroCard: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 12 },
    heroEmoji: { fontSize: 48, marginBottom: 4 },
    heroScore: { fontSize: 52, fontWeight: "800", lineHeight: 56 },
    heroAccuracy: { fontSize: 16, fontWeight: "600", marginTop: 4, opacity: 0.9 },
    feedbackPill: { marginTop: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
    feedbackText: { fontSize: 14, fontWeight: "600" },

    statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    statBox: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 10, alignItems: "center", gap: 4 },
    statValue: { fontSize: 18, fontWeight: "800" },
    statLabel: { fontSize: 10, fontWeight: "600" },

    badgeCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 14, gap: 12, marginBottom: 12 },
    badgeIcon: { fontSize: 36 },
    badgeTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
    badgeName: { fontSize: 18, fontWeight: "800", marginTop: 2 },
    badgeSubtitle: { fontSize: 12, marginTop: 2 },

    panel: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
    panelTitle: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
    emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 12 },

    activityRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
    activityChip: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 3 },
    activityChipValue: { fontSize: 18, fontWeight: "800" },
    activityChipLabel: { fontSize: 11, fontWeight: "600" },
    activityBar: { height: 8, borderRadius: 4, overflow: "hidden" },
    activityBarFill: { height: 8, borderRadius: 4 },

    lbRow: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
    lbMedal: { fontSize: 20, width: 28, textAlign: "center" },
    lbRankText: { fontSize: 13, fontWeight: "700", width: 28, textAlign: "center" },
    avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 12, fontWeight: "800" },
    lbUser: { flex: 1, fontSize: 14, fontWeight: "600" },
    lbScore: { fontSize: 14, fontWeight: "700" },

    ctaPrimary: { marginBottom: 10, borderRadius: 14, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
    ctaSecondary: { marginBottom: 10, borderRadius: 14, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, borderWidth: 1 },
    ctaText: { fontSize: 16, fontWeight: "700" },
});

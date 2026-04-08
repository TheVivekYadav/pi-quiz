import { fetchQuizLeaderboard } from "@/constants/quiz-api";
import { getQuizResult } from "@/constants/quiz-session";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ResultScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const result = quizId ? getQuizResult(quizId) : null;

    useEffect(() => {
        if (!quizId) return;

        const run = async () => {
            const lb = await fetchQuizLeaderboard(quizId);
            setLeaderboard(lb);
        };

        run();
    }, [quizId]);

    if (!result) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>QUIZ COMPLETED</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>You scored {result.score}/{result.total}!</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Accuracy rate: {result.accuracyRate}% • Top {100 - result.percentile}% today</Text>

            <View style={[styles.accuracyCard, { backgroundColor: theme.buttonPrimary }]}>
                <Text style={[styles.accuracyValue, { color: theme.textInverse }]}>{result.accuracyRate}%</Text>
                <Text style={[styles.accuracyLabel, { color: theme.textInverse }]}>ACCURACY RATE</Text>
            </View>

            <View style={[styles.panel, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>Performance Breakdown</Text>
                <Text style={[styles.stat, { color: theme.textSecondary }]}>Correct: {result.breakdown.correct}</Text>
                <Text style={[styles.stat, { color: theme.textSecondary }]}>Incorrect: {result.breakdown.incorrect}</Text>
                <Text style={[styles.stat, { color: theme.textSecondary }]}>Time Taken: {result.breakdown.timeTakenMinutes}m</Text>
            </View>

            <View style={[styles.badge, { backgroundColor: theme.warning }]}>
                <Text style={[styles.badgeText, { color: "#2d2500" }]}>New Badge! {result.badge}</Text>
            </View>

            <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>Leaderboard</Text>
                {leaderboard.map((row) => (
                    <View key={`${row.rank}-${row.user}`} style={[styles.row, { borderColor: theme.border, backgroundColor: row.currentUser ? theme.primaryMuted : theme.surfaceLight }]}>
                        <Text style={[styles.rank, { color: theme.textSecondary }]}>{String(row.rank).padStart(2, "0")}</Text>
                        <Text style={[styles.user, { color: theme.textPrimary }]}>{row.user}{row.currentUser ? " (You)" : ""}</Text>
                        <Text style={[styles.score, { color: theme.primary }]}>{row.score}/{result.total}</Text>
                    </View>
                ))}
            </View>

            <Pressable
                style={[styles.cta, { backgroundColor: theme.buttonPrimary }]}
                onPress={() => router.replace("/(tabs)/index" as any)}
            >
                <Text style={[styles.ctaText, { color: theme.textInverse }]}>Back to Dashboard</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, fontSize: 52, lineHeight: 54, fontWeight: "800" },
    subtitle: { marginTop: 8, fontSize: 16, lineHeight: 24 },
    accuracyCard: { marginTop: 14, borderRadius: 18, padding: 16, alignItems: "center" },
    accuracyValue: { fontSize: 62, fontWeight: "800", lineHeight: 66 },
    accuracyLabel: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    panel: { marginTop: 14, borderWidth: 1, borderRadius: 18, padding: 14 },
    panelTitle: { fontSize: 35, fontWeight: "800", marginBottom: 8 },
    stat: { fontSize: 15, lineHeight: 24 },
    badge: { marginTop: 14, borderRadius: 16, padding: 16 },
    badgeText: { fontSize: 24, fontWeight: "800" },
    row: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 12,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    rank: { fontSize: 14, fontWeight: "700", width: 26 },
    user: { flex: 1, fontSize: 15, fontWeight: "600" },
    score: { fontSize: 15, fontWeight: "700" },
    cta: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    ctaText: { fontSize: 17, fontWeight: "700" },
});

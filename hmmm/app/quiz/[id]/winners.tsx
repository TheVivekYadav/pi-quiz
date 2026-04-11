import { fetchQuizWinners } from "@/constants/quiz-api";
import { formatOrdinalRank } from "@/constants/rank-format";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function WinnersScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!quizId) return;
        fetchQuizWinners(quizId)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [quizId]);

    if (loading) {
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
            <Pressable onPress={() => router.back()} style={styles.back}>
                <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>HALL OF FAME</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Winners</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{data?.quizTitle ?? ""}</Text>

            {!data?.declared ? (
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.noWinners, { color: theme.textMuted }]}>
                        Winners have not been declared yet. Check back after the quiz ends!
                    </Text>
                </View>
            ) : (
                <>
                    {data?.declaredAt && (
                        <Text style={[styles.declaredAt, { color: theme.textMuted }]}>
                            Declared on {new Date(data.declaredAt).toLocaleString()}
                        </Text>
                    )}

                    {/* Podium */}
                    <View style={styles.podium}>
                        {(data?.winners ?? []).map((winner: any, idx: number) => (
                            <View
                                key={winner.rollNumber}
                                style={[
                                    styles.podiumSlot,
                                    {
                                        backgroundColor: theme.surfaceLight,
                                        borderColor: idx === 0 ? "#f0b429" : idx === 1 ? "#c0c0c0" : "#cd7f32",
                                        borderWidth: 2,
                                        height: idx === 0 ? 180 : idx === 1 ? 150 : 130,
                                    },
                                ]}
                            >
                                <Text style={styles.medal}>{MEDAL[idx] ?? "🏅"}</Text>
                                <Text style={[styles.podiumRank, { color: theme.textMuted }]}>
                                    {formatOrdinalRank(winner.rank)}
                                </Text>
                                <Text style={[styles.winnerName, { color: theme.textPrimary }]} numberOfLines={1}>
                                    {winner.user}
                                </Text>
                                <Text style={[styles.winnerRoll, { color: theme.textSecondary }]}>
                                    {winner.rollNumber}
                                </Text>
                                <Text style={[styles.winnerScore, { color: theme.primary }]}>
                                    {winner.score} pts
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Full list */}
                    {(data?.winners ?? []).map((winner: any) => (
                        <View
                            key={winner.rollNumber}
                            style={[styles.row, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                        >
                            <Text style={[styles.rank, { color: theme.textMuted }]}>
                                {formatOrdinalRank(winner.rank)}
                            </Text>
                            <View style={styles.rowInfo}>
                                <Text style={[styles.rowName, { color: theme.textPrimary }]}>{winner.user}</Text>
                                <Text style={[styles.rowRoll, { color: theme.textSecondary }]}>{winner.rollNumber}</Text>
                            </View>
                            <Text style={[styles.rowScore, { color: theme.primary }]}>{winner.score} pts</Text>
                        </View>
                    ))}
                </>
            )}

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
    back: { marginBottom: 8 },
    backText: { fontSize: 15, fontWeight: "700" },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, fontSize: 52, lineHeight: 54, fontWeight: "800" },
    subtitle: { marginTop: 6, fontSize: 16, marginBottom: 4 },
    declaredAt: { fontSize: 13, marginBottom: 16 },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 12 },
    noWinners: { fontSize: 16, lineHeight: 24 },
    podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, marginVertical: 20 },
    podiumSlot: {
        flex: 1,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "flex-end",
        padding: 10,
        gap: 4,
    },
    medal: { fontSize: 30 },
    podiumRank: { fontSize: 12, fontWeight: "700" },
    winnerName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
    winnerRoll: { fontSize: 11, textAlign: "center" },
    winnerScore: { fontSize: 15, fontWeight: "800" },
    row: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        gap: 10,
    },
    rank: { fontSize: 20, width: 36, textAlign: "center" },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 15, fontWeight: "700" },
    rowRoll: { fontSize: 13, marginTop: 2 },
    rowScore: { fontSize: 16, fontWeight: "800" },
    cta: { marginTop: 20, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    ctaText: { fontSize: 17, fontWeight: "700" },
});

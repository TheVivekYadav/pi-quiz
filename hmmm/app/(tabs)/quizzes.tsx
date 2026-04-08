import { isAdmin } from "@/constants/auth-session";
import { adminListQuizzes, fetchUpcomingQuizzes, QuizListItem } from "@/constants/quiz-api";
import { useLoadTimeout } from "@/hook/useLoadTimeout";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuizzesTab() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState<QuizListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timedOut, setTimedOut] = useState(false);
    const adminView = isAdmin();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setTimedOut(false);
        try {
            const payload = adminView ? await adminListQuizzes() : await fetchUpcomingQuizzes();
            setItems(payload);
        } catch (err: any) {
            setError(err?.message || 'Failed to load quizzes');
        } finally {
            setLoading(false);
        }
    }, [adminView]);

    useEffect(() => { load(); }, [load]);
    useLoadTimeout(loading, () => { setTimedOut(true); setLoading(false); });

    if (timedOut && items.length === 0) {
        return (
            <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
                <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>Could not connect — tap to retry.</Text>
                <Pressable onPress={load} style={{ borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#2563eb' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>QUIZ HUB</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
                {adminView ? "All Quizzes" : "Upcoming Quizzes"}
            </Text>

            {!!error && (
                <View style={[styles.errorBanner, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                    <Text style={{ color: '#b91c1c', fontSize: 13 }}>⚠ {error}</Text>
                </View>
            )}

            {loading && <ActivityIndicator color={theme.primary} size="large" />}

            {!loading && items.map((quiz) => {
                const isPast = adminView && new Date(quiz.startsAtIso) < new Date();
                return (
                <Pressable
                    key={quiz.id}
                    onPress={() => router.push({ pathname: "/quiz/[id]", params: { id: quiz.id } } as any)}
                    style={({ pressed }) => [
                        styles.card,
                        {
                            backgroundColor: theme.surfaceLight,
                            borderColor: theme.border,
                            opacity: pressed ? 0.9 : 1,
                        },
                    ]}
                >
                    <View style={styles.row}>
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{quiz.title}</Text>
                        <View style={styles.badges}>
                            {isPast && (
                                <View style={[styles.pastBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                    <Text style={[styles.pastBadgeText, { color: theme.textSecondary }]}>Past</Text>
                                </View>
                            )}
                            <Text style={[styles.level, { color: theme.primary }]}>{quiz.level}</Text>
                        </View>
                    </View>
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>{quiz.category} • {new Date(quiz.startsAtIso).toLocaleString()}</Text>
                    <View style={[styles.cta, { backgroundColor: theme.buttonPrimary }]}>
                        <Ionicons name="arrow-forward" size={16} color={theme.textInverse} />
                        <Text style={[styles.ctaText, { color: theme.textInverse }]}>Open</Text>
                    </View>
                </Pressable>
                );
            })}

            {!loading && items.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No quizzes found</Text>
                    <Text style={[styles.emptyMeta, { color: theme.textSecondary }]}>
                        {adminView ? "You can create your first quiz from the Admin tab." : "Please check back later or contact your admin."}
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, marginBottom: 12, fontSize: 32, fontWeight: "800" },
    card: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    cardTitle: { fontSize: 21, fontWeight: "700", flex: 1 },
    badges: { flexDirection: "row", alignItems: "center", gap: 6 },
    pastBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    pastBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
    level: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    meta: { marginTop: 8, fontSize: 14 },
    cta: {
        marginTop: 12,
        alignSelf: "flex-start",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    ctaText: { fontSize: 13, fontWeight: "700" },
    emptyCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 8 },
    emptyTitle: { fontSize: 18, fontWeight: "700" },
    emptyMeta: { marginTop: 8, fontSize: 14, lineHeight: 20 },
    errorBanner: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
});

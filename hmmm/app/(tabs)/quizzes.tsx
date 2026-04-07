import { isAdmin } from "@/constants/auth-session";
import { fetchUpcomingQuizzes, QuizListItem } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuizzesTab() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState<QuizListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const adminView = isAdmin();

    useEffect(() => {
        const run = async () => {
            try {
                const payload = await fetchUpcomingQuizzes();
                setItems(payload);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, []);

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>QUIZ HUB</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Upcoming Quizzes</Text>

            {loading && <ActivityIndicator color={theme.primary} size="large" />}

            {!loading && items.map((quiz) => (
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
                        <Text style={[styles.level, { color: theme.primary }]}>{quiz.level}</Text>
                    </View>
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>{quiz.category} • {new Date(quiz.startsAtIso).toLocaleString()}</Text>
                    <View style={[styles.cta, { backgroundColor: theme.buttonPrimary }]}>
                        <Ionicons name="arrow-forward" size={16} color={theme.textInverse} />
                        <Text style={[styles.ctaText, { color: theme.textInverse }]}>Open</Text>
                    </View>
                </Pressable>
            ))}

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
});

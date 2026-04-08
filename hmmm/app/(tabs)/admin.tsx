import { isAdmin } from "@/constants/auth-session";
import { adminDeleteQuiz, adminListQuizzes, QuizListItem } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminTab() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);

    useEffect(() => {
        if (!isAdmin()) return;
        adminListQuizzes()
            .then(setQuizzes)
            .catch((err: any) => Alert.alert("Error", err?.message || "Failed to load quizzes."))
            .finally(() => setLoadingQuizzes(false));
    }, []);

    const handleDelete = (quiz: QuizListItem) => {
        Alert.alert(
            "Delete Quiz",
            `Are you sure you want to delete "${quiz.title}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await adminDeleteQuiz(quiz.id);
                            setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "Failed to delete quiz.");
                        }
                    },
                },
            ]
        );
    };

    if (!isAdmin()) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={[styles.denied, { color: theme.error }]}>Access denied</Text>
                <Text style={[styles.deniedSub, { color: theme.textSecondary }]}>This section is available for admins only.</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN CONSOLE</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Manage Platform</Text>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Quiz Management</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Create, publish, and monitor quizzes.</Text>
                <Pressable
                    onPress={() => router.push("/create-quiz" as any)}
                    style={({ pressed }) => [
                        styles.action,
                        { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
                    ]}
                >
                    <Ionicons name="add-circle-outline" size={18} color={theme.textInverse} />
                    <Text style={[styles.actionText, { color: theme.textInverse }]}>Open Creator</Text>
                </Pressable>
            </View>

            {/* ── Quiz list ── */}
            <Text style={[styles.sectionHeader, { color: theme.textPrimary }]}>Your Quizzes</Text>

            {loadingQuizzes && <ActivityIndicator color={theme.primary} style={styles.loader} />}

            {!loadingQuizzes && quizzes.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No quizzes yet. Tap "Open Creator" to create your first quiz.</Text>
                </View>
            )}

            {!loadingQuizzes && quizzes.map((quiz) => {
                const isPast = new Date(quiz.startsAtIso) < new Date();
                return (
                    <View
                        key={quiz.id}
                        style={[styles.quizRow, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                    >
                        <View style={styles.quizInfo}>
                            <View style={styles.quizTitleRow}>
                                <Text style={[styles.quizTitle, { color: theme.textPrimary }]} numberOfLines={1}>{quiz.title}</Text>
                                {isPast && (
                                    <View style={[styles.pastBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                        <Text style={[styles.pastBadgeText, { color: theme.textSecondary }]}>Past</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]}>
                                {quiz.category} • {quiz.level} • {new Date(quiz.startsAtIso).toLocaleString()}
                            </Text>
                        </View>
                        <View style={styles.quizActions}>
                            <Pressable
                                onPress={() => router.push({ pathname: "/quiz/[id]", params: { id: quiz.id } } as any)}
                                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                accessibilityLabel="View quiz"
                            >
                                <Ionicons name="eye-outline" size={20} color={theme.primary} />
                            </Pressable>
                            <Pressable
                                onPress={() => handleDelete(quiz)}
                                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                accessibilityLabel="Delete quiz"
                            >
                                <Ionicons name="trash-outline" size={20} color={theme.error} />
                            </Pressable>
                        </View>
                    </View>
                );
            })}

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Analytics</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Review enrollments, attempts, and leaderboard trends.</Text>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Admin Status</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>You are signed in with admin privileges.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, marginBottom: 12, fontSize: 34, fontWeight: "800" },
    denied: { fontSize: 22, fontWeight: "800" },
    deniedSub: { marginTop: 6, fontSize: 14 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    cardTitle: { fontSize: 20, fontWeight: "700" },
    cardSub: { marginTop: 6, fontSize: 14, lineHeight: 20 },
    action: {
        marginTop: 12,
        alignSelf: "flex-start",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    actionText: { fontSize: 13, fontWeight: "700" },
    sectionHeader: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginTop: 4 },
    loader: { marginVertical: 16 },
    emptyCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
    emptyText: { fontSize: 14, lineHeight: 20 },
    quizRow: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    quizInfo: { flex: 1 },
    quizTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    quizTitle: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
    quizMeta: { marginTop: 4, fontSize: 12 },
    quizActions: { flexDirection: "row", gap: 4 },
    iconBtn: { padding: 6 },
    pastBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
    pastBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
});

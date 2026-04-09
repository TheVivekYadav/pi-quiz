import { adminFetchQuizResponses } from "@/constants/quiz-api";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Question = { id: string; text: string; options: { id: string; label: string }[]; correctOptionId: string; questionIndex: number };
type UserRow = { userId: number; name: string; rollNumber: string; answers: Record<string, string> };

export default function AdminResponsesScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [data, setData] = useState<{ questions: Question[]; users: UserRow[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<number | null>(null);

    useEffect(() => {
        if (!quizId) return;
        adminFetchQuizResponses(quizId)
            .then(setData)
            .catch((err: any) => setError(err?.message || "Failed to load responses."))
            .finally(() => setLoading(false));
    }, [quizId]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const questions = data?.questions ?? [];
    const users = data?.users ?? [];

    if (error) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={[{ color: theme.error, fontSize: 15, textAlign: "center", marginHorizontal: 24 }]}>{error}</Text>
                <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <Text style={[{ color: theme.primary, fontWeight: "700" }]}>← Back</Text>
                </Pressable>
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

            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN • USER RESPONSES</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>All Answers</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
                {users.length} participant{users.length !== 1 ? "s" : ""} • {questions.length} question{questions.length !== 1 ? "s" : ""}
            </Text>

            {users.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No responses yet.</Text>
                </View>
            )}

            {users.map((user, uIdx) => (
                <View key={user.userId} style={[styles.userCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Pressable
                        style={styles.userHeader}
                        onPress={() => setExpanded(expanded === uIdx ? null : uIdx)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.userName, { color: theme.textPrimary }]}>{user.name || user.rollNumber}</Text>
                            <Text style={[styles.userRoll, { color: theme.textSecondary }]}>{user.rollNumber}</Text>
                        </View>
                        <View style={[styles.scoreBadge, { backgroundColor: `${theme.primary}22` }]}>
                            <Text style={[styles.scoreBadgeText, { color: theme.primary }]}>
                                {questions.filter(q => user.answers[q.id] === q.correctOptionId).length}/{questions.length} correct
                            </Text>
                        </View>
                        <Text style={[styles.chevron, { color: theme.textMuted }]}>{expanded === uIdx ? "▲" : "▼"}</Text>
                    </Pressable>

                    {expanded === uIdx && (
                        <View style={styles.answersBlock}>
                            {questions.map((q, qIdx) => {
                                const selected = user.answers[q.id] ?? null;
                                const isCorrect = selected === q.correctOptionId;
                                const selectedLabel = q.options.find(o => o.id === selected)?.label ?? "—";
                                const correctLabel = q.options.find(o => o.id === q.correctOptionId)?.label ?? "?";
                                return (
                                    <View
                                        key={q.id}
                                        style={[
                                            styles.qRow,
                                            {
                                                borderColor: selected === null ? theme.border : isCorrect ? theme.success : theme.error,
                                                backgroundColor: selected === null ? theme.surface : isCorrect ? `${theme.success}11` : `${theme.error}11`,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.qIndex, { color: theme.textMuted }]}>Q{qIdx + 1}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.qText, { color: theme.textPrimary }]} numberOfLines={2}>{q.text}</Text>
                                            <Text style={[styles.answerRow, { color: selected === null ? theme.textMuted : isCorrect ? theme.success : theme.error }]}>
                                                {selected === null ? "Not answered" : isCorrect ? `✓ ${selectedLabel}` : `✗ ${selectedLabel}`}
                                            </Text>
                                            {!isCorrect && selected !== null && (
                                                <Text style={[styles.correctHint, { color: theme.success }]}>Correct: {correctLabel}</Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            ))}
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
    sub: { marginTop: 6, fontSize: 14, marginBottom: 16 },
    emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
    emptyText: { fontSize: 15 },
    userCard: { borderWidth: 1, borderRadius: 16, marginBottom: 10, overflow: "hidden" },
    userHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
    userName: { fontSize: 15, fontWeight: "700" },
    userRoll: { fontSize: 12, marginTop: 2 },
    scoreBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    scoreBadgeText: { fontSize: 12, fontWeight: "700" },
    chevron: { fontSize: 12, marginLeft: 4 },
    answersBlock: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
    qRow: { borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", gap: 8 },
    qIndex: { fontSize: 12, fontWeight: "700", width: 28, marginTop: 2 },
    qText: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
    answerRow: { fontSize: 13, marginTop: 4, fontWeight: "600" },
    correctHint: { fontSize: 12, marginTop: 2 },
});

import { fetchMyQuizResponses } from "@/constants/quiz-api";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ResponseItem = {
    id: string;
    text: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
    questionIndex: number;
    selectedOptionId: string | null;
    isCorrect: boolean;
};

export default function MyResponsesScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [responses, setResponses] = useState<ResponseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!quizId) return;
        fetchMyQuizResponses(quizId)
            .then(setResponses)
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

    const correct = responses.filter(r => r.isCorrect).length;
    const total = responses.length;

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Pressable onPress={() => router.back()} style={styles.back}>
                <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>MY ANSWERS</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Review</Text>

            {error ? (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.error }]}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={[styles.summaryRow, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.success }]}>{correct}</Text>
                            <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>CORRECT</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: theme.divider }]} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.error }]}>{total - correct}</Text>
                            <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>WRONG</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: theme.divider }]} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.primary }]}>{total}</Text>
                            <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>TOTAL</Text>
                        </View>
                    </View>

                    {responses.map((r, idx) => {
                        const selectedLabel = r.options.find(o => o.id === r.selectedOptionId)?.label ?? null;
                        const correctLabel = r.options.find(o => o.id === r.correctOptionId)?.label ?? "?";
                        return (
                            <View
                                key={r.id}
                                style={[
                                    styles.qCard,
                                    {
                                        borderColor: r.selectedOptionId === null ? theme.border : r.isCorrect ? theme.success : theme.error,
                                        backgroundColor: r.selectedOptionId === null ? theme.surface : r.isCorrect ? `${theme.success}11` : `${theme.error}11`,
                                    },
                                ]}
                            >
                                <Text style={[styles.qNum, { color: theme.textMuted }]}>Q{idx + 1}</Text>
                                <Text style={[styles.qText, { color: theme.textPrimary }]}>{r.text}</Text>

                                <View style={styles.optionsList}>
                                    {r.options.map((opt) => {
                                        const isSelected = opt.id === r.selectedOptionId;
                                        const isCorrectOpt = opt.id === r.correctOptionId;
                                        let bg: string = theme.surface;
                                        let borderColor: string = theme.border;
                                        let textColor: string = theme.textPrimary;

                                        if (isSelected && r.isCorrect) {
                                            bg = `${theme.success}22`;
                                            borderColor = theme.success;
                                            textColor = theme.success;
                                        } else if (isSelected && !r.isCorrect) {
                                            bg = `${theme.error}22`;
                                            borderColor = theme.error;
                                            textColor = theme.error;
                                        } else if (isCorrectOpt && !r.isCorrect) {
                                            bg = `${theme.success}11`;
                                            borderColor = theme.success;
                                            textColor = theme.success;
                                        }

                                        const getOptionPrefix = (isSelected: boolean, isCorrectOpt: boolean, isCorrectAnswer: boolean) => {
                                            if (isSelected) return isCorrectAnswer ? "✓ " : "✗ ";
                                            if (isCorrectOpt && !isCorrectAnswer) return "✓ ";
                                            return "  ";
                                        };

                                        return (
                                            <View
                                                key={opt.id}
                                                style={[styles.optionRow, { backgroundColor: bg, borderColor }]}
                                            >
                                                <Text style={[styles.optionText, { color: textColor }]}>
                                                    {getOptionPrefix(isSelected, isCorrectOpt, r.isCorrect)}
                                                    {opt.label}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>

                                {r.selectedOptionId === null && (
                                    <Text style={[styles.skippedText, { color: theme.textMuted }]}>Not answered</Text>
                                )}
                                {!r.isCorrect && r.selectedOptionId !== null && (
                                    <Text style={[styles.correctHint, { color: theme.success }]}>
                                        Correct answer: {correctLabel}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </>
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
    title: { marginTop: 8, fontSize: 36, lineHeight: 40, fontWeight: "800", marginBottom: 16 },
    emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
    emptyText: { fontSize: 15 },
    summaryRow: {
        flexDirection: "row",
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        justifyContent: "space-around",
    },
    summaryItem: { alignItems: "center", flex: 1 },
    summaryValue: { fontSize: 28, fontWeight: "800" },
    summaryLabel: { fontSize: 10, letterSpacing: 1, fontWeight: "700", marginTop: 2 },
    summaryDivider: { width: 1, marginVertical: 4 },
    qCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    qNum: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
    qText: { fontSize: 16, fontWeight: "700", lineHeight: 22, marginBottom: 10 },
    optionsList: { gap: 6 },
    optionRow: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    optionText: { fontSize: 14, fontWeight: "600" },
    skippedText: { fontSize: 13, marginTop: 8, fontStyle: "italic" },
    correctHint: { fontSize: 13, marginTop: 8, fontWeight: "600" },
});

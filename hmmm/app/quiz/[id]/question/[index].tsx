import { fetchQuizQuestion, submitQuizAnswers } from "@/constants/quiz-api";
import { getAnswer, getQuizAnswers, setAnswer, setQuizResult } from "@/constants/quiz-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuestionScreen() {
    const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const currentIndex = useMemo(() => Number(Array.isArray(index) ? index[0] : index), [index]);

    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!quizId || !currentIndex) return;

        const run = async () => {
            try {
                const payload = await fetchQuizQuestion(quizId, currentIndex);
                setData(payload);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [quizId, currentIndex]);

    if (loading || !data) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const selected = getAnswer(quizId!, data.question.id);

    const goNext = async () => {
        if (!selected || !quizId) return;

        if (data.current < data.total) {
            router.replace({
                pathname: "/quiz/[id]/question/[index]",
                params: { id: quizId, index: String(data.current + 1) },
            } as any);
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitQuizAnswers(quizId, getQuizAnswers(quizId));
            setQuizResult(quizId, result);
            router.replace({ pathname: "/quiz/[id]/result", params: { id: quizId } } as any);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.brand, { color: theme.textPrimary }]}>Intellectual Playground</Text>
            <Text style={[styles.progress, { color: theme.textSecondary }]}>{data.current}/{data.total}</Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.divider }]}>
                <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${(data.current / data.total) * 100}%` }]} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <View style={styles.badges}>
                    <Text style={[styles.badge, { backgroundColor: theme.warningMuted, color: theme.textPrimary }]}>HIGH POINTS</Text>
                    <Text style={[styles.badge, { backgroundColor: theme.primaryMuted, color: theme.textPrimary }]}>00:{String(data.timerSeconds).padStart(2, "0")}</Text>
                </View>

                <Text style={[styles.question, { color: theme.textPrimary }]}>{data.question.text}</Text>

                {!!data.question.imageUrl && <Image source={{ uri: data.question.imageUrl }} style={styles.image} />}

                {data.question.options.map((option: any) => {
                    const isActive = selected === option.id;
                    return (
                        <Pressable
                            key={option.id}
                            onPress={() => setAnswer(quizId!, data.question.id, option.id)}
                            style={[
                                styles.option,
                                {
                                    backgroundColor: isActive ? theme.accent : theme.optionDefault,
                                    borderColor: isActive ? theme.textPrimary : "transparent",
                                },
                            ]}
                        >
                            <Text style={[styles.optionText, { color: isActive ? theme.textInverse : theme.textPrimary }]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <Pressable
                disabled={!selected || submitting}
                onPress={goNext}
                style={[
                    styles.next,
                    {
                        backgroundColor: !selected || submitting ? theme.buttonDisabled : theme.buttonPrimary,
                    },
                ]}
            >
                <Text style={[styles.nextText, { color: theme.textInverse }]}>{data.current < data.total ? "Next Question" : submitting ? "Submitting..." : "Finish Quiz"}</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.textInverse} />
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    brand: { fontSize: 20, fontWeight: "800" },
    progress: { marginTop: 10, fontSize: 13, fontWeight: "700" },
    progressTrack: { marginTop: 6, height: 8, borderRadius: 8 },
    progressFill: { height: 8, borderRadius: 8 },
    card: { marginTop: 14, borderWidth: 1, borderRadius: 18, padding: 14 },
    badges: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 11, fontWeight: "700" },
    question: { fontSize: 48, lineHeight: 50, fontWeight: "800", marginBottom: 12 },
    image: { width: "100%", height: 200, borderRadius: 16, marginBottom: 10 },
    option: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 14,
        marginBottom: 10,
    },
    optionText: { fontSize: 27, fontWeight: "700" },
    next: {
        marginTop: 14,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    nextText: { fontSize: 17, fontWeight: "700" },
});

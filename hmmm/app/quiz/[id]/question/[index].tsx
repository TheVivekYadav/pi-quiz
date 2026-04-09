import { fetchQuizQuestion, submitQuizAnswers } from "@/constants/quiz-api";
import { getAnswer, getQuizAnswers, setAnswer, setQuizResult } from "@/constants/quiz-session";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuestionScreen() {
    const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const currentIndex = useMemo(() => Number(Array.isArray(index) ? index[0] : index), [index]);

    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Track when the first question was shown to compute real timeTakenMinutes
    const startedAtRef = useRef<string | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        if (!quizId || !currentIndex) return;

        const run = async () => {
            try {
                const payload = await fetchQuizQuestion(quizId, currentIndex);
                setData(payload);
                setTimeLeft(payload.timerSeconds ?? 30);
                // Record when the first question loads
                if (currentIndex === 1 && !startedAtRef.current) {
                    startedAtRef.current = new Date().toISOString();
                }
            } finally {
                setLoading(false);
            }
        };

        run();

        return clearTimer;
    }, [quizId, currentIndex]);

    // Start countdown once data is loaded
    useEffect(() => {
        if (!data || timeLeft <= 0) return;

        clearTimer();
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return clearTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.question?.id]);

    if (loading || !data) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const selected = getAnswer(quizId!, data.question.id);
    const timerExpired = timeLeft === 0;

    const goNext = async () => {
        if (!quizId) return;
        clearTimer();

        if (data.current < data.total) {
            router.replace({
                pathname: "/quiz/[id]/question/[index]",
                params: { id: quizId, index: String(data.current + 1) },
            } as any);
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitQuizAnswers(quizId, getQuizAnswers(quizId), startedAtRef.current ?? undefined);
            setQuizResult(quizId, result);
            router.replace({ pathname: "/quiz/[id]/result", params: { id: quizId } } as any);
        } catch (err: any) {
            // Handle lockout / forbidden messages
            const msg = err?.message || String(err);
            if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('too many attempts') || msg.toLowerCase().includes('already completed')) {
                Alert.alert('Locked out', msg, [
                    { text: 'Back to Lobby', onPress: () => router.replace({ pathname: '/quiz/[id]/lobby', params: { id: quizId } } as any) },
                ]);
                return;
            }
            Alert.alert('Error', msg || 'Failed to submit answers');
        } finally {
            setSubmitting(false);
        }
    };

    const timerColor = timeLeft <= 10 ? theme.error : timeLeft <= 20 ? theme.warning : theme.primary;

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.brand, { color: theme.textPrimary }]}>Made by verihire.live Team</Text>
            <Text style={[styles.progress, { color: theme.textSecondary }]}>{data.current}/{data.total}</Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.divider }]}>
                <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${(data.current / data.total) * 100}%` }]} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <View style={styles.badges}>
                    {data.highPoints && (
                        <Text style={[styles.badge, { backgroundColor: theme.warningMuted, color: theme.textPrimary }]}>HIGH POINTS</Text>
                    )}
                    <Text style={[
                        styles.badge,
                        {
                            backgroundColor: timerExpired ? theme.error : theme.primaryMuted,
                            color: timerExpired ? theme.textInverse : theme.textPrimary,
                            marginLeft: "auto",
                        },
                    ]}>
                        {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
                    </Text>
                </View>

                {timerExpired && (
                    <Text style={[styles.timerWarning, { color: theme.error }]}>Time's up! You can still submit your current answer.</Text>
                )}

                <Text style={[styles.question, { color: theme.textPrimary }]}>{data.question.text}</Text>

                {!!data.question.imageUrl && <Image source={{ uri: data.question.imageUrl }} style={styles.image} />}

                {data.question.options.map((option: any) => {
                    const isActive = selected === option.id;
                    return (
                        <Pressable
                            key={option.id}
                            onPress={() => !timerExpired && setAnswer(quizId!, data.question.id, option.id)}
                            style={[
                                styles.option,
                                {
                                    backgroundColor: isActive ? theme.accent : theme.optionDefault,
                                    borderColor: isActive ? theme.textPrimary : "transparent",
                                    opacity: timerExpired && !isActive ? 0.5 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.optionText, { color: isActive ? theme.textInverse : theme.textPrimary }]}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <Pressable
                disabled={(!selected && !timerExpired) || submitting}
                onPress={goNext}
                style={[
                    styles.next,
                    {
                        backgroundColor: ((!selected && !timerExpired) || submitting) ? theme.buttonDisabled : theme.buttonPrimary,
                    },
                ]}
            >
                <Text style={[styles.nextText, { color: theme.textInverse }]}>
                    {data.current < data.total
                        ? timerExpired ? "Skip to Next" : "Next Question"
                        : submitting ? "Submitting..." : "Finish Quiz"}
                </Text>
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
    timerWarning: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
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

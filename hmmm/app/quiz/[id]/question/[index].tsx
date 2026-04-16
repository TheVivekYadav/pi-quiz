import { fetchQuizQuestion, submitQuizAnswers } from "@/constants/quiz-api";
import {
    getAnswer,
    getExamStartedAt,
    getQuizAnswers,
    getQuestionRemainingTime,
    getVisitedQuestions,
    markQuestionStarted,
    setAnswer,
    setExamStartedAt,
    setQuizResult,
    setVisitedQuestion,
} from "@/constants/quiz-session";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
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
    const [totalRemaining, setTotalRemaining] = useState(0);
    const [navigatorVisible, setNavigatorVisible] = useState(false);
    const [webNavigatorVisible, setWebNavigatorVisible] = useState(false);
    // Re-render trigger so navigator reflects latest answers
    const [answerTick, setAnswerTick] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const clearTotalTimer = () => {
        if (totalTimerRef.current) {
            clearInterval(totalTimerRef.current);
            totalTimerRef.current = null;
        }
    };

    const clearAutoAdvance = () => {
        if (autoAdvanceRef.current) {
            clearTimeout(autoAdvanceRef.current);
            autoAdvanceRef.current = null;
        }
    };

    // Load question on index change
    useEffect(() => {
        if (!quizId || !currentIndex) return;
        setLoading(true);

        const run = async () => {
            try {
                const payload = await fetchQuizQuestion(quizId, currentIndex);
                setData(payload);

                // Record exam start time (only once, on question 1)
                if (currentIndex === 1) {
                    setExamStartedAt(quizId);
                }
                // Mark timer start for this question (no-op if already marked)
                markQuestionStarted(quizId, currentIndex);
                // Initialise timer from stored start time so it is preserved across navigation
                setTimeLeft(getQuestionRemainingTime(quizId, currentIndex, payload.timerSeconds ?? 30));
                // Track which index maps to which questionId
                setVisitedQuestion(quizId, currentIndex, payload.question.id);
            } finally {
                setLoading(false);
            }
        };

        run();

        return clearTimer;
    }, [quizId, currentIndex]);

    // Per-question countdown
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

    // Total quiz countdown — derived from quizEndsAtIso returned by backend
    useEffect(() => {
        if (!data?.quizEndsAtIso) return;

        const tick = () => {
            const remaining = Math.max(0, Math.floor((new Date(data.quizEndsAtIso).getTime() - Date.now()) / 1000));
            setTotalRemaining(remaining);
        };

        clearTotalTimer();
        tick();
        totalTimerRef.current = setInterval(tick, 1000);

        return clearTotalTimer;
    }, [data?.quizEndsAtIso]);

    // Auto-advance when per-question timer expires (after 2-second "Time's up!" pause)
    useEffect(() => {
        if (timeLeft !== 0 || !data || submitting) return;
        clearAutoAdvance();
        autoAdvanceRef.current = setTimeout(() => {
            autoAdvanceRef.current = null;
            goNext();
        }, 2000);
        return clearAutoAdvance;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft]);

    // Auto-submit when the total quiz window closes
    useEffect(() => {
        if (totalRemaining !== 0 || !data || submitting) return;
        clearTimer();
        clearAutoAdvance();
        // Submit immediately with whatever answers exist
        const run = async () => {
            if (!quizId) return;
            setSubmitting(true);
            try {
                const startedAt = getExamStartedAt(quizId) ?? undefined;
                const result = await submitQuizAnswers(quizId, getQuizAnswers(quizId), startedAt);
                setQuizResult(quizId, result);
                clearTotalTimer();
                router.replace({ pathname: "/quiz/[id]/result", params: { id: quizId } } as any);
            } catch (err: any) {
                const msg = err?.message || String(err);
                Alert.alert("Quiz Ended", msg || "Time is up! Your answers have been submitted.");
                router.replace({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any);
            } finally {
                setSubmitting(false);
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalRemaining]);

    // ── Navigation prevention ────────────────────────────────────────────────
    // Web: warn before browser close / refresh / tab navigation
    useEffect(() => {
        if (Platform.OS !== "web") return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            // Modern browsers show their own generic message; returnValue is required for older ones
            e.returnValue = "You are in the middle of a quiz. Leaving will not pause the timer.";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, []);

    // Native (Android): intercept hardware back button
    useEffect(() => {
        if (Platform.OS === "web") return;
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            Alert.alert(
                "Leave Quiz?",
                "The total quiz timer keeps running while you are away. Your answered questions are saved. Are you sure you want to leave?",
                [
                    { text: "Stay in Quiz", style: "cancel" },
                    {
                        text: "Leave",
                        style: "destructive",
                        onPress: () => quizId && router.replace({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any),
                    },
                ],
            );
            return true; // prevent default back action
        });
        return () => subscription.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId]);
    // ────────────────────────────────────────────────────────────────────────

    if (loading || !data) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const selected = getAnswer(quizId!, data.question.id);
    const timerExpired = timeLeft === 0;
    const visitedMap = getVisitedQuestions(quizId!);
    const answers = getQuizAnswers(quizId!);
    const answeredCount = Object.keys(answers).length;
    const attemptedCount = Object.keys(visitedMap).length;
    const unattemptedCount = data.total - attemptedCount;

    const fmtTime = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const goTo = (idx: number) => {
        if (!quizId) return;
        clearTimer();
        clearAutoAdvance();
        setNavigatorVisible(false);
        router.replace({
            pathname: "/quiz/[id]/question/[index]",
            params: { id: quizId, index: String(idx) },
        } as any);
    };

    const goPrev = () => {
        if (currentIndex > 1) goTo(currentIndex - 1);
    };

    const goNext = async () => {
        if (!quizId) return;
        clearTimer();
        clearAutoAdvance();

        if (data.current < data.total) {
            router.replace({
                pathname: "/quiz/[id]/question/[index]",
                params: { id: quizId, index: String(data.current + 1) },
            } as any);
            return;
        }

        setSubmitting(true);
        try {
            const startedAt = getExamStartedAt(quizId) ?? undefined;
            const result = await submitQuizAnswers(quizId, getQuizAnswers(quizId), startedAt);
            setQuizResult(quizId, result);
            clearTotalTimer();
            router.replace({ pathname: "/quiz/[id]/result", params: { id: quizId } } as any);
        } catch (err: any) {
            const msg = err?.message || String(err);
            if (
                msg.toLowerCase().includes("locked") ||
                msg.toLowerCase().includes("too many attempts") ||
                msg.toLowerCase().includes("already completed")
            ) {
                Alert.alert("Locked out", msg, [
                    {
                        text: "Back to Lobby",
                        onPress: () =>
                            router.replace({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any),
                    },
                ]);
                return;
            }
            Alert.alert("Error", msg || "Failed to submit answers");
        } finally {
            setSubmitting(false);
        }
    };

    const timerUrgent = timeLeft <= 10;
    const timerWarning = !timerUrgent && timeLeft <= 20;
    const timerBg = timerExpired
        ? theme.error
        : timerUrgent
        ? theme.error
        : timerWarning
        ? theme.warning
        : theme.primaryMuted;
    const timerFg = timerExpired || timerUrgent ? theme.textInverse : theme.textPrimary;

    const isWeb = Platform.OS === "web";

    return (
        <View style={[styles.root, { backgroundColor: theme.background }]}>
            {/* ── Web layout (top info bar + full-width content) ─────── */}
            {isWeb ? (
                <View style={styles.webLayout}>
                    {/* Top info bar */}
                    <View style={[styles.topInfoBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <View style={styles.topInfoLeft}>
                            <View style={[styles.statChip, { backgroundColor: theme.successMuted }]}>
                                <Text style={[styles.statChipText, { color: theme.success }]}>{answeredCount} Done</Text>
                            </View>
                            <View style={[styles.statChip, { backgroundColor: theme.warningMuted }]}>
                                <Text style={[styles.statChipText, { color: theme.textPrimary }]}>{attemptedCount - answeredCount} Visited</Text>
                            </View>
                            <View style={[styles.statChip, { backgroundColor: theme.errorMuted }]}>
                                <Text style={[styles.statChipText, { color: theme.error }]}>{unattemptedCount} Left</Text>
                            </View>
                        </View>
                        <View style={styles.topInfoRight}>
                            {/* Total quiz countdown */}
                            <View style={[styles.statChip, { backgroundColor: totalRemaining <= 60 ? theme.errorMuted : theme.primaryMuted }]}>
                                <Ionicons name="time-outline" size={13} color={totalRemaining <= 60 ? theme.error : theme.primary} />
                                <Text style={[styles.statChipText, { color: totalRemaining <= 60 ? theme.error : theme.primary }]}>
                                    {fmtTime(totalRemaining)}
                                </Text>
                            </View>
                            {/* Toggle question navigator */}
                            <Pressable
                                onPress={() => setWebNavigatorVisible((v) => !v)}
                                style={[styles.statChip, { backgroundColor: webNavigatorVisible ? theme.primaryMuted : theme.surfaceLight, borderColor: theme.border, borderWidth: 1 }]}
                            >
                                <Ionicons name="grid-outline" size={13} color={theme.textPrimary} />
                                <Text style={[styles.statChipText, { color: theme.textPrimary }]}>
                                    {webNavigatorVisible ? "Hide" : "Questions"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Collapsible question navigator */}
                    {webNavigatorVisible && (
                        <View style={[styles.webNavigator, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                            <View style={styles.webNavigatorGrid}>
                                {Array.from({ length: data.total }, (_, i) => {
                                    const qi = i + 1;
                                    const qId = visitedMap[qi];
                                    const isAnswered = qId ? !!answers[qId] : false;
                                    const isVisited = !!qId;
                                    const isCurrent = qi === currentIndex;
                                    return (
                                        <Pressable
                                            key={qi}
                                            onPress={() => goTo(qi)}
                                            style={[
                                                styles.sidebarCell,
                                                {
                                                    backgroundColor: isCurrent
                                                        ? theme.primary
                                                        : isAnswered
                                                        ? theme.successMuted
                                                        : isVisited
                                                        ? theme.warningMuted
                                                        : theme.surfaceLight,
                                                    borderColor: isCurrent ? theme.primary : theme.border,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.sidebarCellText,
                                                    {
                                                        color: isCurrent
                                                            ? theme.textInverse
                                                            : isAnswered
                                                            ? theme.success
                                                            : isVisited
                                                            ? theme.textPrimary
                                                            : theme.textMuted,
                                                    },
                                                ]}
                                            >
                                                {qi}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Main content */}
                    <ScrollView
                        style={styles.mainContent}
                        contentContainerStyle={{
                            paddingTop: 8,
                            paddingBottom: insets.bottom + 24,
                            paddingHorizontal: 24,
                        }}
                    >
                        <QuestionContent
                            data={data}
                            quizId={quizId!}
                            theme={theme}
                            timeLeft={timeLeft}
                            totalRemaining={totalRemaining}
                            timerBg={timerBg}
                            timerFg={timerFg}
                            timerExpired={timerExpired}
                            selected={selected}
                            submitting={submitting}
                            onSelectOption={(optId) => {
                                setAnswer(quizId!, data.question.id, optId);
                                setAnswerTick((t) => t + 1);
                            }}
                            onPrev={currentIndex > 1 ? goPrev : undefined}
                            onNext={goNext}
                            fmtTime={fmtTime}
                        />
                    </ScrollView>
                </View>
            ) : (
                /* ── Mobile layout ──────────────────────────────────── */
                <>
                    <ScrollView
                        style={styles.root}
                        contentContainerStyle={{
                            paddingTop: insets.top + 8,
                            paddingBottom: insets.bottom + 100,
                            paddingHorizontal: 16,
                        }}
                    >
                        <QuestionContent
                            data={data}
                            quizId={quizId!}
                            theme={theme}
                            timeLeft={timeLeft}
                            totalRemaining={totalRemaining}
                            timerBg={timerBg}
                            timerFg={timerFg}
                            timerExpired={timerExpired}
                            selected={selected}
                            submitting={submitting}
                            onSelectOption={(optId) => {
                                setAnswer(quizId!, data.question.id, optId);
                                setAnswerTick((t) => t + 1);
                            }}
                            onPrev={currentIndex > 1 ? goPrev : undefined}
                            onNext={goNext}
                            fmtTime={fmtTime}
                        />
                    </ScrollView>

                    {/* Mobile bottom bar */}
                    <View
                        style={[
                            styles.mobileBottomBar,
                            {
                                backgroundColor: theme.surface,
                                borderColor: theme.border,
                                paddingBottom: insets.bottom + 8,
                            },
                        ]}
                    >
                        <View style={styles.mobileBottomStats}>
                            <View style={[styles.statChip, { backgroundColor: theme.successMuted }]}>
                                <Text style={[styles.statChipText, { color: theme.success }]}>{answeredCount} Done</Text>
                            </View>
                            <View style={[styles.statChip, { backgroundColor: theme.errorMuted }]}>
                                <Text style={[styles.statChipText, { color: theme.error }]}>{unattemptedCount} Left</Text>
                            </View>
                            <View style={[styles.statChip, { backgroundColor: totalRemaining <= 60 ? theme.errorMuted : theme.primaryMuted }]}>
                                <Ionicons name="time-outline" size={11} color={totalRemaining <= 60 ? theme.error : theme.primary} />
                                <Text style={[styles.statChipText, { color: totalRemaining <= 60 ? theme.error : theme.primary }]}>{fmtTime(totalRemaining)}</Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => setNavigatorVisible(true)}
                            style={[styles.navigatorBtn, { backgroundColor: theme.buttonSecondary, borderColor: theme.border }]}
                        >
                            <Ionicons name="grid-outline" size={16} color={theme.textPrimary} />
                            <Text style={[styles.navigatorBtnText, { color: theme.textPrimary }]}>Questions</Text>
                        </Pressable>
                    </View>

                    {/* Mobile navigator modal */}
                    <Modal
                        visible={navigatorVisible}
                        animationType="slide"
                        transparent
                        onRequestClose={() => setNavigatorVisible(false)}
                    >
                        <Pressable
                            style={styles.modalOverlay}
                            onPress={() => setNavigatorVisible(false)}
                        >
                            <Pressable
                                style={[
                                    styles.modalSheet,
                                    {
                                        backgroundColor: theme.surface,
                                        paddingBottom: insets.bottom + 16,
                                    },
                                ]}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <View style={[styles.modalHandle, { backgroundColor: theme.divider }]} />
                                <Text style={[styles.modalTitle, { color: theme.textPrimary, marginBottom: 8 }]}>
                                    All Questions
                                </Text>
                                <View style={[styles.modalStatsRow, { marginBottom: 12 }]}>
                                    <View style={[styles.statChip, { backgroundColor: theme.successMuted }]}>
                                        <Text style={[styles.statChipText, { color: theme.success }]}>
                                            {answeredCount} Answered
                                        </Text>
                                    </View>
                                    <View style={[styles.statChip, { backgroundColor: theme.warningMuted }]}>
                                        <Text style={[styles.statChipText, { color: theme.textPrimary }]}>
                                            {attemptedCount - answeredCount} Visited
                                        </Text>
                                    </View>
                                    <View style={[styles.statChip, { backgroundColor: theme.errorMuted }]}>
                                        <Text style={[styles.statChipText, { color: theme.error }]}>
                                            {unattemptedCount} Left
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.modalGrid}>
                                    {Array.from({ length: data.total }, (_, i) => {
                                        const qi = i + 1;
                                        const qId = visitedMap[qi];
                                        const isAnswered = qId ? !!answers[qId] : false;
                                        const isVisited = !!qId;
                                        const isCurrent = qi === currentIndex;
                                        return (
                                            <Pressable
                                                key={qi}
                                                onPress={() => goTo(qi)}
                                                style={[
                                                    styles.modalCell,
                                                    {
                                                        backgroundColor: isCurrent
                                                            ? theme.primary
                                                            : isAnswered
                                                            ? theme.successMuted
                                                            : isVisited
                                                            ? theme.warningMuted
                                                            : theme.surfaceLight,
                                                        borderColor: isCurrent ? theme.primary : theme.border,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.modalCellText,
                                                        {
                                                            color: isCurrent
                                                                ? theme.textInverse
                                                                : isAnswered
                                                                ? theme.success
                                                                : isVisited
                                                                ? theme.textPrimary
                                                                : theme.textMuted,
                                                        },
                                                    ]}
                                                >
                                                    {qi}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </Pressable>
                        </Pressable>
                    </Modal>
                </>
            )}
        </View>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
   Shared question content (used in both web & mobile layouts)
──────────────────────────────────────────────────────────────────────────── */
function QuestionContent({
    data,
    quizId,
    theme,
    timeLeft,
    totalRemaining,
    timerBg,
    timerFg,
    timerExpired,
    selected,
    submitting,
    onSelectOption,
    onPrev,
    onNext,
    fmtTime,
}: {
    data: any;
    quizId: string;
    theme: any;
    timeLeft: number;
    totalRemaining: number;
    timerBg: string;
    timerFg: string;
    timerExpired: boolean;
    selected: string;
    submitting: boolean;
    onSelectOption: (optId: string) => void;
    onPrev?: () => void;
    onNext: () => void;
    fmtTime: (s: number) => string;
}) {
    const totalSeconds = (data.durationMinutes ?? 30) * 60;
    const totalProgress = totalSeconds > 0 ? Math.max(0, Math.min(1, totalRemaining / totalSeconds)) : 0;
    const totalUrgent = totalRemaining <= 60 && totalRemaining > 0;

    return (
        <>
            {/* Total quiz time bar */}
            <View style={[styles.totalBar, { backgroundColor: theme.divider }]}>
                <View
                    style={[
                        styles.totalBarFill,
                        {
                            width: (`${totalProgress * 100}%` as `${number}%`),
                            backgroundColor: totalUrgent ? theme.error : theme.primary,
                        },
                    ]}
                />
            </View>

            {/* Header row: quiz title + per-question timer */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.brand, { color: theme.textMuted, fontSize: 11 }]} numberOfLines={1}>
                        {data.quizTitle ?? "Quiz"}
                    </Text>
                </View>
                <View style={[styles.timerPill, { backgroundColor: timerBg }]}>
                    <Ionicons
                        name={timerExpired ? "alert-circle" : "timer-outline"}
                        size={14}
                        color={timerFg}
                    />
                    <Text style={[styles.timerPillText, { color: timerFg }]}>{fmtTime(timeLeft)}</Text>
                </View>
            </View>

            {/* Progress row */}
            <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                    Question {data.current} of {data.total}
                </Text>
                {data.highPoints && (
                    <Text style={[styles.highPointsBadge, { backgroundColor: theme.warningMuted, color: theme.textPrimary }]}>
                        ⭐ HIGH POINTS
                    </Text>
                )}
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.divider }]}>
                <View
                    style={[
                        styles.progressFill,
                        { backgroundColor: theme.primary, width: (`${(data.current / data.total) * 100}%` as `${number}%`) },
                    ]}
                />
            </View>

            {timerExpired && (
                <View style={[styles.timerWarningBox, { backgroundColor: theme.errorMuted }]}>
                    <Ionicons name="alert-circle-outline" size={15} color={theme.error} />
                    <Text style={[styles.timerWarning, { color: theme.error }]}>
                        Time's up for this question — auto-advancing…
                    </Text>
                </View>
            )}

            {/* Question card */}
            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.question, { color: theme.textPrimary }]}>{data.question.text}</Text>

                {!!data.question.imageUrl && (
                    <Image source={{ uri: data.question.imageUrl }} style={styles.image} />
                )}

                {data.question.options.map((option: any, idx: number) => {
                    const isActive = selected === option.id;
                    const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D…
                    return (
                        <Pressable
                            key={option.id}
                            onPress={() => !timerExpired && onSelectOption(option.id)}
                            style={({ pressed }) => [
                                styles.option,
                                {
                                    backgroundColor: isActive ? theme.buttonPrimary : theme.optionDefault,
                                    borderColor: isActive ? theme.buttonPrimary : theme.border,
                                    opacity: timerExpired && !isActive ? 0.45 : pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.optionLetter,
                                    {
                                        backgroundColor: isActive ? "rgba(255,255,255,0.2)" : theme.primaryMuted,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.optionLetterText,
                                        { color: isActive ? theme.textInverse : theme.primary },
                                    ]}
                                >
                                    {optionLetter}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.optionText,
                                    { color: isActive ? theme.textInverse : theme.textPrimary, flex: 1 },
                                ]}
                            >
                                {option.label}
                            </Text>
                            {isActive && (
                                <Ionicons name="checkmark-circle" size={20} color={theme.textInverse} />
                            )}
                        </Pressable>
                    );
                })}
            </View>

            {/* Navigation buttons */}
            <View style={styles.navRow}>
                {onPrev ? (
                    <Pressable
                        onPress={onPrev}
                        style={[styles.prevBtn, { backgroundColor: theme.buttonSecondary, borderColor: theme.border }]}
                    >
                        <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
                        <Text style={[styles.prevBtnText, { color: theme.textPrimary }]}>Previous</Text>
                    </Pressable>
                ) : (
                    <View style={styles.navPlaceholder} />
                )}

                <Pressable
                    disabled={(!selected && !timerExpired) || submitting}
                    onPress={onNext}
                    style={[
                        styles.next,
                        {
                            backgroundColor:
                                (!selected && !timerExpired) || submitting
                                    ? theme.buttonDisabled
                                    : theme.buttonPrimary,
                        },
                    ]}
                >
                    <Text style={[styles.nextText, { color: theme.textInverse }]}>
                        {data.current < data.total
                            ? timerExpired
                                ? "Skip →"
                                : "Next →"
                            : submitting
                            ? "Submitting..."
                            : "Finish Quiz"}
                    </Text>
                    {!submitting && (
                        <Ionicons
                            name={data.current < data.total ? "arrow-forward" : "checkmark-done"}
                            size={18}
                            color={theme.textInverse}
                        />
                    )}
                </Pressable>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    /* Total quiz time bar */
    totalBar: { height: 4, width: "100%", overflow: "hidden" },
    totalBarFill: { height: 4 },

    /* Web layout */
    webLayout: { flex: 1, flexDirection: "column" },
    topInfoBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    topInfoLeft: { flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" },
    topInfoRight: { flexDirection: "row", gap: 6, alignItems: "center" },
    webNavigator: {
        borderBottomWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    webNavigatorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    sidebarCell: {
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    sidebarCellText: { fontSize: 13, fontWeight: "700" },
    mainContent: { flex: 1 },

    /* Mobile bottom bar */
    mobileBottomBar: {
        borderTopWidth: 1,
        paddingTop: 8,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    mobileBottomStats: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },
    navigatorBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    navigatorBtnText: { fontSize: 13, fontWeight: "700" },

    /* Stat chips (shared) */
    statChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statChipText: { fontSize: 11, fontWeight: "700" },

    /* Modal sheet */
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
    },
    modalSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: "70%",
    },
    modalTitle: { fontSize: 14, fontWeight: "800" },
    modalStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 12,
    },
    modalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    modalCell: {
        width: 44,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCellText: { fontSize: 14, fontWeight: "700" },

    /* Header */
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    brand: { fontSize: 16, fontWeight: "800" },
    timerPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    timerPillText: { fontSize: 14, fontWeight: "800" },

    /* Progress */
    progressRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    progressLabel: { fontSize: 13, fontWeight: "700" },
    highPointsBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: "700",
    },
    progressTrack: { height: 10, borderRadius: 10, marginBottom: 14, overflow: "hidden" },
    progressFill: { height: 10, borderRadius: 10 },

    /* Timer warning */
    timerWarningBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
    },
    timerWarning: { fontSize: 13, fontWeight: "600", flex: 1 },

    /* Card */
    card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
    question: { fontSize: 20, lineHeight: 28, fontWeight: "700", marginBottom: 16 },
    image: { width: "100%", height: 200, borderRadius: 16, marginBottom: 12 },

    /* Options */
    option: {
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    optionLetter: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    optionLetterText: { fontSize: 14, fontWeight: "800" },
    optionText: { fontSize: 15, fontWeight: "600" },

    /* Nav row */
    navRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        marginBottom: 8,
    },
    navPlaceholder: { flex: 1 },
    prevBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 14,
    },
    prevBtnText: { fontSize: 15, fontWeight: "700" },
    next: {
        flex: 2,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    nextText: { fontSize: 16, fontWeight: "700" },
});

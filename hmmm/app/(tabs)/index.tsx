import { getAuthUser, isAdmin } from "@/constants/auth-session";
import { fetchQuizHome } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useLoadTimeout } from "@/hook/useLoadTimeout";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Time-based greeting helper
const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { emoji: "🌅", text: "Good morning" };
    if (hour < 18) return { emoji: "☀️", text: "Good afternoon" };
    return { emoji: "🌙", text: "Good evening" };
};

// Difficulty color helper
const getDifficultyColor = (level: string) => {
    switch (level) {
        case "Beginner": return "#10b981"; // green
        case "Intermediate": return "#f59e0b"; // amber
        case "Expert": return "#ef4444"; // red
        default: return "#6b7280"; // gray
    }
};

const isQuizLiveNow = (startsAtIso?: string, durationMinutes?: number) => {
    if (!startsAtIso || !durationMinutes) return false;
    const startsAt = new Date(startsAtIso);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    const now = new Date();
    return startsAt <= now && endsAt >= now;
};

export default function DiscoverScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timedOut, setTimedOut] = useState(false);
    const user = getAuthUser();
    const adminView = isAdmin();

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        setTimedOut(false);
        try {
            const payload = await fetchQuizHome();
            setData(payload);
        } catch (err: any) {
            setError(err?.message || 'Failed to load home data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    useLoadTimeout(loading, () => { setTimedOut(true); setLoading(false); });

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (timedOut || (error && !data)) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={{ fontSize: 15, color: theme.textSecondary, textAlign: 'center', marginBottom: 16 }}>
                    Could not connect — tap to retry.
                </Text>
                <Pressable onPress={load} style={{ backgroundColor: theme.buttonPrimary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
                    <Text style={{ color: theme.textInverse, fontWeight: '700' }}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    const { emoji: timeEmoji, text: timeGreeting } = getTimeBasedGreeting();
    const userDisplayName = user?.rollNumber?.split(/[@._-]/)[0] || "Learner";

    const greetingTitle = `${timeEmoji} ${timeGreeting}, ${userDisplayName}!`;
    const greetingSubtitle = "Continue your learning journey";

    const featuredItems = data?.featuredQuizzes ?? data?.featured ?? [];
    const enrolledItems = data?.continueLearning ?? [];
    const enrolledQuizIds = new Set(enrolledItems.map((item: any) => item.id));
    const liveItems = data?.liveQuizzes ?? [
        ...featuredItems.filter((item: any) => isQuizLiveNow(item?.startsAtIso, item?.durationMinutes)),
        ...enrolledItems.filter((item: any) => isQuizLiveNow(item?.startsAtIso, item?.durationMinutes)),
    ];

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.heading, { color: theme.textPrimary }]}>{greetingTitle}</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>{greetingSubtitle}</Text>
            <Text style={[styles.viewer, { color: theme.textMuted }]}>Signed in as {adminView ? "Admin" : "Learner"} • {user?.rollNumber ?? "Unknown"}</Text>

            {!!error && (
                <View style={[styles.errorBanner, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                    <Text style={{ color: '#b91c1c', fontSize: 13 }}>⚠ {error}</Text>
                </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Live Quizzes</Text>
            {liveItems.map((quiz: any) => {
                const diffColor = getDifficultyColor(quiz.level);
                const isEnrolled = enrolledQuizIds.has(quiz.id);
                return (
                    <View key={`live-${quiz.id}`} style={[
                        styles.featureCard,
                        {
                            backgroundColor: theme.surfaceLight,
                            borderColor: theme.success,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: 8,
                            elevation: 3,
                        }
                    ]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.titleSection}>
                                <Text style={[styles.featureTitle, { color: theme.textPrimary }]}>{quiz.title}</Text>
                                <Text style={[styles.category, { color: theme.textSecondary }]}>{quiz.category}</Text>
                            </View>
                            <View style={[styles.difficultyBadge, { backgroundColor: diffColor }]}>
                                <Text style={styles.difficultyText}>{quiz.level}</Text>
                            </View>
                        </View>

                        <View style={styles.metaContainer}>
                            <View style={styles.metaItem}>
                                <Text style={[styles.metaIcon]}>🔴</Text>
                                <Text style={[styles.metaText, { color: theme.success }]}>Live now</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Text style={[styles.metaIcon]}>⏱</Text>
                                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{quiz.durationMinutes} min</Text>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.enrollBtn, { backgroundColor: theme.buttonPrimary }]}
                            onPress={() =>
                                isEnrolled
                                    ? router.push({ pathname: "/quiz/[id]/lobby", params: { id: quiz.id } } as any)
                                    : router.push(`/quiz/${quiz.id}` as any)
                            }
                        >
                            <Text style={[styles.enrollText, { color: theme.textInverse }]}>
                                {isEnrolled ? "Enter Live Quiz" : "Open Quiz"}
                            </Text>
                        </Pressable>
                    </View>
                );
            })}
            {!liveItems.length && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No live quiz right now</Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Join an upcoming quiz when it starts.</Text>
                </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Enrolled Quizzes</Text>
            {enrolledItems.map((quiz: any) => {
                const diffColor = getDifficultyColor(quiz.level);
                const progress = Math.max(0, Math.min(100, Number(quiz.progress ?? 0)));
                const isLive = isQuizLiveNow(quiz.startsAtIso, quiz.durationMinutes);
                return (
                    <View key={`enrolled-${quiz.id}`} style={[
                        styles.featureCard,
                        {
                            backgroundColor: theme.surfaceLight,
                            borderColor: theme.border,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: 8,
                            elevation: 3,
                        }
                    ]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.titleSection}>
                                <Text style={[styles.featureTitle, { color: theme.textPrimary }]}>{quiz.title}</Text>
                                <Text style={[styles.category, { color: theme.textSecondary }]}>{quiz.category}</Text>
                            </View>
                            {!!quiz.level && (
                                <View style={[styles.difficultyBadge, { backgroundColor: diffColor }]}>
                                    <Text style={styles.difficultyText}>{quiz.level}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.metaContainer}>
                            {quiz.startsAtIso && (
                                <View style={styles.metaItem}>
                                    <Text style={[styles.metaIcon]}>🗓</Text>
                                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                                        {new Date(quiz.startsAtIso).toLocaleString()}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.metaItem}>
                                <Text style={[styles.metaIcon]}>📈</Text>
                                <Text style={[styles.metaText, { color: theme.textSecondary }]}>{progress}% completed</Text>
                            </View>
                        </View>

                        <View style={[styles.progressTrack, { backgroundColor: theme.divider }]}>
                            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
                        </View>

                        <Pressable
                            style={[styles.enrollBtn, { backgroundColor: isLive ? theme.success : theme.buttonPrimary }]}
                            onPress={() => router.push(`/quiz/${quiz.id}` as any)}
                        >
                            <Text style={[styles.enrollText, { color: theme.textInverse }]}>{isLive ? "Open Live Quiz" : "Continue"}</Text>
                        </Pressable>
                    </View>
                );
            })}
            {!enrolledItems.length && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No enrolled quizzes yet</Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Enroll in a quiz to track progress here.</Text>
                </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Upcoming Quizzes</Text>
            {featuredItems.map((quiz: any) => {
                const diffColor = getDifficultyColor(quiz.level);
                return (
                    <View key={quiz.id} style={[
                        styles.featureCard,
                        {
                            backgroundColor: theme.surfaceLight,
                            borderColor: theme.border,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.08,
                            shadowRadius: 8,
                            elevation: 3,
                        }
                    ]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.titleSection}>
                                <Text style={[styles.featureTitle, { color: theme.textPrimary }]}>
                                    {quiz.title}
                                </Text>
                                <Text style={[styles.category, { color: theme.textSecondary }]}>
                                    {quiz.category}
                                </Text>
                            </View>
                            <View style={[styles.difficultyBadge, { backgroundColor: diffColor }]}>
                                <Text style={styles.difficultyText}>{quiz.level}</Text>
                            </View>
                        </View>

                        <View style={styles.metaContainer}>
                            <View style={styles.metaItem}>
                                <Text style={[styles.metaIcon]}>⏱</Text>
                                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                                    {quiz.durationMinutes} min
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            style={[
                                styles.enrollBtn,
                                { backgroundColor: enrolledQuizIds.has(quiz.id) ? theme.success : theme.buttonPrimary },
                            ]}
                            onPress={() =>
                                enrolledQuizIds.has(quiz.id)
                                    ? router.push({ pathname: "/quiz/[id]/lobby", params: { id: quiz.id } } as any)
                                    : router.push(`/quiz/${quiz.id}` as any)
                            }
                        >
                            <Text style={[styles.enrollText, { color: theme.textInverse }]}>
                                {enrolledQuizIds.has(quiz.id) ? "Enter Lobby" : "Enroll Now"}
                            </Text>
                        </Pressable>
                    </View>
                );
            })}
            {!featuredItems.length && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                        {adminView ? "No quizzes created yet" : "No quizzes available"}
                    </Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        {adminView ? "Use the Admin tab to create and publish your first quiz." : "Ask your admin to publish quizzes."}
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    brand: { fontSize: 16, fontWeight: "700" },
    heading: { marginTop: 14, fontSize: 32, lineHeight: 38, fontWeight: "800" },
    subheading: { marginTop: 8, fontSize: 16, lineHeight: 24 },
    viewer: { marginTop: 6, fontSize: 13, fontWeight: "600" },
    sectionTitle: { marginTop: 22, marginBottom: 10, fontSize: 22, fontWeight: "800" },
    featureCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    titleSection: { flex: 1, marginRight: 12 },
    featureTitle: { fontSize: 18, fontWeight: "800" },
    category: { marginTop: 4, fontSize: 13, fontWeight: "500" },
    difficultyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 90, alignItems: "center" },
    difficultyText: { fontSize: 11, fontWeight: "800", color: "#fff", textTransform: "uppercase" },
    metaContainer: { flexDirection: "row", marginTop: 12, gap: 16 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaIcon: { fontSize: 14 },
    metaText: { fontSize: 13, fontWeight: "600" },
    levelChip: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    featureDesc: { marginTop: 6, fontSize: 14, lineHeight: 21 },
    enrollBtn: {
        marginTop: 14,
        alignSelf: "flex-start",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    enrollText: { fontSize: 14, fontWeight: "700" },
    progressTrack: { marginTop: 10, height: 8, borderRadius: 999, overflow: "hidden" },
    progressFill: { height: 8, borderRadius: 999 },
    emptyCard: { borderWidth: 1, borderRadius: 16, padding: 14, width: 280 },
    emptyTitle: { fontSize: 16, fontWeight: "700" },
    emptyText: { marginTop: 6, fontSize: 13, lineHeight: 19 },
    errorBanner: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10, marginBottom: 4 },
    browseCta: { marginTop: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
    browseCtaText: { fontSize: 13, fontWeight: "700" },
});

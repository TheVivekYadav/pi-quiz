import { getAuthUser, isAdmin } from "@/constants/auth-session";
import { fetchQuizHome } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useLoadTimeout } from "@/hook/useLoadTimeout";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

    const greetingTitle = typeof data?.greeting === "string"
        ? data.greeting
        : data?.greeting?.title ?? "Ready for a challenge?";

    const greetingSubtitle = typeof data?.greeting === "string"
        ? "Continue your learning journey"
        : data?.greeting?.subtitle ?? "Continue your learning journey";

    const featuredItems = data?.featuredQuizzes ?? data?.featured ?? [];

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.brand, { color: theme.primary }]}>Pi Quiz</Text>
            <Text style={[styles.heading, { color: theme.textPrimary }]}>{greetingTitle}</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>{greetingSubtitle}</Text>
            <Text style={[styles.viewer, { color: theme.textMuted }]}>Signed in as {adminView ? "Admin" : "Learner"} • {user?.rollNumber ?? "Unknown"}</Text>

            {!!error && (
                <View style={[styles.errorBanner, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
                    <Text style={{ color: '#b91c1c', fontSize: 13 }}>⚠ {error}</Text>
                </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Featured Quizzes</Text>
            {featuredItems.map((quiz: any) => (
                <View key={quiz.id} style={[styles.featureCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.levelChip, { color: theme.primary }]}>{quiz.level}</Text>
                    <Text style={[styles.featureTitle, { color: theme.textPrimary }]}>{quiz.title}</Text>
                    <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>{quiz.description}</Text>
                    <Pressable style={[styles.enrollBtn, { backgroundColor: theme.buttonPrimary }]} onPress={() => router.push(`/quiz/${quiz.id}` as any)}>
                        <Text style={[styles.enrollText, { color: theme.textInverse }]}>Enroll Now</Text>
                    </Pressable>
                </View>
            ))}
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
    heading: { marginTop: 14, fontSize: 38, lineHeight: 42, fontWeight: "800" },
    subheading: { marginTop: 8, fontSize: 16, lineHeight: 24 },
    viewer: { marginTop: 6, fontSize: 13, fontWeight: "600" },
    sectionTitle: { marginTop: 22, marginBottom: 10, fontSize: 30, fontWeight: "800" },
    featureCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
    levelChip: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    featureTitle: { marginTop: 6, fontSize: 25, fontWeight: "800" },
    featureDesc: { marginTop: 6, fontSize: 14, lineHeight: 21 },
    enrollBtn: {
        marginTop: 14,
        alignSelf: "flex-start",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    enrollText: { fontSize: 14, fontWeight: "700" },
    emptyCard: { borderWidth: 1, borderRadius: 16, padding: 14, width: 280 },
    emptyTitle: { fontSize: 16, fontWeight: "700" },
    emptyText: { marginTop: 6, fontSize: 13, lineHeight: 19 },
    errorBanner: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10, marginBottom: 4 },
    browseCta: { marginTop: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
    browseCtaText: { fontSize: 13, fontWeight: "700" },
});

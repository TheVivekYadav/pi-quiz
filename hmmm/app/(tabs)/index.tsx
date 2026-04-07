import { fetchQuizHome } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DiscoverScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const run = async () => {
            try {
                const payload = await fetchQuizHome();
                setData(payload);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, []);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.brand, { color: theme.primary }]}>Intellectual Playground</Text>
            <Text style={[styles.heading, { color: theme.textPrimary }]}>{data?.greeting?.title ?? "Ready for a challenge?"}</Text>
            <Text style={[styles.subheading, { color: theme.textSecondary }]}>{data?.greeting?.subtitle}</Text>

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Continue Learning</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {(data?.continueLearning ?? []).map((item: any) => (
                    <Pressable
                        key={item.id}
                        onPress={() => router.push(`/quiz/${item.id}` as any)}
                        style={[styles.continueCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                    >
                        <Text style={[styles.tag, { color: theme.primary }]}>{item.category}</Text>
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{item.title}</Text>
                        <View style={[styles.progressTrack, { backgroundColor: theme.divider }]}>
                            <View style={[styles.progressFill, { width: `${item.progress ?? 0}%`, backgroundColor: theme.primary }]} />
                        </View>
                    </Pressable>
                ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Explore Categories</Text>
            <View style={styles.grid}>
                {(data?.categories ?? []).map((cat: any) => (
                    <View key={cat.id} style={[styles.gridCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Ionicons name={cat.icon} size={20} color={theme.primary} />
                        <Text style={[styles.gridText, { color: theme.textPrimary }]}>{cat.title}</Text>
                    </View>
                ))}
            </View>

            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Featured Quizzes</Text>
            {(data?.featured ?? []).map((quiz: any) => (
                <View key={quiz.id} style={[styles.featureCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.levelChip, { color: theme.primary }]}>{quiz.level}</Text>
                    <Text style={[styles.featureTitle, { color: theme.textPrimary }]}>{quiz.title}</Text>
                    <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>{quiz.description}</Text>
                    <Pressable style={[styles.enrollBtn, { backgroundColor: theme.buttonPrimary }]} onPress={() => router.push(`/quiz/${quiz.id}` as any)}>
                        <Text style={[styles.enrollText, { color: theme.textInverse }]}>Enroll Now</Text>
                    </Pressable>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    brand: { fontSize: 16, fontWeight: "700" },
    heading: { marginTop: 14, fontSize: 38, lineHeight: 42, fontWeight: "800" },
    subheading: { marginTop: 8, fontSize: 16, lineHeight: 24 },
    sectionTitle: { marginTop: 22, marginBottom: 10, fontSize: 30, fontWeight: "800" },
    continueCard: { width: 250, borderWidth: 1, borderRadius: 18, padding: 14 },
    tag: { fontSize: 11, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" },
    cardTitle: { fontSize: 20, fontWeight: "700" },
    progressTrack: { height: 6, borderRadius: 6, marginTop: 14 },
    progressFill: { height: 6, borderRadius: 6 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    gridCard: {
        width: "48%",
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: "center",
        gap: 8,
    },
    gridText: { fontSize: 13, fontWeight: "600" },
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
});

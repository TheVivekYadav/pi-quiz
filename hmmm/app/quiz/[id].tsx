import { fetchQuizDetail } from "@/constants/quiz-api";
import { clearQuizAnswers } from "@/constants/quiz-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuizDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!quizId) return;

        const run = async () => {
            try {
                const payload = await fetchQuizDetail(quizId);
                setData(payload);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [quizId]);

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
            <Text style={[styles.brand, { color: theme.textPrimary }]}>Intellectual Playground</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{data?.title}</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>{data?.category} • {new Date(data?.startsAtIso).toLocaleString()}</Text>
            <Text style={[styles.desc, { color: theme.textSecondary }]}>{data?.description}</Text>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.primary }]}>What to expect</Text>
                {(data?.expectations ?? []).map((item: string, idx: number) => (
                    <Text key={`${item}-${idx}`} style={[styles.item, { color: theme.textSecondary }]}>• {item}</Text>
                ))}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.accent }]}>Curator’s Note</Text>
                <Text style={[styles.note, { color: theme.textSecondary }]}>{data?.curatorNote}</Text>
            </View>

            <View style={[styles.formCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Secure Your Spot</Text>
                <TextInput placeholder="Full Name" placeholderTextColor={theme.textMuted} style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]} />
                <TextInput placeholder="Email Address" placeholderTextColor={theme.textMuted} style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]} />

                <Pressable
                    style={[styles.primaryBtn, { backgroundColor: theme.buttonPrimary }]}
                    onPress={() => {
                        if (!quizId) return;
                        clearQuizAnswers(quizId);
                        router.push({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any);
                    }}
                >
                    <Text style={[styles.primaryBtnText, { color: theme.textInverse }]}>Enroll Now</Text>
                    <Ionicons name="arrow-forward" size={16} color={theme.textInverse} />
                </Pressable>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    brand: { fontSize: 20, fontWeight: "800" },
    title: { marginTop: 14, fontSize: 54, lineHeight: 56, fontWeight: "800" },
    meta: { marginTop: 10, fontSize: 14 },
    desc: { marginTop: 14, fontSize: 17, lineHeight: 27 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 14 },
    cardTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
    item: { fontSize: 15, lineHeight: 24, marginBottom: 4 },
    note: { fontSize: 16, lineHeight: 24 },
    formCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 16 },
    formTitle: { fontSize: 40, lineHeight: 42, fontWeight: "800", marginBottom: 10 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        marginBottom: 10,
        fontSize: 15,
    },
    primaryBtn: {
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    primaryBtnText: { fontSize: 17, fontWeight: "700" },
});

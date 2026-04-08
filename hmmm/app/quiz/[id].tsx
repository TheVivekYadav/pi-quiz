import { EnrollmentFormField, enrollQuiz, fetchQuizDetail } from "@/constants/quiz-api";
import { clearQuizAnswers } from "@/constants/quiz-session";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView, Share, StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuizDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth(`/quiz/${quizId}`);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState(false);
    const [alreadyCompleted, setAlreadyCompleted] = useState(false);

    // Dynamic form answers keyed by field.id
    const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!quizId) return;
        fetchQuizDetail(quizId)
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [quizId]);

    const enrollmentForm: { formId: string; fields: EnrollmentFormField[] } | null =
        data?.enrollmentForm ?? null;

    const shareQuizUrl = async () => {
        if (!quizId) return;
        const appUrl = `hmmm://quiz/${quizId}/lobby`;
        const webUrl = `https://pit.engineer/quiz/${quizId}/lobby`;
        try {
            await Share.share({ message: `Join quiz:\n\nApp: ${appUrl}\nWeb: ${webUrl}` });
        } catch (err) {
            console.error('Failed to share quiz url', err);
        }
    };

    const handleEnroll = async () => {
        if (!quizId) return;

        // Validate required fields
        if (enrollmentForm) {
            for (const field of enrollmentForm.fields) {
                if (field.required && !formAnswers[field.id]?.trim()) {
                    Alert.alert("Required field", `"${field.label}" is required.`);
                    return;
                }
            }
        }

        setEnrolling(true);
        try {
            await enrollQuiz(quizId, enrollmentForm ? formAnswers : undefined);
            clearQuizAnswers(quizId);
            router.push({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any);
        } catch (error: any) {
            const msg: string = error?.message || '';
            if (msg.toLowerCase().includes('already completed')) {
                setAlreadyCompleted(true);
                Alert.alert("Quiz Completed", "You have already completed this quiz.");
                return;
            }
            Alert.alert("Error", msg || "Failed to enroll. Please try again.");
        } finally {
            setEnrolling(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                style={[styles.root, { backgroundColor: theme.background }]}
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: insets.bottom + 24,
                    paddingHorizontal: 16,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={[styles.brand, { color: theme.textPrimary }]}>Intellectual Playground</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>{data?.title}</Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                    {data?.category} • {new Date(data?.startsAtIso).toLocaleString()}
                </Text>
                <Pressable onPress={shareQuizUrl} style={{ alignSelf: 'flex-start', marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="share-social-outline" size={16} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Share</Text>
                </Pressable>
                <Text style={[styles.desc, { color: theme.textSecondary }]}>{data?.description}</Text>

                {(data?.expectations ?? []).length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.cardTitle, { color: theme.primary }]}>What to expect</Text>
                        {(data.expectations ?? []).map((item: string, idx: number) => (
                            <Text key={`${item}-${idx}`} style={[styles.item, { color: theme.textSecondary }]}>
                                • {item}
                            </Text>
                        ))}
                    </View>
                )}

                {!!data?.curatorNote && (
                    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.cardTitle, { color: theme.accent }]}>Curator's Note</Text>
                        <Text style={[styles.note, { color: theme.textSecondary }]}>{data.curatorNote}</Text>
                    </View>
                )}

                {/* Enrollment section */}
                {alreadyCompleted ? (
                    <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.formTitle, { color: theme.primary }]}>Quiz Completed ✓</Text>
                        <Text style={[{ color: theme.textSecondary, fontSize: 15, lineHeight: 22 }]}>
                            You have already completed this quiz. Check the winners board!
                        </Text>
                        <Pressable
                            style={[styles.primaryBtn, { backgroundColor: theme.buttonPrimary, marginTop: 14 }]}
                            onPress={() => router.push({ pathname: "/quiz/[id]/winners", params: { id: quizId } } as any)}
                        >
                            <Text style={[styles.primaryBtnText, { color: theme.textInverse }]}>See Winners</Text>
                            <Ionicons name="trophy-outline" size={16} color={theme.textInverse} />
                        </Pressable>
                    </View>
                ) : (
                <View style={[styles.formCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Text style={[styles.formTitle, { color: theme.textPrimary }]}>Secure Your Spot</Text>

                    {/* Dynamic enrollment form fields */}
                    {enrollmentForm && enrollmentForm.fields.length > 0 && (
                        <View style={styles.enrollFields}>
                            <Text style={[styles.enrollFormNote, { color: theme.textSecondary }]}>
                                Please fill in the details below to complete your enrollment.
                            </Text>

                            {enrollmentForm.fields.map((field) => (
                                <View key={field.id} style={styles.fieldGroup}>
                                    <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
                                        {field.label}
                                        {field.required && <Text style={{ color: theme.error }}> *</Text>}
                                    </Text>

                                    {field.type === "select" ? (
                                        /* Render select options as pressable chips */
                                        <View style={styles.selectRow}>
                                            {(field.options ?? []).map((opt) => {
                                                const isSelected = formAnswers[field.id] === opt;
                                                return (
                                                    <Pressable
                                                        key={opt}
                                                        onPress={() =>
                                                            setFormAnswers((prev) => ({ ...prev, [field.id]: opt }))
                                                        }
                                                        style={[
                                                            styles.selectChip,
                                                            {
                                                                backgroundColor: isSelected ? theme.buttonPrimary : theme.surface,
                                                                borderColor: isSelected ? theme.buttonPrimary : theme.border,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.selectChipText,
                                                                { color: isSelected ? theme.textInverse : theme.textPrimary },
                                                            ]}
                                                        >
                                                            {opt}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <TextInput
                                            style={[
                                                styles.fieldInput,
                                                { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background },
                                            ]}
                                            placeholder={
                                                field.type === "email"
                                                    ? "you@example.com"
                                                    : field.type === "phone"
                                                        ? "+91 98765 43210"
                                                        : field.type === "number"
                                                            ? "0"
                                                            : field.label
                                            }
                                            placeholderTextColor={theme.textMuted}
                                            value={formAnswers[field.id] ?? ""}
                                            onChangeText={(t) =>
                                                setFormAnswers((prev) => ({ ...prev, [field.id]: t }))
                                            }
                                            keyboardType={
                                                field.type === "email"
                                                    ? "email-address"
                                                    : field.type === "phone"
                                                        ? "phone-pad"
                                                        : field.type === "number"
                                                            ? "numeric"
                                                            : "default"
                                            }
                                            autoCapitalize={field.type === "email" ? "none" : "sentences"}
                                        />
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    <Pressable
                        style={[styles.primaryBtn, { backgroundColor: theme.buttonPrimary }, enrolling && styles.buttonDisabled]}
                        onPress={handleEnroll}
                        disabled={enrolling}
                    >
                        {enrolling ? (
                            <ActivityIndicator color={theme.textInverse} />
                        ) : (
                            <>
                                <Text style={[styles.primaryBtnText, { color: theme.textInverse }]}>
                                    {data?.startsAtIso && new Date(data.startsAtIso) < new Date() ? "Join Now" : "Enroll Now"}
                                </Text>
                                <Ionicons name="arrow-forward" size={16} color={theme.textInverse} />
                            </>
                        )}
                    </Pressable>
                </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
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
    enrollFields: { marginBottom: 12 },
    enrollFormNote: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    fieldGroup: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
    fieldInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
    },
    selectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    selectChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1 },
    selectChipText: { fontSize: 14, fontWeight: "600" },
    primaryBtn: {
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    primaryBtnText: { fontSize: 17, fontWeight: "700" },
});

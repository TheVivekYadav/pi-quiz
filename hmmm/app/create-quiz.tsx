/**
 * Admin Quiz Creator
 * Two-step flow:
 *   1. Fill quiz metadata (title, topic, category, level, duration, start time)
 *   2. Add questions one by one (text, 4 options, mark correct answer)
 */
import { adminAddQuestion, adminCreateQuiz } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Step = "meta" | "questions" | "done";

type Option = { id: string; label: string };

type Question = {
    tempId: string;
    text: string;
    options: Option[];
    correctOptionId: string;
    points: string;
};

const LEVELS = ["Beginner", "Intermediate", "Expert"];

function makeOptionId(qIdx: number, oIdx: number) {
    return `q${qIdx}_o${oIdx}`;
}

function emptyQuestion(idx: number): Question {
    return {
        tempId: String(Date.now()) + idx,
        text: "",
        options: [
            { id: makeOptionId(idx, 0), label: "" },
            { id: makeOptionId(idx, 1), label: "" },
            { id: makeOptionId(idx, 2), label: "" },
            { id: makeOptionId(idx, 3), label: "" },
        ],
        correctOptionId: makeOptionId(idx, 0),
        points: "1",
    };
}

export default function CreateQuizScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [step, setStep] = useState<Step>("meta");

    // Step 1 fields
    const [title, setTitle] = useState("");
    const [topic, setTopic] = useState("");
    const [category, setCategory] = useState("");
    const [level, setLevel] = useState("Beginner");
    const [duration, setDuration] = useState("30");
    const [startsAt, setStartsAt] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0);
        return d.toISOString().slice(0, 16);
    });
    const [description, setDescription] = useState("");
    const [curatorNote, setCuratorNote] = useState("");

    // Step 2 fields
    const [quizId, setQuizId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([emptyQuestion(0)]);
    const [saving, setSaving] = useState(false);

    const handleCreateQuiz = async () => {
        if (!title.trim() || !topic.trim() || !category.trim()) {
            Alert.alert("Missing fields", "Title, Topic and Category are required.");
            return;
        }
        const dur = parseInt(duration);
        if (isNaN(dur) || dur < 1) {
            Alert.alert("Invalid duration", "Duration must be a positive number.");
            return;
        }
        const startDate = new Date(startsAt);
        if (isNaN(startDate.getTime())) {
            Alert.alert("Invalid date", "Please enter a valid start date/time (YYYY-MM-DDTHH:MM).");
            return;
        }

        setSaving(true);
        try {
            const quiz = await adminCreateQuiz({
                title: title.trim(),
                topic: topic.trim(),
                category: category.trim(),
                level,
                durationMinutes: dur,
                startsAt: startDate.toISOString(),
                description: description.trim() || undefined,
                curatorNote: curatorNote.trim() || undefined,
            });
            setQuizId(quiz.id);
            setStep("questions");
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to create quiz.");
        } finally {
            setSaving(false);
        }
    };

    const updateQuestion = (idx: number, patch: Partial<Question>) => {
        setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
    };

    const updateOption = (qIdx: number, oIdx: number, label: string) => {
        setQuestions((prev) =>
            prev.map((q, i) => {
                if (i !== qIdx) return q;
                const options = q.options.map((o, oi) => (oi === oIdx ? { ...o, label } : o));
                return { ...q, options };
            })
        );
    };

    const addQuestion = () => {
        setQuestions((prev) => [...prev, emptyQuestion(prev.length)]);
    };

    const removeQuestion = (idx: number) => {
        if (questions.length === 1) return;
        setQuestions((prev) => prev.filter((_, i) => i !== idx));
    };

    const handlePublish = async () => {
        if (!quizId) return;

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) {
                Alert.alert("Missing text", `Question ${i + 1} has no text.`);
                return;
            }
            const filledOptions = q.options.filter((o) => o.label.trim());
            if (filledOptions.length < 2) {
                Alert.alert("Insufficient options", `Question ${i + 1} needs at least 2 filled options.`);
                return;
            }
            const correctFilled = filledOptions.find((o) => o.id === q.correctOptionId);
            if (!correctFilled) {
                Alert.alert("No correct answer", `Question ${i + 1}: the marked correct option is empty.`);
                return;
            }
        }

        setSaving(true);
        try {
            for (const q of questions) {
                const filledOptions = q.options.filter((o) => o.label.trim());
                await adminAddQuestion(quizId, {
                    text: q.text.trim(),
                    options: filledOptions,
                    correctOptionId: q.correctOptionId,
                    points: parseInt(q.points) || 1,
                });
            }
            setStep("done");
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to save questions.");
        } finally {
            setSaving(false);
        }
    };

    if (step === "done") {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Ionicons name="checkmark-circle" size={64} color={theme.success} />
                <Text style={[styles.doneTitle, { color: theme.textPrimary }]}>Quiz Published!</Text>
                <Text style={[styles.doneSub, { color: theme.textSecondary }]}>
                    {questions.length} question{questions.length !== 1 ? "s" : ""} added successfully.
                </Text>
                <Pressable
                    style={[styles.btn, { backgroundColor: theme.buttonPrimary, marginTop: 24 }]}
                    onPress={() => router.replace("/(tabs)" as any)}
                >
                    <Text style={[styles.btnText, { color: theme.textInverse }]}>Back to Dashboard</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        >
            <Pressable onPress={() => router.back()} style={styles.backRow}>
                <Ionicons name="arrow-back" size={20} color={theme.primary} />
                <Text style={[styles.backText, { color: theme.primary }]}>Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>
                {step === "meta" ? "STEP 1 OF 2" : "STEP 2 OF 2"}
            </Text>
            <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>
                {step === "meta" ? "Quiz Details" : "Add Questions"}
            </Text>
            <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
                {step === "meta"
                    ? "Set the quiz metadata, then add your questions."
                    : `Quiz created! Now add questions for "${title}".`}
            </Text>

            {step === "meta" && (
                <View style={styles.form}>
                    <Field label="Title *" value={title} onChangeText={setTitle} placeholder="e.g., Science Quiz 2024" theme={theme} />
                    <Field label="Topic *" value={topic} onChangeText={setTopic} placeholder="e.g., Physics" theme={theme} />
                    <Field label="Category *" value={category} onChangeText={setCategory} placeholder="e.g., Science" theme={theme} />

                    <Text style={[styles.label, { color: theme.textSecondary }]}>Level</Text>
                    <View style={styles.levelRow}>
                        {LEVELS.map((l) => (
                            <Pressable
                                key={l}
                                onPress={() => setLevel(l)}
                                style={[
                                    styles.levelChip,
                                    {
                                        backgroundColor: level === l ? theme.buttonPrimary : theme.surface,
                                        borderColor: level === l ? theme.buttonPrimary : theme.border,
                                    },
                                ]}
                            >
                                <Text style={[styles.levelChipText, { color: level === l ? theme.textInverse : theme.textPrimary }]}>{l}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Field label="Duration (minutes) *" value={duration} onChangeText={setDuration} placeholder="30" keyboardType="numeric" theme={theme} />
                    <Field
                        label="Start Date/Time * (YYYY-MM-DDTHH:MM)"
                        value={startsAt}
                        onChangeText={setStartsAt}
                        placeholder="2024-06-01T10:00"
                        theme={theme}
                    />
                    <Field label="Description" value={description} onChangeText={setDescription} placeholder="Brief overview..." multiline theme={theme} />
                    <Field label="Curator Note" value={curatorNote} onChangeText={setCuratorNote} placeholder="A personal note for participants..." multiline theme={theme} />

                    <Pressable
                        style={[styles.btn, { backgroundColor: saving ? theme.buttonDisabled : theme.buttonPrimary }]}
                        onPress={handleCreateQuiz}
                        disabled={saving}
                    >
                        <Text style={[styles.btnText, { color: theme.textInverse }]}>{saving ? "Creating..." : "Next: Add Questions"}</Text>
                        <Ionicons name="arrow-forward" size={18} color={theme.textInverse} />
                    </Pressable>
                </View>
            )}

            {step === "questions" && (
                <View style={styles.form}>
                    {questions.map((q, qIdx) => (
                        <View key={q.tempId} style={[styles.qCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                            <View style={styles.qHeader}>
                                <Text style={[styles.qNum, { color: theme.primary }]}>Q{qIdx + 1}</Text>
                                {questions.length > 1 && (
                                    <Pressable onPress={() => removeQuestion(qIdx)}>
                                        <Ionicons name="trash-outline" size={18} color={theme.error} />
                                    </Pressable>
                                )}
                            </View>

                            <TextInput
                                style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                                placeholder="Question text"
                                placeholderTextColor={theme.textMuted}
                                value={q.text}
                                onChangeText={(t) => updateQuestion(qIdx, { text: t })}
                                multiline
                            />

                            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>Options (tap circle to mark correct)</Text>
                            {q.options.map((opt, oIdx) => (
                                <View key={opt.id} style={styles.optionRow}>
                                    <Pressable
                                        onPress={() => updateQuestion(qIdx, { correctOptionId: opt.id })}
                                        style={[
                                            styles.correctBtn,
                                            {
                                                backgroundColor: q.correctOptionId === opt.id ? theme.success : "transparent",
                                                borderColor: q.correctOptionId === opt.id ? theme.success : theme.border,
                                            },
                                        ]}
                                    >
                                        {q.correctOptionId === opt.id && <Ionicons name="checkmark" size={12} color={theme.textInverse} />}
                                    </Pressable>
                                    <TextInput
                                        style={[styles.optionInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                                        placeholder={`Option ${oIdx + 1}`}
                                        placeholderTextColor={theme.textMuted}
                                        value={opt.label}
                                        onChangeText={(t) => updateOption(qIdx, oIdx, t)}
                                    />
                                </View>
                            ))}

                            <View style={styles.pointsRow}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>Points:</Text>
                                <TextInput
                                    style={[styles.pointsInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                                    value={q.points}
                                    onChangeText={(t) => updateQuestion(qIdx, { points: t })}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    ))}

                    <Pressable style={[styles.addBtn, { borderColor: theme.primary }]} onPress={addQuestion}>
                        <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                        <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Another Question</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.btn, { backgroundColor: saving ? theme.buttonDisabled : theme.buttonPrimary, marginTop: 16 }]}
                        onPress={handlePublish}
                        disabled={saving}
                    >
                        <Ionicons name="rocket-outline" size={18} color={theme.textInverse} />
                        <Text style={[styles.btnText, { color: theme.textInverse }]}>{saving ? "Publishing..." : "Publish Quiz"}</Text>
                    </Pressable>
                </View>
            )}
        </ScrollView>
    );
}

function Field({
    label, value, onChangeText, placeholder, multiline, keyboardType, theme,
}: {
    label: string;
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
    multiline?: boolean;
    keyboardType?: any;
    theme: any;
}) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
            <TextInput
                style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface },
                    multiline && { height: 80, textAlignVertical: "top" },
                ]}
                placeholder={placeholder}
                placeholderTextColor={theme.textMuted}
                value={value}
                onChangeText={onChangeText}
                multiline={multiline}
                keyboardType={keyboardType}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
    backText: { fontSize: 14, fontWeight: "600" },
    eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: "700" },
    pageTitle: { marginTop: 6, fontSize: 32, fontWeight: "800" },
    pageSub: { marginTop: 6, fontSize: 14, lineHeight: 20, marginBottom: 16 },
    form: { gap: 4 },
    fieldGroup: { marginBottom: 12 },
    label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
    },
    levelRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    levelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
    levelChipText: { fontSize: 13, fontWeight: "700" },
    btn: {
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        marginTop: 8,
    },
    btnText: { fontSize: 16, fontWeight: "700" },
    qCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
    qHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    qNum: { fontSize: 18, fontWeight: "800" },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    correctBtn: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    optionInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14,
    },
    pointsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
    pointsInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        width: 60,
        textAlign: "center",
    },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 14,
        paddingVertical: 13,
        marginTop: 4,
    },
    addBtnText: { fontSize: 15, fontWeight: "700" },
    doneTitle: { marginTop: 16, fontSize: 30, fontWeight: "800", textAlign: "center" },
    doneSub: { marginTop: 8, fontSize: 15, textAlign: "center", lineHeight: 22 },
});

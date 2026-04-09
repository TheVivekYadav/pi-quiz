/**
 * Admin — Manage Questions for an existing quiz.
 * Allows viewing, deleting and adding new questions after the quiz has been created.
 */
import { adminAddQuestion, adminDeleteQuestion, adminListQuestions } from "@/constants/quiz-api";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ExistingQuestion = {
    id: string;
    text: string;
    imageUrl?: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
    points: number;
    questionIndex: number;
};

type NewQuestion = {
    tempId: string;
    text: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
    points: string;
};

function makeOptionId(qIdx: number, oIdx: number) {
    return `nq${qIdx}_o${oIdx}`;
}

function emptyNewQuestion(idx: number): NewQuestion {
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

export default function ManageQuestionsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [existing, setExisting] = useState<ExistingQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [newQuestions, setNewQuestions] = useState<NewQuestion[]>([]);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const load = async () => {
        if (!quizId) return;
        setLoading(true);
        try {
            const qs = await adminListQuestions(quizId);
            setExisting(qs);
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to load questions.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [quizId]);

    const handleDelete = (questionId: string) => {
        if (Platform.OS === 'web') {
            setConfirmDeleteId(questionId);
        } else {
            Alert.alert("Delete Question", "Remove this question? This cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => doDelete(questionId) },
            ]);
        }
    };

    const doDelete = async (questionId: string) => {
        setConfirmDeleteId(null);
        setDeletingId(questionId);
        try {
            await adminDeleteQuestion(quizId!, questionId);
            setExisting(prev => prev.filter(q => q.id !== questionId));
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to delete question.");
        } finally {
            setDeletingId(null);
        }
    };

    const addNewQuestion = () => {
        setNewQuestions(prev => [...prev, emptyNewQuestion(prev.length)]);
    };

    const updateNew = (idx: number, patch: Partial<NewQuestion>) => {
        setNewQuestions(prev => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
    };

    const updateNewOption = (qIdx: number, oIdx: number, label: string) => {
        setNewQuestions(prev =>
            prev.map((q, i) => {
                if (i !== qIdx) return q;
                const options = q.options.map((o, oi) => (oi === oIdx ? { ...o, label } : o));
                return { ...q, options };
            })
        );
    };

    const removeNew = (idx: number) => {
        setNewQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSaveNew = async () => {
        if (!quizId || newQuestions.length === 0) return;

        for (let i = 0; i < newQuestions.length; i++) {
            const q = newQuestions[i];
            if (!q.text.trim()) {
                Alert.alert("Missing text", `New question ${i + 1} has no text.`);
                return;
            }
            const filled = q.options.filter(o => o.label.trim());
            if (filled.length < 2) {
                Alert.alert("Insufficient options", `New question ${i + 1} needs at least 2 filled options.`);
                return;
            }
            if (!filled.find(o => o.id === q.correctOptionId)) {
                Alert.alert("No correct answer", `New question ${i + 1}: the marked correct option is empty.`);
                return;
            }
        }

        setSaving(true);
        try {
            for (const q of newQuestions) {
                const filled = q.options.filter(o => o.label.trim());
                await adminAddQuestion(quizId, {
                    text: q.text.trim(),
                    options: filled,
                    correctOptionId: q.correctOptionId,
                    points: parseInt(q.points) || 1,
                });
            }
            setNewQuestions([]);
            await load();
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to save questions.");
        } finally {
            setSaving(false);
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
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        >
            <Pressable onPress={() => router.back()} style={styles.back}>
                <Ionicons name="arrow-back" size={20} color={theme.primary} />
                <Text style={[styles.backText, { color: theme.primary }]}>Back</Text>
            </Pressable>

            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN • MANAGE QUESTIONS</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Questions</Text>
            <Text style={[styles.sub, { color: theme.textSecondary }]}>
                {existing.length} existing question{existing.length !== 1 ? "s" : ""}
            </Text>

            {/* Existing questions */}
            {existing.map((q) => (
                <View key={q.id} style={[styles.qCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <View style={styles.qHeader}>
                        <Text style={[styles.qNum, { color: theme.primary }]}>Q{q.questionIndex}</Text>
                        <Text style={[styles.qPoints, { color: theme.textMuted }]}>{q.points} pt{q.points !== 1 ? "s" : ""}</Text>

                        {confirmDeleteId === q.id ? (
                            <View style={styles.inlineConfirm}>
                                <Pressable
                                    onPress={() => doDelete(q.id)}
                                    style={[styles.confirmYes, { backgroundColor: theme.error }]}
                                >
                                    <Text style={[styles.confirmYesText, { color: theme.textInverse }]}>Delete</Text>
                                </Pressable>
                                <Pressable onPress={() => setConfirmDeleteId(null)}>
                                    <Text style={[styles.confirmNo, { color: theme.textSecondary }]}>Cancel</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => handleDelete(q.id)}
                                disabled={deletingId === q.id}
                                style={{ opacity: deletingId === q.id ? 0.4 : 1 }}
                            >
                                {deletingId === q.id
                                    ? <ActivityIndicator size="small" color={theme.error} />
                                    : <Ionicons name="trash-outline" size={18} color={theme.error} />
                                }
                            </Pressable>
                        )}
                    </View>

                    <Text style={[styles.qText, { color: theme.textPrimary }]}>{q.text}</Text>

                    {q.options.map((opt) => (
                        <View
                            key={opt.id}
                            style={[
                                styles.optRow,
                                {
                                    backgroundColor: opt.id === q.correctOptionId ? `${theme.success}22` : theme.surface,
                                    borderColor: opt.id === q.correctOptionId ? theme.success : theme.border,
                                },
                            ]}
                        >
                            {opt.id === q.correctOptionId && (
                                <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                            )}
                            <Text style={[styles.optText, { color: theme.textPrimary }]}>{opt.label}</Text>
                        </View>
                    ))}
                </View>
            ))}

            {existing.length === 0 && newQuestions.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                        No questions yet. Add some below!
                    </Text>
                </View>
            )}

            {/* New questions to add */}
            {newQuestions.length > 0 && (
                <Text style={[styles.newSection, { color: theme.primary }]}>— New Questions —</Text>
            )}

            {newQuestions.map((q, qIdx) => (
                <View key={q.tempId} style={[styles.qCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
                    <View style={styles.qHeader}>
                        <Text style={[styles.qNum, { color: theme.primary }]}>New {qIdx + 1}</Text>
                        <Pressable onPress={() => removeNew(qIdx)}>
                            <Ionicons name="trash-outline" size={18} color={theme.error} />
                        </Pressable>
                    </View>

                    <TextInput
                        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surfaceLight }]}
                        placeholder="Question text"
                        placeholderTextColor={theme.textMuted}
                        value={q.text}
                        onChangeText={(t) => updateNew(qIdx, { text: t })}
                        multiline
                    />

                    <Text style={[styles.optLabel, { color: theme.textSecondary }]}>Options — tap circle to mark correct</Text>
                    {q.options.map((opt, oIdx) => (
                        <View key={opt.id} style={styles.optionInputRow}>
                            <Pressable
                                onPress={() => updateNew(qIdx, { correctOptionId: opt.id })}
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
                                style={[styles.optionInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surfaceLight }]}
                                placeholder={`Option ${oIdx + 1}`}
                                placeholderTextColor={theme.textMuted}
                                value={opt.label}
                                onChangeText={(t) => updateNewOption(qIdx, oIdx, t)}
                            />
                        </View>
                    ))}

                    <View style={styles.pointsRow}>
                        <Text style={[styles.optLabel, { color: theme.textSecondary }]}>Points:</Text>
                        <TextInput
                            style={[styles.pointsInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surfaceLight }]}
                            value={q.points}
                            onChangeText={(t) => updateNew(qIdx, { points: t })}
                            keyboardType="numeric"
                        />
                    </View>
                </View>
            ))}

            <Pressable
                style={[styles.addBtn, { borderColor: theme.primary }]}
                onPress={addNewQuestion}
            >
                <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.addBtnText, { color: theme.primary }]}>Add New Question</Text>
            </Pressable>

            {newQuestions.length > 0 && (
                <Pressable
                    style={[styles.saveBtn, { backgroundColor: saving ? theme.buttonDisabled : theme.buttonPrimary }]}
                    onPress={handleSaveNew}
                    disabled={saving}
                >
                    <Ionicons name="checkmark-circle-outline" size={18} color={theme.textInverse} />
                    <Text style={[styles.saveBtnText, { color: theme.textInverse }]}>
                        {saving ? "Saving..." : `Save ${newQuestions.length} Question${newQuestions.length !== 1 ? "s" : ""}`}
                    </Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
    backText: { fontSize: 14, fontWeight: "600" },
    eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 6, fontSize: 32, fontWeight: "800" },
    sub: { marginTop: 4, fontSize: 14, marginBottom: 16 },
    emptyCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 16 },
    emptyText: { fontSize: 15 },
    newSection: { fontSize: 14, fontWeight: "700", letterSpacing: 1, textAlign: "center", marginVertical: 10 },
    qCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    qHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    qNum: { fontSize: 16, fontWeight: "800" },
    qPoints: { fontSize: 12, fontWeight: "600" },
    qText: { fontSize: 15, fontWeight: "600", lineHeight: 22, marginBottom: 8 },
    optRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        marginBottom: 4,
    },
    optText: { fontSize: 14 },
    inlineConfirm: { flexDirection: "row", alignItems: "center", gap: 8 },
    confirmYes: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    confirmYesText: { fontSize: 12, fontWeight: "700" },
    confirmNo: { fontSize: 12, fontWeight: "600" },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
    optLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
    optionInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    correctBtn: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    optionInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
    pointsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    pointsInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, width: 60, textAlign: "center" },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderStyle: "dashed", borderRadius: 14, paddingVertical: 13, marginTop: 4 },
    addBtnText: { fontSize: 15, fontWeight: "700" },
    saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 12 },
    saveBtnText: { fontSize: 16, fontWeight: "700" },
});

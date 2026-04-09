import { adminUpdateQuizMetadata, fetchQuizDetail } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function EditQuizScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const quizId = Array.isArray(id) ? id[0] : id;

    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [level, setLevel] = useState("Beginner");
    const [durationMinutes, setDurationMinutes] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (quizId) {
                const data = await fetchQuizDetail(quizId);
                setQuiz(data);
                setTitle(data.title || "");
                setDescription(data.description || "");
                setCategory(data.category || "");
                // Level is not in QuizDetail, default to Beginner
                setLevel("Beginner");
                setDurationMinutes(String(data.durationMinutes || ""));
            }
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to load quiz");
            router.back();
        } finally {
            setLoading(false);
        }
    }, [quizId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSave = async () => {
        if (!title.trim() || !description.trim() || !category.trim() || !durationMinutes.trim()) {
            Alert.alert("Validation", "All fields are required");
            return;
        }

        const duration = parseInt(durationMinutes, 10);
        if (isNaN(duration) || duration < 1 || duration > 1440) {
            Alert.alert("Validation", "Duration must be between 1 and 1440 minutes");
            return;
        }

        setSaving(true);
        try {
            await adminUpdateQuizMetadata(quizId!, {
                title: title.trim(),
                description: description.trim(),
                category: category.trim(),
                level: level as any,
                durationMinutes: duration,
            });
            Alert.alert("Success", "Quiz updated successfully", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to update quiz");
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
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
                </Pressable>
                <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Edit Quiz</Text>
            </View>

            <View style={styles.formSection}>
                <Text style={[styles.label, { color: theme.textPrimary }]}>Title *</Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                        },
                    ]}
                    placeholder="Quiz title"
                    placeholderTextColor={theme.textMuted}
                    value={title}
                    onChangeText={setTitle}
                    editable={!saving}
                />

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 14 }]}>Description *</Text>
                <TextInput
                    style={[
                        styles.inputMultiline,
                        {
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                        },
                    ]}
                    placeholder="Quiz description"
                    placeholderTextColor={theme.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    editable={!saving}
                />

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 14 }]}>Category *</Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                        },
                    ]}
                    placeholder="e.g., Computer Science, Data Science"
                    placeholderTextColor={theme.textMuted}
                    value={category}
                    onChangeText={setCategory}
                    editable={!saving}
                />

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 14 }]}>Difficulty Level *</Text>
                <View style={styles.levelButtonGroup}>
                    {(["Beginner", "Intermediate", "Expert"] as const).map((lv) => (
                        <Pressable
                            key={lv}
                            onPress={() => setLevel(lv)}
                            disabled={saving}
                            style={[
                                styles.levelButton,
                                {
                                    backgroundColor: level === lv ? theme.primary : theme.surface,
                                    borderColor: theme.border,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.levelButtonText,
                                    { color: level === lv ? theme.textInverse : theme.textPrimary },
                                ]}
                            >
                                {lv}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 14 }]}>Duration (minutes) *</Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                        },
                    ]}
                    placeholder="e.g., 60"
                    placeholderTextColor={theme.textMuted}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="number-pad"
                    editable={!saving}
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                    1–1440 minutes (1 day max)
                </Text>
            </View>

            <View style={styles.actionButtons}>
                <Pressable
                    style={[styles.cancelBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => router.back()}
                    disabled={saving}
                >
                    <Text style={[styles.cancelBtnText, { color: theme.textPrimary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                    style={[styles.saveBtn, { backgroundColor: saving ? theme.textMuted : theme.primary }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={[styles.saveBtnText, { color: theme.textInverse }]}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: { marginBottom: 24 },
    backButton: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
    pageTitle: { fontSize: 28, fontWeight: "800" },
    formSection: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
    },
    inputMultiline: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        minHeight: 100,
        textAlignVertical: "top",
    },
    levelButtonGroup: {
        flexDirection: "row",
        gap: 8,
        flexWrap: "wrap",
    },
    levelButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flex: 1,
        minWidth: 100,
        alignItems: "center",
    },
    levelButtonText: {
        fontSize: 13,
        fontWeight: "700",
    },
    helperText: { fontSize: 12, marginTop: 6, fontStyle: "italic" },
    actionButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    cancelBtnText: { fontSize: 14, fontWeight: "700" },
    saveBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    saveBtnText: { fontSize: 14, fontWeight: "700" },
});

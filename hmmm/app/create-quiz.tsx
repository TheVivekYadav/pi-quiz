/**
 * Admin Quiz Creator — 3-step flow
 *  Step 1: Quiz metadata (title, topic, category, level, duration, start time)
 *  Step 2: Questions (text, options, correct answer, points)
 *  Step 3: Enrollment form (custom fields — label, type, required; or skip)
 */
import { adminAddQuestion, adminCreateQuiz, adminSetEnrollmentForm, EnrollmentFormField, uploadQuizBannerImage } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Step = "meta" | "enrollform" | "questions" | "done";

type Option = { id: string; label: string };

type Question = {
    tempId: string;
    text: string;
    options: Option[];
    correctOptionId: string;
    points: string;
};

const LEVELS = ["Beginner", "Intermediate", "Expert"];
const FIELD_TYPES: Array<{ value: EnrollmentFormField["type"]; label: string }> = [
    { value: "text", label: "Text" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "number", label: "Number" },
    { value: "select", label: "Dropdown" },
];

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

function emptyField(idx: number): EnrollmentFormField & { tempId: string; selectOptionsText: string } {
    return {
        tempId: String(Date.now()) + idx,
        id: `field_${Date.now()}_${idx}`,
        label: "",
        type: "text",
        required: true,
        options: [],
        selectOptionsText: "",
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
        // Use local date components so that `new Date(startsAt)` on submit
        // interprets the string as local time — not UTC.
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    const [description, setDescription] = useState("");
    const [curatorNote, setCuratorNote] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [bannerUploading, setBannerUploading] = useState(false);

    // Step 2 fields
    const [quizId, setQuizId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([emptyQuestion(0)]);

    // Step 3 fields
    type FormField = EnrollmentFormField & { tempId: string; selectOptionsText: string };
    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [saving, setSaving] = useState(false);

    // ── Step 1: Create quiz metadata ────────────────────────────────────────

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
                imageUrl: imageUrl.trim() || undefined,
            });
            setQuizId(quiz.id);
            setStep("enrollform");
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to create quiz.");
        } finally {
            setSaving(false);
        }
    };

    const handlePickBannerImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Permission needed", "Please allow photo library access to upload a banner image.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            allowsEditing: true,
            aspect: [16, 9],
        });

        if (result.canceled || !result.assets?.length) return;

        const asset = result.assets[0];
        setBannerPreview(asset.uri);
        setBannerUploading(true);
        try {
            const uploaded = await uploadQuizBannerImage({
                uri: asset.uri,
                name: asset.fileName ?? `banner-${Date.now()}.jpg`,
                type: asset.mimeType ?? "image/jpeg",
                webFile: Platform.OS === 'web' ? (asset as any).file : undefined,
            });
            setImageUrl(uploaded.url);
            setBannerPreview(uploaded.url);
        } catch (err: any) {
            setBannerPreview(null);
            Alert.alert("Upload failed", err?.message || "Could not upload banner image.");
        } finally {
            setBannerUploading(false);
        }
    };

    // ── Step 2: Add questions ───────────────────────────────────────────────

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

    const handleSaveQuestions = async () => {
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

    // ── Step 2: Enrollment form ─────────────────────────────────────────────

    const addField = () => {
        setFormFields((prev) => [...prev, emptyField(prev.length)]);
    };

    const removeField = (idx: number) => {
        setFormFields((prev) => prev.filter((_, i) => i !== idx));
    };

    const updateField = (idx: number, patch: Partial<FormField>) => {
        setFormFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    };

    const handleSkipForm = () => {
        setStep("questions");
    };

    const handleSaveForm = async () => {
        if (!quizId) return;

        if (formFields.length === 0) {
            setStep("done");
            return;
        }

        for (let i = 0; i < formFields.length; i++) {
            const f = formFields[i];
            if (!f.label.trim()) {
                Alert.alert("Missing label", `Field ${i + 1} has no label.`);
                return;
            }
            if (f.type === "select") {
                const opts = f.selectOptionsText.split(",").map((s) => s.trim()).filter(Boolean);
                if (opts.length < 2) {
                    Alert.alert("Insufficient options", `Dropdown field "${f.label}" needs at least 2 comma-separated options.`);
                    return;
                }
            }
        }

        const fieldsToSave: EnrollmentFormField[] = formFields.map((f) => {
            const base: EnrollmentFormField = {
                id: f.id,
                label: f.label.trim(),
                type: f.type,
                required: f.required,
            };
            if (f.type === "select") {
                base.options = f.selectOptionsText.split(",").map((s) => s.trim()).filter(Boolean);
            }
            return base;
        });

        setSaving(true);
        try {
            await adminSetEnrollmentForm(quizId, fieldsToSave);
            setStep("questions");
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to save enrollment form.");
        } finally {
            setSaving(false);
        }
    };

    // ── Done screen ─────────────────────────────────────────────────────────

    if (step === "done") {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Ionicons name="checkmark-circle" size={64} color={theme.success} />
                <Text style={[styles.doneTitle, { color: theme.textPrimary }]}>Quiz Published!</Text>
                <Text style={[styles.doneSub, { color: theme.textSecondary }]}>
                    {formFields.length > 0
                        ? `Enrollment form with ${formFields.length} field${formFields.length !== 1 ? "s" : ""} attached.`
                        : "No enrollment form — users can enroll directly."}
                    {"\n"}
                    {questions.length > 0
                        ? `${questions.length} question${questions.length !== 1 ? "s" : ""} added.`
                        : "No questions yet — add them later from the Admin panel."}
                    {quizId ? `\nQuiz URL: /quiz/${quizId}` : ""}
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

    const stepLabel =
        step === "meta" ? "STEP 1 OF 3" : step === "enrollform" ? "STEP 2 OF 3" : "STEP 3 OF 3";
    const pageTitle =
        step === "meta" ? "Quiz Details" : step === "enrollform" ? "Enrollment Form" : "Add Questions";
    const pageSub =
        step === "meta"
            ? "Set quiz metadata — you'll set up the enrollment form and questions next."
            : step === "enrollform"
                ? "Design the registration form participants fill before enrolling.\nOr skip to let users enroll without a form."
                : `Quiz ready — "${title}". Add questions now or skip to add them later.`;

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        >
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backRow}>
                <Ionicons name="arrow-back" size={20} color={theme.primary} />
                <Text style={[styles.backText, { color: theme.primary }]}>Back</Text>
            </Pressable>

            <Text accessibilityRole="header" style={[styles.eyebrow, { color: theme.primary }]}>{stepLabel}</Text>
            <Text accessibilityRole="header" style={[styles.pageTitle, { color: theme.textPrimary }]}>{pageTitle}</Text>
            <Text style={[styles.pageSub, { color: theme.textSecondary }]}>{pageSub}</Text>

            {/* ── Step 1: Metadata ── */}
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
                                accessibilityRole="button"
                                accessibilityLabel={`Level ${l}`}
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
                    <Field label="Start Date/Time * (YYYY-MM-DDTHH:MM)" value={startsAt} onChangeText={setStartsAt} placeholder="2024-06-01T10:00" theme={theme} />
                    <Field label="Description" value={description} onChangeText={setDescription} placeholder="Brief overview..." multiline theme={theme} />
                    <Field label="Curator Note" value={curatorNote} onChangeText={setCuratorNote} placeholder="A personal note for participants..." multiline theme={theme} />
                    <View>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Banner Image</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={bannerPreview ? "Replace banner image" : "Upload banner image"}
                            onPress={handlePickBannerImage}
                            disabled={bannerUploading}
                            style={({ pressed }) => [
                                styles.uploadBtn,
                                {
                                    backgroundColor: bannerUploading ? theme.buttonDisabled : theme.buttonPrimary,
                                    opacity: pressed ? 0.92 : 1,
                                },
                            ]}
                        >
                            <Ionicons name="cloud-upload-outline" size={18} color={theme.textInverse} />
                            <Text style={[styles.btnText, { color: theme.textInverse }]}>
                                {bannerUploading ? "Uploading..." : bannerPreview ? "Replace Banner Image" : "Upload Banner Image"}
                            </Text>
                        </Pressable>
                        {bannerPreview && (
                            <View style={[styles.bannerPreviewCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                                <Image source={{ uri: bannerPreview }} style={styles.bannerPreviewImage} />
                                <Text style={[styles.bannerPreviewText, { color: theme.textSecondary }]} numberOfLines={1}>
                                    {imageUrl}
                                </Text>
                            </View>
                        )}
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Create quiz and continue"
                        style={[styles.btn, { backgroundColor: saving ? theme.buttonDisabled : theme.buttonPrimary }]}
                        onPress={handleCreateQuiz}
                        disabled={saving}
                    >
                        <Text style={[styles.btnText, { color: theme.textInverse }]}>{saving ? "Creating..." : "Next: Enrollment Form"}</Text>
                        <Ionicons name="arrow-forward" size={18} color={theme.textInverse} />
                    </Pressable>
                </View>
            )}

            {/* ── Step 2: Enrollment form builder ── */}
            {step === "enrollform" && (
                <View style={styles.form}>
                    {formFields.length === 0 && (
                        <View style={[styles.emptyNotice, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                            <Ionicons name="information-circle-outline" size={22} color={theme.textMuted} />
                            <Text style={[styles.emptyNoticeText, { color: theme.textMuted }]}>
                                No fields added yet. Add fields below, or skip to allow direct enrollment.
                            </Text>
                        </View>
                    )}

                    {formFields.map((f, fIdx) => (
                        <View key={f.tempId} style={[styles.qCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                            <View style={styles.qHeader}>
                                <Text style={[styles.qNum, { color: theme.primary }]}>Field {fIdx + 1}</Text>
                                <Pressable onPress={() => removeField(fIdx)}>
                                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                                </Pressable>
                            </View>

                            <Field
                                label="Field Label *"
                                value={f.label}
                                onChangeText={(t) => updateField(fIdx, { label: t })}
                                placeholder="e.g., Full Name"
                                theme={theme}
                            />

                            <Text style={[styles.label, { color: theme.textSecondary }]}>Type</Text>
                            <View style={[styles.levelRow, { flexWrap: "wrap" }]}>
                                {FIELD_TYPES.map((ft) => (
                                    <Pressable
                                        key={ft.value}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Field type ${ft.label}`}
                                        onPress={() => updateField(fIdx, { type: ft.value })}
                                        style={[
                                            styles.levelChip,
                                            {
                                                backgroundColor: f.type === ft.value ? theme.buttonPrimary : theme.surface,
                                                borderColor: f.type === ft.value ? theme.buttonPrimary : theme.border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.levelChipText, { color: f.type === ft.value ? theme.textInverse : theme.textPrimary }]}>{ft.label}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            {f.type === "select" && (
                                <Field
                                    label="Options (comma-separated) *"
                                    value={f.selectOptionsText}
                                    onChangeText={(t) => updateField(fIdx, { selectOptionsText: t })}
                                    placeholder="e.g., CSE, ECE, ME, Civil"
                                    theme={theme}
                                />
                            )}

                            <View style={styles.requiredRow}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={f.required ? "Field required" : "Field optional"}
                                    onPress={() => updateField(fIdx, { required: !f.required })}
                                    style={[
                                        styles.correctBtn,
                                        {
                                            backgroundColor: f.required ? theme.primary : "transparent",
                                            borderColor: f.required ? theme.primary : theme.border,
                                        },
                                    ]}
                                >
                                    {f.required && <Ionicons name="checkmark" size={12} color={theme.textInverse} />}
                                </Pressable>
                                <Text style={[styles.label, { color: theme.textPrimary, marginBottom: 0 }]}>Required</Text>
                            </View>
                        </View>
                    ))}

                    <Pressable accessibilityRole="button" accessibilityLabel="Add form field" style={[styles.addBtn, { borderColor: theme.primary }]} onPress={addField}>
                        <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                        <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Form Field</Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={formFields.length > 0 ? "Save form and add questions" : "Continue to questions"}
                        style={[styles.btn, { backgroundColor: saving ? theme.buttonDisabled : theme.buttonPrimary, marginTop: 16 }]}
                        onPress={handleSaveForm}
                        disabled={saving}
                    >
                        <Text style={[styles.btnText, { color: theme.textInverse }]}>{saving ? "Saving..." : formFields.length > 0 ? "Save Form & Add Questions" : "Next: Add Questions"}</Text>
                        <Ionicons name="arrow-forward" size={18} color={theme.textInverse} />
                    </Pressable>

                    {!saving && (
                        <Pressable accessibilityRole="button" accessibilityLabel="Skip enrollment form" style={[styles.skipBtn, { borderColor: theme.border }]} onPress={handleSkipForm}>
                            <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>Skip — no enrollment form</Text>
                        </Pressable>
                    )}
                </View>
            )}

            {/* ── Step 3: Questions ── */}
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
                                accessibilityLabel={`Question ${qIdx + 1}`}
                                style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                                placeholder="Question text"
                                placeholderTextColor={theme.textMuted}
                                value={q.text}
                                onChangeText={(t) => updateQuestion(qIdx, { text: t })}
                                multiline
                            />

                            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>Options — tap circle to mark correct</Text>
                            {q.options.map((opt, oIdx) => (
                                <View key={opt.id} style={styles.optionRow}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Mark option ${oIdx + 1} as correct for question ${qIdx + 1}`}
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
                                        accessibilityLabel={`Question ${qIdx + 1} option ${oIdx + 1}`}
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
                                    accessibilityLabel={`Question ${qIdx + 1} points`}
                                    style={[styles.pointsInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                                    value={q.points}
                                    onChangeText={(t) => updateQuestion(qIdx, { points: t })}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    ))}

                    <Pressable accessibilityRole="button" accessibilityLabel="Add another question" style={[styles.addBtn, { borderColor: theme.primary }]} onPress={addQuestion}>
                        <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                        <Text style={[styles.addBtnText, { color: theme.primary }]}>Add Another Question</Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Save questions and publish"
                        style={[styles.btn, { backgroundColor: saving ? theme.buttonDisabled : theme.buttonPrimary, marginTop: 16 }]}
                        onPress={handleSaveQuestions}
                        disabled={saving}
                    >
                        <Text style={[styles.btnText, { color: theme.textInverse }]}>{saving ? "Saving..." : "Save Questions & Publish"}</Text>
                        <Ionicons name="rocket-outline" size={18} color={theme.textInverse} />
                    </Pressable>

                    {!saving && (
                        <Pressable accessibilityRole="button" accessibilityLabel="Skip questions for now" style={[styles.skipBtn, { borderColor: theme.border }]} onPress={() => setStep("done")}>
                            <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>Skip — add questions later</Text>
                        </Pressable>
                    )}
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
                accessibilityLabel={label.replace(/\s*\*+\s*$/, "")}
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
    uploadBtn: {
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 8,
    },
    bannerPreviewCard: {
        borderWidth: 1,
        borderRadius: 14,
        overflow: "hidden",
        marginTop: 12,
    },
    bannerPreviewImage: { width: "100%", height: 180, resizeMode: "cover" },
    bannerPreviewText: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 8 },
    skipBtn: {
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: "center",
        borderWidth: 1,
        marginTop: 10,
    },
    skipBtnText: { fontSize: 14, fontWeight: "600" },
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
    requiredRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
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
    emptyNotice: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
    },
    emptyNoticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
    doneTitle: { marginTop: 16, fontSize: 30, fontWeight: "800", textAlign: "center" },
    doneSub: { marginTop: 8, fontSize: 15, textAlign: "center", lineHeight: 22 },
});

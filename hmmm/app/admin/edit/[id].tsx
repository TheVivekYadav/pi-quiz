import { adminSetEnrollmentForm, adminUpdateQuizMetadata, EnrollmentFormField, fetchQuizDetail, QuizImageMode, uploadQuizBannerImage } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
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

type EditableFormField = EnrollmentFormField & { tempId: string; selectOptionsText: string };

const ENROLL_FIELD_TYPES: Array<{ value: EnrollmentFormField["type"]; label: string }> = [
    { value: "text", label: "Text" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "number", label: "Number" },
    { value: "select", label: "Dropdown" },
];

const IMAGE_MODES: Array<{ value: QuizImageMode; label: string }> = [
    { value: "banner", label: "Banner (wide)" },
    { value: "poster", label: "Poster (tall)" },
];

const makeFieldId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const emptyEnrollmentField = (): EditableFormField => ({
    tempId: makeFieldId(),
    id: makeFieldId(),
    label: "",
    type: "text",
    required: true,
    options: [],
    selectOptionsText: "",
});

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
    const [enrollmentEnabled, setEnrollmentEnabled] = useState(true);
    const [enrollmentStartsAt, setEnrollmentStartsAt] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [imageMode, setImageMode] = useState<QuizImageMode>("banner");
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [bannerUploading, setBannerUploading] = useState(false);
    const [formFields, setFormFields] = useState<EditableFormField[]>([]);

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
                setEnrollmentEnabled(data.enrollmentEnabled !== false);
                if (data.enrollmentStartsAtIso) {
                    const dt = new Date(data.enrollmentStartsAtIso);
                    if (!Number.isNaN(dt.getTime())) {
                        const pad = (n: number) => String(n).padStart(2, "0");
                        const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
                        setEnrollmentStartsAt(local);
                    } else {
                        setEnrollmentStartsAt("");
                    }
                } else {
                    setEnrollmentStartsAt("");
                }
                setImageUrl(data.imageUrl || "");
                setImageMode(data.imageMode === "poster" ? "poster" : "banner");
                setBannerPreview(data.imageUrl || null);
                const existingFields: EnrollmentFormField[] = data.enrollmentForm?.fields ?? [];
                setFormFields(
                    existingFields.map((f, idx) => ({
                        ...f,
                        tempId: `${f.id}_${idx}_${Date.now()}`,
                        selectOptionsText: Array.isArray(f.options) ? f.options.join(", ") : "",
                    })),
                );
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
            aspect: imageMode === "poster" ? [3, 4] : [16, 9],
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
            setBannerPreview(imageUrl || null);
            Alert.alert("Upload failed", err?.message || "Could not upload banner image.");
        } finally {
            setBannerUploading(false);
        }
    };

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

        let enrollmentStartsAtIso: string | null = null;
        if (enrollmentStartsAt.trim()) {
            const parsed = new Date(enrollmentStartsAt);
            if (Number.isNaN(parsed.getTime())) {
                Alert.alert("Validation", "Enrollment starts at must be a valid date/time.");
                return;
            }
            enrollmentStartsAtIso = parsed.toISOString();
        }

        setSaving(true);
        try {
            for (let i = 0; i < formFields.length; i++) {
                const f = formFields[i];
                if (!f.id.trim()) {
                    Alert.alert("Validation", `Registration field ${i + 1} is missing an id.`);
                    return;
                }
                if (!f.label.trim()) {
                    Alert.alert("Validation", `Registration field ${i + 1} is missing a label.`);
                    return;
                }
                if (f.type === "select") {
                    const opts = f.selectOptionsText.split(",").map((x) => x.trim()).filter(Boolean);
                    if (opts.length < 2) {
                        Alert.alert("Validation", `Dropdown field \"${f.label || `#${i + 1}`}\" needs at least 2 options.`);
                        return;
                    }
                }
            }

            await adminUpdateQuizMetadata(quizId!, {
                title: title.trim(),
                description: description.trim(),
                category: category.trim(),
                level: level as any,
                durationMinutes: duration,
                imageUrl: imageUrl.trim() || undefined,
                imageMode,
                enrollmentEnabled,
                enrollmentStartsAt: enrollmentStartsAtIso,
            });

            if (formFields.length > 0) {
                const payload: EnrollmentFormField[] = formFields.map((f) => {
                    const item: EnrollmentFormField = {
                        id: f.id.trim(),
                        label: f.label.trim(),
                        type: f.type,
                        required: !!f.required,
                    };
                    if (f.type === "select") {
                        item.options = f.selectOptionsText.split(",").map((x) => x.trim()).filter(Boolean);
                    }
                    return item;
                });
                await adminSetEnrollmentForm(quizId!, payload);
            }

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

    const addField = () => {
        setFormFields((prev) => [...prev, emptyEnrollmentField()]);
    };

    const addParticipationField = () => {
        const id = "registration_interest";
        const exists = formFields.some((f) => f.id === id);
        if (exists) {
            Alert.alert("Already added", "Participation choice field already exists.");
            return;
        }
        setFormFields((prev) => [
            ...prev,
            {
                tempId: makeFieldId(),
                id,
                label: "Registering for",
                type: "select",
                required: true,
                options: ["Quiz", "Presentation", "Both"],
                selectOptionsText: "Quiz, Presentation, Both",
            },
        ]);
    };

    const updateFormField = (idx: number, patch: Partial<EditableFormField>) => {
        setFormFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    };

    const removeFormField = (idx: number) => {
        setFormFields((prev) => prev.filter((_, i) => i !== idx));
    };

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

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 14 }]}>Enrollment Status</Text>
                <View style={styles.levelButtonGroup}>
                    <Pressable
                        onPress={() => setEnrollmentEnabled(true)}
                        disabled={saving}
                        style={[
                            styles.levelButton,
                            {
                                backgroundColor: enrollmentEnabled ? theme.success : theme.surface,
                                borderColor: theme.border,
                            },
                        ]}
                    >
                        <Text style={[styles.levelButtonText, { color: enrollmentEnabled ? theme.textInverse : theme.textPrimary }]}>Taking enrollments</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setEnrollmentEnabled(false)}
                        disabled={saving}
                        style={[
                            styles.levelButton,
                            {
                                backgroundColor: !enrollmentEnabled ? theme.error : theme.surface,
                                borderColor: theme.border,
                            },
                        ]}
                    >
                        <Text style={[styles.levelButtonText, { color: !enrollmentEnabled ? theme.textInverse : theme.textPrimary }]}>Not taking enrollments</Text>
                    </Pressable>
                </View>

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 14 }]}>Enrollment starts on (optional)</Text>
                <TextInput
                    style={[
                        styles.input,
                        {
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            borderColor: theme.border,
                        },
                    ]}
                    placeholder="YYYY-MM-DDTHH:mm"
                    placeholderTextColor={theme.textMuted}
                    value={enrollmentStartsAt}
                    onChangeText={setEnrollmentStartsAt}
                    editable={!saving}
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>Leave empty to allow immediate enrollments.</Text>

                <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>Banner Image</Text>
                <View style={[styles.levelButtonGroup, { marginBottom: 4 }]}>
                    {IMAGE_MODES.map((mode) => (
                        <Pressable
                            key={mode.value}
                            onPress={() => setImageMode(mode.value)}
                            disabled={saving || bannerUploading}
                            style={[
                                styles.levelButton,
                                {
                                    backgroundColor: imageMode === mode.value ? theme.primary : theme.surface,
                                    borderColor: theme.border,
                                },
                            ]}
                        >
                            <Text style={[styles.levelButtonText, { color: imageMode === mode.value ? theme.textInverse : theme.textPrimary }]}>{mode.label}</Text>
                        </Pressable>
                    ))}
                </View>
                <Pressable
                    onPress={handlePickBannerImage}
                    disabled={bannerUploading || saving}
                    style={({ pressed }) => [
                        styles.uploadBtn,
                        {
                            backgroundColor: bannerUploading || saving ? theme.textMuted : theme.buttonPrimary,
                            opacity: pressed ? 0.92 : 1,
                        },
                    ]}
                >
                    <Text style={[styles.uploadBtnText, { color: theme.textInverse }]}>
                        {bannerUploading ? "Uploading..." : bannerPreview ? "Replace Banner" : "Upload Banner"}
                    </Text>
                </Pressable>

                {bannerPreview && (
                    <View style={[styles.bannerPreviewCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                        <Image source={{ uri: bannerPreview }} style={[styles.bannerPreviewImage, imageMode === "poster" && styles.bannerPreviewImagePoster]} />
                        <Text style={[styles.bannerPreviewText, { color: theme.textSecondary }]} numberOfLines={1}>
                            {imageUrl || "Current banner preview"}
                        </Text>
                    </View>
                )}

                <Pressable
                    onPress={() => {
                        setImageUrl("");
                        setBannerPreview(null);
                    }}
                    disabled={bannerUploading || saving || !imageUrl}
                    style={({ pressed }) => [
                        styles.clearBannerBtn,
                        {
                            borderColor: theme.border,
                            backgroundColor: theme.surface,
                            opacity: pressed || !imageUrl ? 0.7 : 1,
                        },
                    ]}
                >
                    <Text style={[styles.clearBannerBtnText, { color: theme.textPrimary }]}>Remove Banner</Text>
                </Pressable>

                <View style={[styles.enrollSection, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}>
                    <Text style={[styles.enrollTitle, { color: theme.textPrimary }]}>Registration Form</Text>
                    <Text style={[styles.enrollSub, { color: theme.textSecondary }]}>Edit fields shown before enrollment.</Text>

                    <View style={styles.enrollActionRow}>
                        <Pressable
                            onPress={addField}
                            disabled={saving}
                            style={[styles.enrollActionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                        >
                            <Text style={[styles.enrollActionText, { color: theme.textPrimary }]}>+ Add Field</Text>
                        </Pressable>
                        <Pressable
                            onPress={addParticipationField}
                            disabled={saving}
                            style={[styles.enrollActionBtnPrimary, { backgroundColor: theme.buttonPrimary }]}
                        >
                            <Text style={[styles.enrollActionText, { color: theme.textInverse }]}>+ Quiz/Presentation/Both</Text>
                        </Pressable>
                    </View>

                    {formFields.length === 0 && (
                        <Text style={[styles.enrollEmpty, { color: theme.textMuted }]}>No form fields yet.</Text>
                    )}

                    {formFields.map((field, idx) => (
                        <View key={field.tempId} style={[styles.formFieldCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                            <View style={styles.formFieldTopRow}>
                                <Text style={[styles.formFieldHeading, { color: theme.textPrimary }]}>Field {idx + 1}</Text>
                                <Pressable onPress={() => removeFormField(idx)} disabled={saving}>
                                    <Text style={[styles.removeFieldText, { color: theme.error }]}>Remove</Text>
                                </Pressable>
                            </View>

                            <Text style={[styles.smallLabel, { color: theme.textSecondary }]}>Field ID</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]}
                                value={field.id}
                                onChangeText={(v) => updateFormField(idx, { id: v })}
                                editable={!saving}
                                placeholder="e.g. roll_number"
                                placeholderTextColor={theme.textMuted}
                            />

                            <Text style={[styles.smallLabel, { color: theme.textSecondary, marginTop: 10 }]}>Label</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]}
                                value={field.label}
                                onChangeText={(v) => updateFormField(idx, { label: v })}
                                editable={!saving}
                                placeholder="Visible question label"
                                placeholderTextColor={theme.textMuted}
                            />

                            <Text style={[styles.smallLabel, { color: theme.textSecondary, marginTop: 10 }]}>Type</Text>
                            <View style={styles.typePillRow}>
                                {ENROLL_FIELD_TYPES.map((t) => {
                                    const active = field.type === t.value;
                                    return (
                                        <Pressable
                                            key={t.value}
                                            onPress={() => updateFormField(idx, { type: t.value, selectOptionsText: t.value === "select" ? field.selectOptionsText : "" })}
                                            style={[
                                                styles.typePill,
                                                {
                                                    backgroundColor: active ? theme.primary : theme.background,
                                                    borderColor: active ? theme.primary : theme.border,
                                                },
                                            ]}
                                        >
                                            <Text style={{ color: active ? theme.textInverse : theme.textPrimary, fontSize: 12, fontWeight: "700" }}>{t.label}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {field.type === "select" && (
                                <>
                                    <Text style={[styles.smallLabel, { color: theme.textSecondary, marginTop: 10 }]}>Options (comma-separated)</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.background, color: theme.textPrimary, borderColor: theme.border }]}
                                        value={field.selectOptionsText}
                                        onChangeText={(v) => updateFormField(idx, { selectOptionsText: v })}
                                        editable={!saving}
                                        placeholder="Quiz, Presentation, Both"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                </>
                            )}

                            <Pressable
                                onPress={() => updateFormField(idx, { required: !field.required })}
                                style={[styles.requiredToggle, { borderColor: theme.border, backgroundColor: field.required ? `${theme.success}22` : theme.background }]}
                            >
                                <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: "700" }}>
                                    {field.required ? "✓ Required" : "Optional"}
                                </Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
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
    uploadBtn: {
        minHeight: 44,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        marginTop: 6,
    },
    uploadBtnText: { fontSize: 14, fontWeight: "700" },
    bannerPreviewCard: {
        borderWidth: 1,
        borderRadius: 14,
        overflow: "hidden",
        marginTop: 10,
    },
    bannerPreviewImage: { width: "100%", height: 180 },
    bannerPreviewImagePoster: { height: 260, resizeMode: "contain", backgroundColor: "#00000008" },
    bannerPreviewText: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 10 },
    clearBannerBtn: {
        minHeight: 42,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        marginTop: 8,
    },
    clearBannerBtnText: { fontSize: 14, fontWeight: "700" },
    enrollSection: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginTop: 16,
    },
    enrollTitle: { fontSize: 18, fontWeight: "800" },
    enrollSub: { fontSize: 13, marginTop: 4, marginBottom: 10 },
    enrollActionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
    enrollActionBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    enrollActionBtnPrimary: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    enrollActionText: { fontSize: 13, fontWeight: "700" },
    enrollEmpty: { fontSize: 13, fontStyle: "italic", marginTop: 6 },
    formFieldCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        marginTop: 10,
    },
    formFieldTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    formFieldHeading: { fontSize: 14, fontWeight: "700" },
    removeFieldText: { fontSize: 13, fontWeight: "700" },
    smallLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
    typePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    typePill: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 10 },
    requiredToggle: { borderWidth: 1, borderRadius: 8, alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 10, marginTop: 10 },
    actionButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    cancelBtnText: { fontSize: 14, fontWeight: "700" },
    saveBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
    saveBtnText: { fontSize: 14, fontWeight: "700" },
});

import { apiUrl } from "@/constants/api";
import { isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

type FieldType = "text" | "email";

type Field = {
    id: string;
    type: FieldType;
    label: string;
};

type Form = {
    id: string;
    title: string;
    fields: Field[];
};

export default function FillFormScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const [form, setForm] = useState<Form | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const formId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

    useEffect(() => {
        if (!formId) {
            setLoading(false);
            return;
        }

        const fetchForm = async () => {
            try {
                const res = await fetch(apiUrl(`/forms/${formId}`));
                const data = await res.json();

                if (!data?.id) {
                    setForm(null);
                    return;
                }

                setForm(data);

                const initialAnswers: Record<string, string> = {};
                (data.fields ?? []).forEach((field: Field) => {
                    initialAnswers[field.id] = "";
                });
                setAnswers(initialAnswers);
            } catch (err) {
                console.error("Failed to fetch form", err);
                setForm(null);
            } finally {
                setLoading(false);
            }
        };

        fetchForm();
    }, [formId]);

    const submitResponse = async () => {
        if (!formId || !form) {
            return;
        }

        const hasEmpty = form.fields.some((field) => !answers[field.id]?.trim());
        if (hasEmpty) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(apiUrl("/responses"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    formId,
                    answers,
                    submittedAt: new Date().toISOString(),
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || "Failed to submit response");
            }

            Alert.alert("Success", "Response submitted", [
                {
                    text: "OK",
                    onPress: () => router.push("/forms"),
                },
            ]);
        } catch (err) {
            console.error("Failed to submit response", err);
            Alert.alert("Error", "Failed to submit response");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAdmin()) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.error }}>Access denied</Text>
                <Text style={{ marginTop: 8, color: theme.textSecondary }}>Admin access required.</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={{
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: 16,
            }}
        >
            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} />
            ) : !form ? (
                <View style={[styles.notFound, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Ionicons name="alert-circle-outline" size={26} color={theme.warning} />
                    <Text style={[styles.title, { color: theme.textPrimary }]}>Form not found</Text>
                    <Pressable
                        onPress={() => router.push("/forms")}
                        style={({ pressed }) => [
                            styles.backBtn,
                            { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
                        ]}
                    >
                        <Text style={[styles.backBtnText, { color: theme.textInverse }]}>Back to Forms</Text>
                    </Pressable>
                </View>
            ) : (
                <View>
                    <Text style={[styles.eyebrow, { color: theme.primary }]}>SUBMISSION</Text>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{form.title}</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Fill all fields to submit your response.</Text>

                    {form.fields.map((field) => (
                        <View
                            key={field.id}
                            style={[
                                styles.fieldBlock,
                                {
                                    backgroundColor: theme.surfaceLight,
                                    borderColor: theme.border,
                                    shadowColor: theme.shadow,
                                },
                            ]}
                        >
                            <Text style={[styles.label, { color: theme.textSecondary }]}>{field.label || "Untitled field"}</Text>
                            <TextInput
                                value={answers[field.id] ?? ""}
                                onChangeText={(text) =>
                                    setAnswers((prev) => ({
                                        ...prev,
                                        [field.id]: text,
                                    }))
                                }
                                placeholder={field.label || "Enter value"}
                                keyboardType={
                                    field.type === "email" ? "email-address" : "default"
                                }
                                autoCapitalize="none"
                                placeholderTextColor={theme.textMuted}
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: theme.surface,
                                        borderColor: theme.border,
                                        color: theme.textPrimary,
                                    },
                                ]}
                            />
                        </View>
                    ))}

                    <Pressable
                        onPress={submitResponse}
                        disabled={submitting}
                        style={({ pressed }) => [
                            styles.submit,
                            {
                                backgroundColor: submitting ? theme.buttonDisabled : theme.buttonPrimary,
                                opacity: pressed ? 0.9 : 1,
                            },
                        ]}
                    >
                        <Text style={[styles.submitText, { color: theme.textInverse }]}>{submitting ? "Submitting..." : "Submit"}</Text>
                        {!submitting && <Ionicons name="arrow-forward" size={18} color={theme.textInverse} />}
                    </Pressable>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    title: {
        fontSize: 31,
        fontWeight: "800",
        marginTop: 8,
    },
    eyebrow: {
        fontSize: 12,
        letterSpacing: 2,
        fontWeight: "700",
    },
    subtitle: {
        marginTop: 6,
        marginBottom: 14,
        fontSize: 15,
        lineHeight: 22,
    },
    notFound: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 18,
        alignItems: "center",
    },
    fieldBlock: {
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    label: {
        marginBottom: 6,
        fontWeight: "600",
        fontSize: 14,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
    },
    submit: {
        marginTop: 8,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    submitText: {
        fontSize: 16,
        fontWeight: "700",
    },
    backBtn: {
        marginTop: 12,
        borderRadius: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    backBtnText: {
        fontWeight: "700",
    },
});
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
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
                const res = await fetch(`http://10.41.53.22:3000/forms/${formId}`);
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
            await fetch("http://10.41.53.22:3000/responses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    formId,
                    answers,
                    submittedAt: new Date().toISOString(),
                }),
            });

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

    return (
        <ScrollView
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                    paddingHorizontal: 10,
                    backgroundColor: theme.background,
                },
            ]}
        >
            {loading ? (
                <ActivityIndicator size="large" />
            ) : !form ? (
                <View>
                    <Text style={styles.title}>Form not found</Text>
                    <Button title="Back to Forms" onPress={() => router.push("/forms")} />
                </View>
            ) : (
                <View>
                    <Text style={styles.title}>{form.title}</Text>

                    {form.fields.map((field) => (
                        <View key={field.id} style={styles.fieldBlock}>
                            <Text style={styles.label}>{field.label || "Untitled field"}</Text>
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
                                style={styles.input}
                            />
                        </View>
                    ))}

                    <Button
                        title={submitting ? "Submitting..." : "Submit"}
                        onPress={submitResponse}
                        disabled={submitting}
                    />
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
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 20,
    },
    fieldBlock: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 6,
        fontWeight: "600",
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
    },
});
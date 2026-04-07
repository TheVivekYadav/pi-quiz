import { apiUrl } from "@/constants/api";
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
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ✅ Strong typing
type FieldType = "text" | "email";

type Field = {
    id: string;
    type: FieldType;
    label: string;
};

export default function CreateForm() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const [title, setTitle] = useState("");
    const [fields, setFields] = useState<Field[]>([]);
    const [showOptions, setShowOptions] = useState(false);

    const addField = (type: FieldType) => {
        setFields((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                type,
                label: "",
            },
        ]);
        setShowOptions(false);
    };

    const updateFieldLabel = (index: number, label: string) => {
        setFields((prev) => prev.map((field, idx) => (
            idx === index ? { ...field, label } : field
        )));
    };

    const removeField = (id: string) => {
        setFields((prev) => prev.filter((field) => field.id !== id));
    };

    const saveForm = async () => {
        if (!title.trim()) {
            Alert.alert("Error", "Please enter form title");
            return;
        }

        try {
            const res = await fetch(apiUrl("/forms"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title,
                    fields,
                }),
            });

            const data = await res.json();

            Alert.alert("Success", "Form saved!");
            console.log(data);

            if (data?.id) {
                router.push(`/fill/${data.id}`);
                return;
            }

            // fallback reset if API does not return id
            setTitle("");
            setFields([]);
        } catch (err) {
            Alert.alert("Error", "Failed to save form");
            console.error(err);
        }
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={{
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: 16,
            }}
        >
            <Text style={[styles.pageEyebrow, { color: theme.primary }]}>FORM BUILDER</Text>
            <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Create a beautiful form</Text>
            <Text style={[styles.pageSubTitle, { color: theme.textSecondary }]}>Add fields, set labels, and publish in one tap.</Text>

            <View style={[styles.sectionCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Form title</Text>
                <TextInput
                    placeholder="Example: Participant Enrollment"
                    placeholderTextColor={theme.textMuted}
                    value={title}
                    onChangeText={setTitle}
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

            <View style={[styles.sectionCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border, shadowColor: theme.shadow }]}>
                <Pressable
                    onPress={() => setShowOptions(!showOptions)}
                    style={({ pressed }) => [
                        styles.addButton,
                        { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
                    ]}
                >
                    <Ionicons name="add-circle-outline" size={18} color={theme.textInverse} />
                    <Text style={[styles.addButtonText, { color: theme.textInverse }]}>Add field</Text>
                </Pressable>

                {showOptions && (
                    <View style={styles.optionsRow}>
                        <Pressable
                            onPress={() => addField("text")}
                            style={({ pressed }) => [
                                styles.optionPill,
                                {
                                    backgroundColor: theme.primaryMuted,
                                    borderColor: theme.border,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.optionText, { color: theme.primary }]}>Text Input</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => addField("email")}
                            style={({ pressed }) => [
                                styles.optionPill,
                                {
                                    backgroundColor: theme.accentMuted,
                                    borderColor: theme.border,
                                    opacity: pressed ? 0.85 : 1,
                                },
                            ]}
                        >
                            <Text style={[styles.optionText, { color: theme.accent }]}>Email Input</Text>
                        </Pressable>
                    </View>
                )}
            </View>

            {fields.map((field, index) => (
                <View
                    key={field.id}
                    style={[
                        styles.fieldCard,
                        {
                            backgroundColor: theme.surfaceLight,
                            borderColor: theme.border,
                            shadowColor: theme.shadow,
                        },
                    ]}
                >
                    <View style={styles.fieldHeader}>
                        <View style={[styles.fieldTypeChip, { backgroundColor: field.type === "email" ? theme.accentMuted : theme.primaryMuted }]}>
                            <Text style={[styles.fieldTypeText, { color: field.type === "email" ? theme.accent : theme.primary }]}>{field.type.toUpperCase()}</Text>
                        </View>
                        <Pressable onPress={() => removeField(field.id)}>
                            <Ionicons name="trash-outline" size={18} color={theme.error} />
                        </Pressable>
                    </View>

                    <TextInput
                        placeholder="Enter label"
                        placeholderTextColor={theme.textMuted}
                        value={field.label}
                        onChangeText={(text) => updateFieldLabel(index, text)}
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.surface,
                                borderColor: theme.border,
                                color: theme.textPrimary,
                                marginTop: 10,
                            },
                        ]}
                    />

                    <TextInput
                        editable={false}
                        placeholder={field.label || (field.type === "email" ? "Email input preview" : "Text input preview")}
                        placeholderTextColor={theme.textMuted}
                        keyboardType={field.type === "email" ? "email-address" : "default"}
                        style={[
                            styles.input,
                            {
                                backgroundColor: theme.surface,
                                borderColor: theme.border,
                                color: theme.textMuted,
                                marginTop: 10,
                            },
                        ]}
                    />
                </View>
            ))}

            <Pressable
                onPress={saveForm}
                style={({ pressed }) => [
                    styles.saveButton,
                    {
                        backgroundColor: theme.buttonPrimary,
                        opacity: pressed ? 0.9 : 1,
                    },
                ]}
            >
                <Text style={[styles.saveButtonText, { color: theme.textInverse }]}>Save Form</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.textInverse} />
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pageEyebrow: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 2,
    },
    pageTitle: {
        marginTop: 8,
        fontSize: 30,
        lineHeight: 35,
        fontWeight: "800",
    },
    pageSubTitle: {
        marginTop: 6,
        marginBottom: 16,
        fontSize: 15,
        lineHeight: 22,
    },
    sectionCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    label: {
        marginBottom: 8,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
    },
    addButton: {
        flexDirection: "row",
        gap: 8,
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: "center",
        justifyContent: "center",
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: "700",
    },
    optionsRow: {
        marginTop: 10,
        flexDirection: "row",
        gap: 8,
    },
    optionPill: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
    },
    optionText: {
        fontSize: 13,
        fontWeight: "700",
    },
    fieldCard: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    fieldHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    fieldTypeChip: {
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    fieldTypeText: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
    },
    saveButton: {
        marginTop: 8,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: "700",
    },
});
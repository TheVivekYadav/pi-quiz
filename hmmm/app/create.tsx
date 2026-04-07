import { apiUrl } from "@/constants/api";
import { useTheme } from "@/hook/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Button,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
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

    // ✅ Add field
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

    // ✅ Save form
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
            style={[
                styles.container,
                {
                    paddingTop: insets.top,
                    paddingHorizontal: 10,
                    backgroundColor: theme.background,
                },
            ]}
        >
            {/* ✅ Form Title */}
            <TextInput
                placeholder="Form Title"
                value={title}
                onChangeText={setTitle}
                style={{ borderWidth: 1, marginBottom: 20, padding: 10 }}
            />

            {/* Render Fields */}
            {fields.map((field, index) => (
                <View key={field.id} style={{ marginBottom: 15 }}>

                    {/* Label Input */}
                    <TextInput
                        placeholder="Enter label"
                        value={field.label}
                        onChangeText={(text) => {
                            const updated = [...fields];
                            updated[index].label = text;
                            setFields(updated);
                        }}
                        style={{ borderWidth: 1, marginBottom: 5, padding: 8 }}
                    />

                    {/* Preview */}
                    {field.type === "text" && (
                        <TextInput
                            placeholder={field.label || "Text input"}
                            style={{ borderWidth: 1, padding: 8 }}
                        />
                    )}

                    {field.type === "email" && (
                        <TextInput
                            placeholder={field.label || "Email input"}
                            keyboardType="email-address"
                            style={{ borderWidth: 1, padding: 8 }}
                        />
                    )}
                </View>
            ))}

            {/* + Button */}
            <TouchableOpacity
                onPress={() => setShowOptions(!showOptions)}
                style={styles.addButton}
            >
                <Text style={{ color: "white" }}>+ Add Field</Text>
            </TouchableOpacity>

            {/* Options */}
            {showOptions && (
                <View style={{ marginTop: 10 }}>
                    <Button title="Text Input" onPress={() => addField("text")} />
                    <Button title="Email Input" onPress={() => addField("email")} />
                </View>
            )}

            {/* Save */}
            <Button title="Save Form" onPress={saveForm} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    addButton: {
        backgroundColor: "black",
        padding: 12,
        alignItems: "center",
        marginVertical: 20,
    },
});
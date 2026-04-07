import { apiUrl } from "@/constants/api";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ResponseItem = {
    id: string;
    formId: string;
    answers: Record<string, string>;
    submittedAt: string;
};

export default function ResponsesScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const formId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

    const [responses, setResponses] = useState<ResponseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!formId) {
            setLoading(false);
            return;
        }

        const fetchResponses = async () => {
            setError("");

            try {
                const res = await fetch(apiUrl(`/responses/${formId}`));
                if (!res.ok) {
                    throw new Error("Failed to load responses");
                }

                const data = await res.json();
                setResponses(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch responses", err);
                setError("Could not load responses");
            } finally {
                setLoading(false);
            }
        };

        fetchResponses();
    }, [formId]);

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
            <Text style={styles.title}>Responses</Text>

            {loading && <ActivityIndicator size="large" />}

            {!loading && !!error && <Text style={styles.error}>{error}</Text>}

            {!loading && !error && responses.length === 0 && (
                <Text>No responses yet for this form.</Text>
            )}

            {!loading && !error && responses.map((response, index) => (
                <View key={response.id} style={styles.card}>
                    <Text style={styles.cardTitle}>Response #{index + 1}</Text>
                    <Text style={styles.dateText}>
                        {new Date(response.submittedAt).toLocaleString()}
                    </Text>

                    {Object.entries(response.answers ?? {}).map(([key, value]) => (
                        <View key={key} style={styles.answerRow}>
                            <Text style={styles.answerKey}>{key}</Text>
                            <Text>{String(value)}</Text>
                        </View>
                    ))}
                </View>
            ))}
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
    error: {
        color: "#b91c1c",
    },
    card: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
    },
    cardTitle: {
        fontWeight: "700",
        marginBottom: 4,
    },
    dateText: {
        color: "gray",
        marginBottom: 8,
    },
    answerRow: {
        marginBottom: 6,
    },
    answerKey: {
        fontWeight: "600",
    },
});

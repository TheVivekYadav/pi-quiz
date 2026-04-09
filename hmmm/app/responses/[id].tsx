import { apiUrl } from "@/constants/api";
import { isAdmin } from "@/constants/auth-session";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
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
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ANALYTICS</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Responses</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Review every submission received for this form.</Text>

            {loading && <ActivityIndicator size="large" color={theme.primary} />}

            {!loading && !!error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

            {!loading && !error && responses.length === 0 && (
                <View style={[styles.empty, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <Ionicons name="mail-open-outline" size={26} color={theme.primary} />
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No responses yet</Text>
                    <Text style={[styles.emptyMeta, { color: theme.textMuted }]}>Share your form URL to start collecting answers.</Text>
                </View>
            )}

            {!loading && !error && responses.map((response, index) => (
                <View key={response.id} style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border, shadowColor: theme.shadow }]}>
                    <View style={styles.cardHead}>
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Response #{index + 1}</Text>
                        <View style={[styles.pill, { backgroundColor: theme.primaryMuted }]}>
                            <Text style={[styles.pillText, { color: theme.primary }]}>RECEIVED</Text>
                        </View>
                    </View>
                    <Text style={[styles.dateText, { color: theme.textMuted }]}>
                        {new Date(response.submittedAt).toLocaleString()}
                    </Text>

                    {Object.entries(response.answers ?? {}).map(([key, value]) => (
                        <View key={key} style={[styles.answerRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                            <Text style={[styles.answerKey, { color: theme.textSecondary }]}>{key}</Text>
                            <Text style={[styles.answerValue, { color: theme.textPrimary }]}>{String(value)}</Text>
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
        fontSize: 32,
        fontWeight: "800",
        marginTop: 8,
    },
    eyebrow: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 2,
    },
    subtitle: {
        marginTop: 5,
        marginBottom: 14,
        fontSize: 15,
        lineHeight: 22,
    },
    error: {
        fontSize: 14,
        marginBottom: 8,
    },
    empty: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 18,
        alignItems: "center",
    },
    emptyTitle: {
        marginTop: 8,
        fontSize: 20,
        fontWeight: "700",
    },
    emptyMeta: {
        marginTop: 4,
        fontSize: 14,
        textAlign: "center",
    },
    card: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
    },
    cardHead: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
    },
    cardTitle: {
        fontWeight: "800",
        fontSize: 16,
    },
    pill: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    pillText: {
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1,
        marginBottom: 4,
    },
    dateText: {
        marginBottom: 10,
        fontSize: 12,
    },
    answerRow: {
        marginBottom: 8,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    answerKey: {
        fontWeight: "600",
        marginBottom: 4,
    },
    answerValue: {
        fontSize: 15,
    },
});

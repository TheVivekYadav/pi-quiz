import { fetchQuizLobby } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LobbyScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [data, setData] = useState<any>(null);
    const [seconds, setSeconds] = useState(0);
    const [lockedSeconds, setLockedSeconds] = useState(0);

    useEffect(() => {
        if (!quizId) return;

        const run = async () => {
            const payload = await fetchQuizLobby(quizId);
            setData(payload);
            setSeconds(payload.startsInSeconds ?? 0);
            setLockedSeconds(payload.enrollment?.lockedSeconds ?? 0);
        };

        run();
    }, [quizId]);

    useEffect(() => {
        if (seconds > 0) {
            const timer = setInterval(() => setSeconds((prev) => Math.max(0, prev - 1)), 1000);
            return () => clearInterval(timer);
        }
        return;
    }, [seconds]);

    useEffect(() => {
        if (lockedSeconds <= 0) return;
        const timer = setInterval(() => setLockedSeconds((prev) => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(timer);
    }, [lockedSeconds]);

    if (!data) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.brand, { color: theme.textPrimary }]}>Intellectual Playground</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{data.quizTitle}</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Starting Soon</Text>

            <View style={styles.timerRow}>
                <View style={[styles.timerBox, { backgroundColor: theme.surfaceLight, borderColor: theme.primary }]}>
                    <Text style={[styles.timerValue, { color: theme.primary }]}>{mm}</Text>
                    <Text style={[styles.timerLabel, { color: theme.textMuted }]}>MINUTES</Text>
                </View>
                <Text style={[styles.colon, { color: theme.textMuted }]}>:</Text>
                <View style={[styles.timerBox, { backgroundColor: theme.surfaceLight, borderColor: theme.primary }]}>
                    <Text style={[styles.timerValue, { color: theme.primary }]}>{ss}</Text>
                    <Text style={[styles.timerLabel, { color: theme.textMuted }]}>SECONDS</Text>
                </View>
            </View>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Quiz Rules</Text>
                {(data.rules ?? []).map((rule: string, idx: number) => (
                    <Text key={`${rule}-${idx}`} style={[styles.rule, { color: theme.textSecondary }]}>{idx + 1}. {rule}</Text>
                ))}
            </View>

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Lobby</Text>
                <Text style={[styles.rule, { color: theme.textSecondary }]}>{data?.lobby?.waitingCount} users currently enrolled</Text>
                {(data?.lobby?.sampleUsers ?? []).map((user: { name: string; status: string }, idx: number) => (
                    <View key={`${user.name}-${idx}`} style={[styles.userRow, { borderColor: theme.border }]}>
                        <Ionicons name="ellipse" size={8} color={theme.success} />
                        <Text style={[styles.userName, { color: theme.textPrimary }]}>{user.name}</Text>
                        <Text style={[styles.ready, { color: theme.primary }]}>READY</Text>
                    </View>
                ))}
            </View>

            {lockedSeconds > 0 ? (
                <View style={[styles.startBtn, { alignItems: 'center', paddingVertical: 16 }]}> 
                    <Text style={[styles.startText, { color: theme.textSecondary }]}>You are temporarily locked out from attempting this quiz.</Text>
                    <Text style={{ marginTop: 8, color: theme.textMuted }}>{`Try again in ${String(Math.floor(lockedSeconds/60)).padStart(2,'0')}:${String(lockedSeconds%60).padStart(2,'0')}`}</Text>
                </View>
            ) : (
                <Pressable
                    style={({ pressed }) => [
                        styles.startBtn,
                        {
                            backgroundColor: seconds > 0 ? theme.buttonDisabled : theme.buttonPrimary,
                            opacity: pressed ? 0.95 : 1,
                        },
                    ]}
                    disabled={seconds > 0}
                    onPress={() =>
                        quizId &&
                        router.replace({ pathname: "/quiz/[id]/question/[index]", params: { id: quizId, index: "1" } } as any)
                    }
                >
                    <Text style={[styles.startText, { color: theme.textInverse }]}>{seconds > 0 ? `Starting in ${mm}:${ss}` : 'Start Quiz'}</Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    brand: { fontSize: 20, fontWeight: "800" },
    subtitle: { marginTop: 12, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" },
    title: { marginTop: 8, fontSize: 58, lineHeight: 60, fontWeight: "800" },
    timerRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
    timerBox: { borderWidth: 1, borderRadius: 16, width: 130, alignItems: "center", paddingVertical: 10 },
    timerValue: { fontSize: 44, fontWeight: "800" },
    timerLabel: { fontSize: 12, fontWeight: "700" },
    colon: { fontSize: 35, fontWeight: "700" },
    card: { marginTop: 16, borderWidth: 1, borderRadius: 16, padding: 14 },
    cardTitle: { fontSize: 34, fontWeight: "800", marginBottom: 8 },
    rule: { fontSize: 16, lineHeight: 26, marginBottom: 6 },
    userRow: {
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    userName: { flex: 1, fontSize: 15, fontWeight: "600" },
    ready: { fontSize: 12, fontWeight: "700" },
    startBtn: {
        marginTop: 16,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
    },
    startText: { fontSize: 17, fontWeight: "700" },
});

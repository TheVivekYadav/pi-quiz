import { getAuthToken } from "@/constants/auth-session";
import { submitCheckin } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useRequireAuth } from "@/hook/useRequireAuth";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CheckinStatus = "pending" | "loading" | "success" | "error";

export default function CheckinScreen() {
    const { id, token } = useLocalSearchParams<{ id: string; token: string }>();
    const quizId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const checkinToken = useMemo(() => (Array.isArray(token) ? token[0] : token), [token]);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    useRequireAuth();

    const [status, setStatus] = useState<CheckinStatus>("pending");
    const [message, setMessage] = useState<string>("");
    const didRun = useRef(false);

    useEffect(() => {
        // Run only once, even in StrictMode double-invoke
        if (didRun.current) return;
        if (!quizId || !checkinToken) {
            setStatus("error");
            setMessage("Invalid check-in link. Token or quiz ID is missing.");
            return;
        }
        if (!getAuthToken()) {
            // useRequireAuth will redirect to login; wait
            return;
        }
        didRun.current = true;
        setStatus("loading");

        submitCheckin(quizId, checkinToken)
            .then((res) => {
                setStatus("success");
                setMessage(res.message || "Checked in successfully!");
            })
            .catch((err: any) => {
                setStatus("error");
                setMessage(err?.message ?? "Check-in failed. Please try again.");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId, checkinToken]);

    const goToLobby = () => {
        if (quizId) {
            router.replace({ pathname: "/quiz/[id]/lobby", params: { id: quizId } } as any);
        } else {
            router.replace("/" as any);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.content}>
                {status === "loading" || status === "pending" ? (
                    <>
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginBottom: 20 }} />
                        <Text style={[styles.heading, { color: theme.textPrimary }]}>Verifying your attendance…</Text>
                        <Text style={[styles.sub, { color: theme.textSecondary }]}>Please wait a moment.</Text>
                    </>
                ) : status === "success" ? (
                    <>
                        <View style={[styles.iconCircle, { backgroundColor: theme.successMuted }]}>
                            <Ionicons name="checkmark-circle" size={56} color={theme.success} />
                        </View>
                        <Text style={[styles.heading, { color: theme.textPrimary }]}>Attendance Verified!</Text>
                        <Text style={[styles.sub, { color: theme.textSecondary }]}>{message}</Text>
                        <Pressable
                            style={({ pressed }) => [
                                styles.btn,
                                { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1, marginTop: 32 },
                            ]}
                            onPress={goToLobby}
                        >
                            <Ionicons name="play-circle-outline" size={20} color={theme.textInverse} />
                            <Text style={[styles.btnText, { color: theme.textInverse }]}>Go to Quiz Lobby</Text>
                        </Pressable>
                    </>
                ) : (
                    <>
                        <View style={[styles.iconCircle, { backgroundColor: theme.errorMuted }]}>
                            <Ionicons name="close-circle" size={56} color={theme.error} />
                        </View>
                        <Text style={[styles.heading, { color: theme.textPrimary }]}>Check-In Failed</Text>
                        <Text style={[styles.sub, { color: theme.textSecondary }]}>{message}</Text>
                        <Pressable
                            style={({ pressed }) => [
                                styles.btn,
                                { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1, marginTop: 32 },
                            ]}
                            onPress={goToLobby}
                        >
                            <Ionicons name="arrow-back-outline" size={20} color={theme.textInverse} />
                            <Text style={[styles.btnText, { color: theme.textInverse }]}>Back to Lobby</Text>
                        </Pressable>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
    iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 24 },
    heading: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 10 },
    sub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
    btn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 14,
        paddingHorizontal: 28,
        paddingVertical: 14,
    },
    btnText: { fontSize: 16, fontWeight: "700" },
});

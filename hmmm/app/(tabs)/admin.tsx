import { isAdmin, getAuthToken } from "@/constants/auth-session";
import { adminDeleteQuiz, adminDeclareWinners, adminListQuizzes, adminStartQuiz, QuizListItem } from "@/constants/quiz-api";
import { adminListUsers, AdminUserItem } from "@/constants/auth-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminTab() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [declaringId, setDeclaringId] = useState<string | null>(null);
    const [confirmDeclareId, setConfirmDeclareId] = useState<string | null>(null);
    const [startingId, setStartingId] = useState<string | null>(null);

    // User sessions section
    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [userSearch, setUserSearch] = useState("");

    useEffect(() => {
        if (!isAdmin()) return;
        adminListQuizzes()
            .then(setQuizzes)
            .catch((err: any) => Alert.alert("Error", err?.message || "Failed to load quizzes."))
            .finally(() => setLoadingQuizzes(false));

        const token = getAuthToken();
        if (token) {
            adminListUsers(token)
                .then((res) => setUsers(res.users))
                .catch(() => {})
                .finally(() => setLoadingUsers(false));
        } else {
            setLoadingUsers(false);
        }
    }, []);

    const handleDelete = (quiz: QuizListItem) => {
        Alert.alert(
            "Delete Quiz",
            `Are you sure you want to delete "${quiz.title}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await adminDeleteQuiz(quiz.id);
                            setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "Failed to delete quiz.");
                        }
                    },
                },
            ]
        );
    };

    const handleStartQuiz = (quiz: QuizListItem) => {
        Alert.alert(
            "Start Quiz",
            `Start "${quiz.title}" immediately? All enrolled users will be able to begin.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Start",
                    onPress: async () => {
                        setStartingId(quiz.id);
                        try {
                            await adminStartQuiz(quiz.id);
                            Alert.alert("Started", "Quiz has been started!");
                            adminListQuizzes().then(setQuizzes).catch(() => {});
                        } catch (err: any) {
                            Alert.alert("Error", err?.message || "Failed to start quiz.");
                        } finally {
                            setStartingId(null);
                        }
                    },
                },
            ]
        );
    };

    const handleDeclareWinners = (quiz: QuizListItem) => {
        if (Platform.OS === 'web') {
            // On web, Alert.alert with multiple buttons may not work reliably — use inline confirm state
            setConfirmDeclareId(quiz.id);
        } else {
            Alert.alert(
                "Declare Winners",
                `Officially declare winners for "${quiz.title}"? This cannot be undone.`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Declare",
                        onPress: () => doDeclareWinners(quiz.id),
                    },
                ]
            );
        }
    };

    const doDeclareWinners = async (quizId: string) => {
        setConfirmDeclareId(null);
        setDeclaringId(quizId);
        try {
            await adminDeclareWinners(quizId);
            Alert.alert("Success", "Winners declared!");
            adminListQuizzes().then(setQuizzes).catch(() => {});
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to declare winners.");
        } finally {
            setDeclaringId(null);
        }
    };

    const filteredUsers = users.filter((u) => {
        const q = userSearch.toLowerCase();
        return !q || (u.rollNumber?.toLowerCase().includes(q)) || (u.name?.toLowerCase().includes(q));
    });

    if (!isAdmin()) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <Text style={[styles.denied, { color: theme.error }]}>Access denied</Text>
                <Text style={[styles.deniedSub, { color: theme.textSecondary }]}>This section is available for admins only.</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.root, { backgroundColor: theme.background }]}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        >
            <Text style={[styles.eyebrow, { color: theme.primary }]}>ADMIN CONSOLE</Text>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Manage Platform</Text>

            <View style={[styles.card, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Quiz Management</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Create, publish, and monitor quizzes.</Text>
                <Pressable
                    onPress={() => router.push("/create-quiz" as any)}
                    style={({ pressed }) => [
                        styles.action,
                        { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
                    ]}
                >
                    <Ionicons name="add-circle-outline" size={18} color={theme.textInverse} />
                    <Text style={[styles.actionText, { color: theme.textInverse }]}>Open Creator</Text>
                </Pressable>
            </View>

            {/* ── Quiz list ── */}
            <Text style={[styles.sectionHeader, { color: theme.textPrimary }]}>Your Quizzes</Text>

            {loadingQuizzes && <ActivityIndicator color={theme.primary} style={styles.loader} />}

            {!loadingQuizzes && quizzes.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No quizzes yet. Tap "Open Creator" to create your first quiz.</Text>
                </View>
            )}

            {!loadingQuizzes && quizzes.map((quiz) => {
                const isPast = new Date(quiz.startsAtIso) < new Date();
                return (
                    <View
                        key={quiz.id}
                        style={[styles.quizRow, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                    >
                        <View style={styles.quizInfo}>
                            <View style={styles.quizTitleRow}>
                                <Text style={[styles.quizTitle, { color: theme.textPrimary }]} numberOfLines={1}>{quiz.title}</Text>
                                {isPast && (
                                    <View style={[styles.pastBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                        <Text style={[styles.pastBadgeText, { color: theme.textSecondary }]}>Past</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]}>
                                {quiz.category} • {quiz.level} • {new Date(quiz.startsAtIso).toLocaleString()}
                            </Text>

                            {/* Inline declare-winners confirmation (web-safe) */}
                            {confirmDeclareId === quiz.id && (
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmText, { color: theme.textPrimary }]}>Declare winners? Cannot be undone.</Text>
                                    <Pressable
                                        onPress={() => doDeclareWinners(quiz.id)}
                                        style={[styles.confirmYes, { backgroundColor: theme.warning }]}
                                    >
                                        <Text style={[styles.confirmYesText, { color: "#2d2500" }]}>Yes, Declare</Text>
                                    </Pressable>
                                    <Pressable onPress={() => setConfirmDeclareId(null)}>
                                        <Text style={[styles.confirmNo, { color: theme.textSecondary }]}>Cancel</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                        <View style={styles.quizActions}>
                            <Pressable
                                onPress={() => router.push({ pathname: "/quiz/[id]", params: { id: quiz.id } } as any)}
                                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                accessibilityLabel="View quiz"
                            >
                                <Ionicons name="eye-outline" size={20} color={theme.primary} />
                            </Pressable>
                            {/* Manage questions — always available */}
                            <Pressable
                                onPress={() => router.push({ pathname: "/quiz/[id]/manage-questions", params: { id: quiz.id } } as any)}
                                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                accessibilityLabel="Manage questions"
                            >
                                <Ionicons name="list-outline" size={20} color={theme.primary} />
                            </Pressable>
                            {!isPast && (
                                <Pressable
                                    onPress={() => handleStartQuiz(quiz)}
                                    disabled={startingId === quiz.id}
                                    style={({ pressed }) => [styles.iconBtn, { opacity: (pressed || startingId === quiz.id) ? 0.5 : 1 }]}
                                    accessibilityLabel="Start quiz"
                                >
                                    {startingId === quiz.id
                                        ? <ActivityIndicator size="small" color={theme.success} />
                                        : <Ionicons name="play-circle-outline" size={20} color={theme.success} />
                                    }
                                </Pressable>
                            )}
                            {isPast && (
                                <>
                                    <Pressable
                                        onPress={() => router.push({ pathname: "/quiz/[id]/report", params: { id: quiz.id } } as any)}
                                        style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                        accessibilityLabel="View report"
                                    >
                                        <Ionicons name="bar-chart-outline" size={20} color={theme.primary} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => handleDeclareWinners(quiz)}
                                        disabled={declaringId === quiz.id}
                                        style={({ pressed }) => [styles.iconBtn, { opacity: (pressed || declaringId === quiz.id) ? 0.5 : 1 }]}
                                        accessibilityLabel="Declare winners"
                                    >
                                        {declaringId === quiz.id
                                            ? <ActivityIndicator size="small" color={theme.warning} />
                                            : <Ionicons name="trophy-outline" size={20} color={theme.warning} />
                                        }
                                    </Pressable>
                                </>
                            )}
                            <Pressable
                                onPress={() => handleDelete(quiz)}
                                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                accessibilityLabel="Delete quiz"
                            >
                                <Ionicons name="trash-outline" size={20} color={theme.error} />
                            </Pressable>
                        </View>
                    </View>
                );
            })}

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Analytics</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Review enrollments, attempts, and leaderboard trends.</Text>
            </View>

            {/* ── User Sessions ── */}
            <Text style={[styles.sectionHeader, { color: theme.textPrimary }]}>User Sessions</Text>
            <TextInput
                style={[styles.searchInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                placeholder="Search by roll number or name…"
                placeholderTextColor={theme.textMuted}
                value={userSearch}
                onChangeText={setUserSearch}
            />

            {loadingUsers && <ActivityIndicator color={theme.primary} style={styles.loader} />}

            {!loadingUsers && filteredUsers.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users found.</Text>
                </View>
            )}

            {!loadingUsers && filteredUsers.map((user) => (
                <Pressable
                    key={user.userId}
                    onPress={() => router.push({
                        pathname: "/admin/user-sessions",
                        params: { userId: String(user.userId), userName: user.name || user.rollNumber },
                    } as any)}
                    style={({ pressed }) => [
                        styles.userRow,
                        { backgroundColor: theme.surfaceLight, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.quizTitle, { color: theme.textPrimary }]}>{user.name || user.rollNumber}</Text>
                        <Text style={[styles.quizMeta, { color: theme.textSecondary }]}>
                            {user.rollNumber} • {user.role}
                        </Text>
                    </View>
                    <View style={styles.sessionBadges}>
                        <View style={[styles.sessionBadge, { backgroundColor: `${theme.primary}22` }]}>
                            <Text style={[styles.sessionBadgeText, { color: theme.primary }]}>
                                {user.activeSessions} active
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                    </View>
                </Pressable>
            ))}

            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Admin Status</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>You are signed in with admin privileges.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
    title: { marginTop: 8, marginBottom: 12, fontSize: 34, fontWeight: "800" },
    denied: { fontSize: 22, fontWeight: "800" },
    deniedSub: { marginTop: 6, fontSize: 14 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
    cardTitle: { fontSize: 20, fontWeight: "700" },
    cardSub: { marginTop: 6, fontSize: 14, lineHeight: 20 },
    action: {
        marginTop: 12,
        alignSelf: "flex-start",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    actionText: { fontSize: 13, fontWeight: "700" },
    sectionHeader: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginTop: 4 },
    loader: { marginVertical: 16 },
    emptyCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
    emptyText: { fontSize: 14, lineHeight: 20 },
    quizRow: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    quizInfo: { flex: 1 },
    quizTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    quizTitle: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
    quizMeta: { marginTop: 4, fontSize: 12 },
    quizActions: { flexDirection: "row", gap: 4 },
    iconBtn: { padding: 6 },
    pastBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
    pastBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
    searchInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        marginBottom: 10,
    },
    userRow: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    sessionBadges: { flexDirection: "row", alignItems: "center", gap: 6 },
    sessionBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    sessionBadgeText: { fontSize: 12, fontWeight: "700" },
    confirmRow: { marginTop: 6, gap: 6 },
    confirmText: { fontSize: 13, fontWeight: "600" },
    confirmYes: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    confirmYesText: { fontSize: 13, fontWeight: "700" },
    confirmNo: { fontSize: 13, fontWeight: "600" },
});

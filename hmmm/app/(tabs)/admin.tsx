import { adminListUsers, AdminUserItem } from "@/constants/auth-api";
import { getAuthToken, isAdmin } from "@/constants/auth-session";
import { adminDeclareWinners, adminDeleteQuiz, adminListQuizzes, adminStartQuiz, adminUpdateQuizSchedule, adminUpdateQuizVisibility, QuizListItem } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type QuizFilter = "all" | "live" | "scheduled" | "past";

export default function AdminTab() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [declaringId, setDeclaringId] = useState<string | null>(null);
    const [confirmDeclareId, setConfirmDeclareId] = useState<string | null>(null);
    const [startingId, setStartingId] = useState<string | null>(null);
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [editingStartsAt, setEditingStartsAt] = useState("");
    const [editingDuration, setEditingDuration] = useState("");
    const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
    const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<string | null>(null);
    const [activeQuizFilter, setActiveQuizFilter] = useState<QuizFilter>("all");
    const [openMenuQuizId, setOpenMenuQuizId] = useState<string | null>(null);

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
                .catch(() => { })
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
                            adminListQuizzes().then(setQuizzes).catch(() => { });
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
            adminListQuizzes().then(setQuizzes).catch(() => { });
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to declare winners.");
        } finally {
            setDeclaringId(null);
        }
    };

    const toLocalDateTimeInput = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const beginEditSchedule = (quiz: QuizListItem) => {
        setEditingScheduleId(quiz.id);
        setEditingStartsAt(toLocalDateTimeInput(quiz.startsAtIso));
        setEditingDuration(String(quiz.durationMinutes));
    };

    const saveSchedule = async (quizId: string) => {
        const startsAtDate = new Date(editingStartsAt);
        if (isNaN(startsAtDate.getTime())) {
            Alert.alert("Invalid date", "Please enter a valid date/time in format YYYY-MM-DDTHH:MM");
            return;
        }
        const duration = parseInt(editingDuration);
        if (isNaN(duration) || duration < 1) {
            Alert.alert("Invalid duration", "Duration must be a positive number.");
            return;
        }

        setSavingScheduleId(quizId);
        try {
            await adminUpdateQuizSchedule(quizId, {
                startsAt: startsAtDate.toISOString(),
                durationMinutes: duration,
            });
            Alert.alert("Updated", "Quiz schedule updated.");
            setEditingScheduleId(null);
            adminListQuizzes().then(setQuizzes).catch(() => { });
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to update quiz schedule.");
        } finally {
            setSavingScheduleId(null);
        }
    };

    const toggleVisibility = async (quiz: QuizListItem) => {
        const nextVisible = !(quiz.isVisible ?? true);
        setVisibilityUpdatingId(quiz.id);
        try {
            await adminUpdateQuizVisibility(quiz.id, nextVisible);
            setQuizzes((prev) =>
                prev.map((q) => (q.id === quiz.id ? { ...q, isVisible: nextVisible } : q))
            );
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to update visibility.");
        } finally {
            setVisibilityUpdatingId(null);
        }
    };

    const getQuizStatus = (quiz: QuizListItem) => {
        const now = new Date();
        const startsAt = new Date(quiz.startsAtIso);
        if (startsAt < now) {
            return { key: "past" as const, label: "PAST", color: theme.textSecondary, background: theme.surface };
        }
        if (quiz.isVisible === false) {
            return { key: "scheduled" as const, label: "DRAFT", color: theme.textMuted, background: theme.surface };
        }
        if (startsAt.getTime() > now.getTime()) {
            return { key: "scheduled" as const, label: "SCHEDULED", color: theme.warning, background: `${theme.warning}18` };
        }
        return { key: "live" as const, label: "LIVE", color: theme.success, background: `${theme.success}18` };
    };

    const filteredQuizzes = useMemo(() => {
        return quizzes.filter((quiz) => {
            if (activeQuizFilter === "all") return true;
            const status = getQuizStatus(quiz).key;
            return status === activeQuizFilter;
        });
    }, [activeQuizFilter, quizzes]);

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
                <View style={styles.quizHeaderRow}>
                    <View style={styles.quizHeaderCopy}>
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Quiz Management</Text>
                        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Create, publish, and monitor quizzes.</Text>
                    </View>
                    <Pressable
                        onPress={() => router.push("/create-quiz" as any)}
                        style={({ pressed }) => [
                            styles.createQuizButton,
                            { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.92 : 1 },
                        ]}
                    >
                        <Ionicons name="add" size={18} color={theme.textInverse} />
                        <Text style={[styles.createQuizButtonText, { color: theme.textInverse }]}>Create Quiz</Text>
                    </Pressable>
                </View>
            </View>

            {/* ── Quiz list ── */}
            <View style={styles.listHeaderRow}>
                <Text style={[styles.sectionHeader, { color: theme.textPrimary }]}>Your Quizzes</Text>
                <Text style={[styles.listCount, { color: theme.textSecondary }]}>{filteredQuizzes.length} shown</Text>
            </View>

            <View style={styles.filterRow}>
                {([
                    { key: "all", label: "All" },
                    { key: "live", label: "Live" },
                    { key: "scheduled", label: "Scheduled" },
                    { key: "past", label: "Past" },
                ] as const).map((filter) => (
                    <Pressable
                        key={filter.key}
                        onPress={() => {
                            setActiveQuizFilter(filter.key);
                            setOpenMenuQuizId(null);
                        }}
                        style={({ pressed }) => [
                            styles.filterChip,
                            {
                                backgroundColor: activeQuizFilter === filter.key ? theme.primary : theme.surfaceLight,
                                borderColor: theme.border,
                                opacity: pressed ? 0.9 : 1,
                            },
                        ]}
                    >
                        <Text style={[styles.filterChipText, { color: activeQuizFilter === filter.key ? theme.textInverse : theme.textPrimary }]}>
                            {filter.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {loadingQuizzes && <ActivityIndicator color={theme.primary} style={styles.loader} />}

            {!loadingQuizzes && quizzes.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No quizzes yet. Tap "Open Creator" to create your first quiz.</Text>
                </View>
            )}

            {!loadingQuizzes && filteredQuizzes.map((quiz) => {
                const status = getQuizStatus(quiz);
                const isPast = status.key === "past";
                const isOpenMenu = openMenuQuizId === quiz.id;
                const showStart = !isPast;
                return (
                    <View
                        key={quiz.id}
                        style={[styles.quizRow, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
                    >
                        <View style={styles.quizInfo}>
                            <View style={styles.quizTitleRow}>
                                <Text style={[styles.quizTitle, { color: theme.textPrimary }]} numberOfLines={1}>{quiz.title}</Text>
                                <View style={[styles.statusBadge, { backgroundColor: status.background, borderColor: theme.border }]}> 
                                    <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                                </View>
                            </View>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                                {quiz.category} • {quiz.level}
                            </Text>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                                📅 {new Date(quiz.startsAtIso).toLocaleDateString()} • ⏰ {new Date(quiz.startsAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                            <Text style={[styles.quizMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                                👥 {quiz.enrolledCount ?? 0} enrolled • {(quiz.isVisible ?? true) ? "👁 Visible" : "◼ Draft"}
                            </Text>

                            {editingScheduleId === quiz.id && (
                                <View style={[styles.editScheduleBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                                    <Text style={[styles.confirmText, { color: theme.textPrimary }]}>Edit start date/time</Text>
                                    <TextInput
                                        style={[styles.scheduleInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
                                        value={editingStartsAt}
                                        onChangeText={setEditingStartsAt}
                                        placeholder="YYYY-MM-DDTHH:MM"
                                        placeholderTextColor={theme.textMuted}
                                        autoCapitalize="none"
                                    />
                                    <Text style={[styles.confirmText, { color: theme.textPrimary }]}>Duration (minutes)</Text>
                                    <TextInput
                                        style={[styles.scheduleInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.background }]}
                                        value={editingDuration}
                                        onChangeText={setEditingDuration}
                                        keyboardType="numeric"
                                        placeholder="30"
                                        placeholderTextColor={theme.textMuted}
                                    />
                                    <View style={styles.editActionsRow}>
                                        <Pressable
                                            onPress={() => saveSchedule(quiz.id)}
                                            disabled={savingScheduleId === quiz.id}
                                            style={[styles.confirmYes, { backgroundColor: theme.primary, opacity: savingScheduleId === quiz.id ? 0.6 : 1 }]}
                                        >
                                            <Text style={[styles.confirmYesText, { color: theme.textInverse }]}>Save</Text>
                                        </Pressable>
                                        <Pressable onPress={() => setEditingScheduleId(null)}>
                                            <Text style={[styles.confirmNo, { color: theme.textSecondary }]}>Cancel</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            )}

                            {/* Inline declare-winners confirmation (web-safe) */}
                            {confirmDeclareId === quiz.id && (
                                <View style={styles.confirmRow}>
                                    <Text style={[styles.confirmText, { color: theme.textPrimary }]}>Declare winners? Cannot be undone.</Text>
                                    <Pressable
                                        onPress={() => doDeclareWinners(quiz.id)}
                                style={({ pressed }) => [styles.primaryActionBtn, { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 }]}
                                    >
                                        <Text style={[styles.confirmYesText, { color: "#2d2500" }]}>Yes, Declare</Text>
                                <Ionicons name="eye-outline" size={16} color={theme.primary} />
                                <Text style={[styles.primaryActionText, { color: theme.primary }]}>View</Text>
                                    <Pressable onPress={() => setConfirmDeclareId(null)}>
                                    </Pressable>
                                onPress={() => router.push({ pathname: "/admin/edit/[id]", params: { id: quiz.id } } as any)}
                                style={({ pressed }) => [styles.primaryActionBtn, { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 }]}
                                accessibilityLabel="Edit metadata"
                        <View style={styles.quizActions}>
                                <Ionicons name="pencil-outline" size={16} color={theme.primary} />
                                <Text style={[styles.primaryActionText, { color: theme.primary }]}>Edit</Text>
                                onPress={() => router.push({ pathname: "/quiz/[id]", params: { id: quiz.id } } as any)}
                                style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
                                onPress={() => showStart ? handleStartQuiz(quiz) : router.push({ pathname: "/quiz/[id]/report", params: { id: quiz.id } } as any)}
                                disabled={startingId === quiz.id}
                                style={({ pressed }) => [styles.primaryActionBtn, { backgroundColor: showStart ? theme.success : theme.buttonPrimary, opacity: (pressed || startingId === quiz.id) ? 0.85 : 1 }]}
                                accessibilityLabel={showStart ? "Start quiz" : "View report"}
                            </Pressable>
                                {showStart ? <Ionicons name="play" size={16} color={theme.textInverse} /> : <Ionicons name="bar-chart-outline" size={16} color={theme.textInverse} />}
                                <Text style={[styles.primaryActionText, { color: theme.textInverse }]}>{showStart ? "Start" : "Report"}</Text>
                            <Pressable
                                onPress={() => router.push({ pathname: "/quiz/[id]/manage-questions", params: { id: quiz.id } } as any)}
                                onPress={() => setOpenMenuQuizId((current) => (current === quiz.id ? null : quiz.id))}
                                style={({ pressed }) => [styles.menuButton, { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 }]}
                                accessibilityLabel="Open more actions"
                                <Ionicons name="list-outline" size={20} color={theme.primary} />
                                <Ionicons name="ellipsis-horizontal" size={16} color={theme.textPrimary} />
                                <Text style={[styles.primaryActionText, { color: theme.textPrimary }]}>More</Text>
                            <Pressable
                                            ? <ActivityIndicator size="small" color={theme.warning} />

                        {isOpenMenu && (
                            <View style={[styles.menuPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                                <Pressable onPress={() => { setOpenMenuQuizId(null); beginEditSchedule(quiz); }} style={styles.menuItem}>
                                    <Ionicons name="calendar-outline" size={16} color={theme.primary} />
                                    <Text style={[styles.menuText, { color: theme.textPrimary }]}>Schedule</Text>
                                </Pressable>
                                <Pressable onPress={() => { setOpenMenuQuizId(null); router.push({ pathname: "/admin/enrollments/[id]", params: { id: quiz.id } } as any); }} style={styles.menuItem}>
                                    <Ionicons name="people-outline" size={16} color={theme.primary} />
                                    <Text style={[styles.menuText, { color: theme.textPrimary }]}>Manage Users</Text>
                                </Pressable>
                                <Pressable onPress={() => { setOpenMenuQuizId(null); toggleVisibility(quiz); }} style={styles.menuItem}>
                                    <Ionicons name={(quiz.isVisible ?? true) ? "eye-off-outline" : "eye-outline"} size={16} color={theme.primary} />
                                    <Text style={[styles.menuText, { color: theme.textPrimary }]}>{(quiz.isVisible ?? true) ? "Hide quiz" : "Make visible"}</Text>
                                </Pressable>
                                <Pressable onPress={() => { setOpenMenuQuizId(null); router.push({ pathname: "/quiz/[id]/report", params: { id: quiz.id } } as any); }} style={styles.menuItem}>
                                    <Ionicons name="bar-chart-outline" size={16} color={theme.primary} />
                                    <Text style={[styles.menuText, { color: theme.textPrimary }]}>Analytics</Text>
                                </Pressable>
                                <Pressable onPress={() => { setOpenMenuQuizId(null); router.push({ pathname: "/quiz/[id]/manage-questions", params: { id: quiz.id } } as any); }} style={styles.menuItem}>
                                    <Ionicons name="list-outline" size={16} color={theme.primary} />
                                    <Text style={[styles.menuText, { color: theme.textPrimary }]}>Manage Questions</Text>
                                </Pressable>
                                {isPast && (
                                    <Pressable onPress={() => { setOpenMenuQuizId(null); handleDeclareWinners(quiz); }} style={styles.menuItem}>
                                        <Ionicons name="trophy-outline" size={16} color={theme.warning} />
                                        <Text style={[styles.menuText, { color: theme.textPrimary }]}>Declare winners</Text>
                                    </Pressable>
                                )}
                                <Pressable onPress={() => { setOpenMenuQuizId(null); handleDelete(quiz); }} style={styles.menuItem}>
                                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                                    <Text style={[styles.menuText, { color: theme.error }]}>Delete</Text>
                                </Pressable>
                            </View>
                        )}
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
    quizHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    quizHeaderCopy: { flex: 1 },
    createQuizButton: {
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    createQuizButtonText: { fontSize: 13, fontWeight: "800" },
    listHeaderRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8, marginTop: 4 },
    listCount: { fontSize: 12, fontWeight: "600" },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    filterChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
        minHeight: 40,
        justifyContent: "center",
    },
    filterChipText: { fontSize: 13, fontWeight: "800" },
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
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        gap: 12,
    },
    quizInfo: { flex: 1 },
    quizTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    quizTitle: { fontSize: 17, fontWeight: "800", flexShrink: 1 },
    statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
    quizMeta: { marginTop: 5, fontSize: 12, lineHeight: 17 },
    quizActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 },
    primaryActionBtn: {
        minHeight: 40,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    primaryActionText: { fontSize: 12, fontWeight: "800" },
    menuButton: {
        minHeight: 40,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    menuPanel: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
        gap: 4,
    },
    menuItem: {
        minHeight: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    menuText: { fontSize: 13, fontWeight: "700" },
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
    editScheduleBox: {
        marginTop: 8,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        gap: 6,
    },
    scheduleInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 13,
    },
    editActionsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
});

import { adminFetchQuizEnrollments, adminRemoveQuizEnrollment, fetchQuizDetail } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuizEnrollmentsScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const quizId = Array.isArray(id) ? id[0] : id;

    const [quiz, setQuiz] = useState<any>(null);
    const [enrollmentData, setEnrollmentData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
    const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<number | null>(null);
    const [removingUserId, setRemovingUserId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (quizId) {
                const [quizDetail, enrollments] = await Promise.all([
                    fetchQuizDetail(quizId),
                    adminFetchQuizEnrollments(quizId),
                ]);
                setQuiz(quizDetail);
                setEnrollmentData(enrollments);
            }
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to load enrollments");
            router.back();
        } finally {
            setLoading(false);
        }
    }, [quizId]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredEnrollments = useMemo(() => {
        const enrollments = enrollmentData?.enrollments ?? [];
        const query = searchQuery.trim().toLowerCase();

        const matched = query
            ? enrollments.filter((enrollment: any) => {
                const fieldValues = enrollment.formResponses
                    ? Object.values(enrollment.formResponses).join(" ")
                    : "";
                return [enrollment.name, enrollment.rollNumber, fieldValues]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query);
            })
            : enrollments;

        return [...matched].sort((a: any, b: any) => {
            const timeA = new Date(a.enrolledAt).getTime();
            const timeB = new Date(b.enrolledAt).getTime();
            return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
        });
    }, [enrollmentData, searchQuery, sortOrder]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (!enrollmentData || enrollmentData.enrollments.length === 0) {
        return (
            <View style={[styles.root, { backgroundColor: theme.background }]}>
                <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 20 }}>
                    <Pressable onPress={() => router.back()}>
                        <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
                    </Pressable>
                    <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Enrollments</Text>
                </View>
                <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No enrollments yet</Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        Enrolled users will appear here once they register for this quiz.
                    </Text>
                </View>
            </View>
        );
    }

    const renderEnrollment = ({ item }: { item: any }) => (
        <Pressable
            onPress={() => setExpandedEnrollmentId((current) => (current === item.userId ? null : item.userId))}
            style={({ pressed }) => [
                styles.enrollmentCard,
                {
                    backgroundColor: expandedEnrollmentId === item.userId ? theme.surface : theme.surfaceLight,
                    borderColor: theme.border,
                    opacity: pressed ? 0.96 : 1,
                },
            ]}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: `${theme.primary}18` }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>
                        {(item.name || item.rollNumber || "?")
                            .trim()
                            .split(/\s+/)
                            .map((part: string) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                    </Text>
                </View>

                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.name || item.rollNumber}
                    </Text>
                    <Text style={[styles.rollNumber, { color: theme.textSecondary }]} numberOfLines={1}>
                        🆔 {item.rollNumber}
                    </Text>
                </View>

                <View style={styles.metaRight}>
                    <Text style={[styles.enrollDate, { color: theme.textMuted }]}>
                        {new Date(item.enrolledAt).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.chevron, { color: theme.primary }]}>›</Text>
                </View>
            </View>

            <View style={styles.actionsRow}>
                <View style={[styles.actionPill, { backgroundColor: `${theme.primary}12`, borderColor: theme.border }]}>
                    <Text style={[styles.actionPillText, { color: theme.primary }]}>View details</Text>
                </View>
                <Pressable
                    disabled={removingUserId === item.userId}
                    onPress={() => {
                        const doRemove = async () => {
                            if (!quizId) return;
                            setRemovingUserId(item.userId);
                            try {
                                await adminRemoveQuizEnrollment(quizId, item.userId);
                                setEnrollmentData((prev: any) => {
                                    if (!prev) return prev;
                                    const nextEnrollments = (prev.enrollments ?? []).filter((e: any) => e.userId !== item.userId);
                                    return {
                                        ...prev,
                                        totalEnrolled: Math.max(0, Number(prev.totalEnrolled ?? 0) - 1),
                                        enrollments: nextEnrollments,
                                    };
                                });
                                if (expandedEnrollmentId === item.userId) {
                                    setExpandedEnrollmentId(null);
                                }
                            } catch (err: any) {
                                Alert.alert("Cannot remove", err?.message || "Failed to remove enrollment.");
                            } finally {
                                setRemovingUserId(null);
                            }
                        };

                        const label = item.name || item.rollNumber;
                        if (typeof window !== "undefined") {
                            const ok = window.confirm(`Remove ${label} from this quiz?`);
                            if (!ok) return;
                            void doRemove();
                            return;
                        }

                        Alert.alert(
                            "Remove Enrollment",
                            `Remove ${label} from this quiz?`,
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Remove",
                                    style: "destructive",
                                    onPress: () => {
                                        void doRemove();
                                    },
                                },
                            ],
                        );
                    }}
                    style={[styles.actionPill, { backgroundColor: `${theme.error}14`, borderColor: theme.border }]}
                >
                    <Text style={[styles.actionPillText, { color: theme.error }]}> {removingUserId === item.userId ? "Removing..." : "Remove"} </Text>
                </Pressable>
            </View>

            {expandedEnrollmentId === item.userId && enrollmentData.formFields?.length > 0 && (
                <View style={styles.formDataSection}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Registration details</Text>
                    {enrollmentData.formFields.map((field: any) => (
                        <View key={field.id} style={styles.formFieldRow}>
                            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{field.label}</Text>
                            <Text style={[styles.fieldValue, { color: theme.textPrimary }]} numberOfLines={2}>
                                {item.formResponses?.[field.id] || "—"}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </Pressable>
    );

    const totalShown = filteredEnrollments.length;

    return (
        <View style={[styles.root, { backgroundColor: theme.background }]}>
            <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 16 }}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[styles.backButton, { color: theme.primary }]}>← Back</Text>
                </Pressable>
                <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>Enrollments</Text>
                {quiz && (
                    <Text style={[styles.quizTitle, { color: theme.textSecondary }]} numberOfLines={2}>
                        {quiz.title}
                    </Text>
                )}
                <View style={[styles.stats, { borderColor: theme.border }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: theme.primary }]}>{enrollmentData.totalEnrolled}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total users</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: theme.primary }]}>{totalShown}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Shown</Text>
                    </View>
                </View>

                <View style={[styles.controlPanel, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search by name, roll number, or form data"
                        placeholderTextColor={theme.textMuted}
                        style={[styles.searchInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
                    />

                    <View style={styles.sortRow}>
                        {([
                            { key: "newest", label: "Newest" },
                            { key: "oldest", label: "Oldest" },
                        ] as const).map((option) => (
                            <Pressable
                                key={option.key}
                                onPress={() => setSortOrder(option.key)}
                                style={[
                                    styles.sortChip,
                                    {
                                        backgroundColor: sortOrder === option.key ? theme.primary : theme.surface,
                                        borderColor: theme.border,
                                    },
                                ]}
                            >
                                <Text style={[styles.sortChipText, { color: sortOrder === option.key ? theme.textInverse : theme.textPrimary }]}>
                                    {option.label}
                                </Text>
                            </Pressable>
                        ))}
                        <Pressable
                            onPress={() => {
                                setSearchQuery("");
                                setSortOrder("newest");
                            }}
                            style={[styles.clearChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        >
                            <Text style={[styles.sortChipText, { color: theme.textSecondary }]}>Clear</Text>
                        </Pressable>
                    </View>
                </View>
            </View>

            <FlatList
                data={filteredEnrollments}
                renderItem={renderEnrollment}
                keyExtractor={(item) => String(item.userId)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
                scrollEnabled
                nestedScrollEnabled
                ListEmptyComponent={(
                    <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                        <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No matching enrollments</Text>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Try a different search term or clear the filters.</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    backButton: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
    pageTitle: { fontSize: 28, fontWeight: "800", marginBottom: 6 },
    quizTitle: { fontSize: 14, marginBottom: 14 },
    stats: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
    statItem: { flex: 1, alignItems: "center" },
    statDivider: { width: 1, height: 30, marginHorizontal: 12, opacity: 0.35 },
    statValue: { fontSize: 24, fontWeight: "800" },
    statLabel: { fontSize: 12, marginTop: 4, fontWeight: "500" },
    controlPanel: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 14, gap: 10 },
    searchInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
    },
    sortRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    sortChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    clearChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    sortChipText: { fontSize: 13, fontWeight: "700" },
    enrollmentCard: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
    userInfo: { flex: 1, gap: 2 },
    userName: { fontSize: 16, fontWeight: "800" },
    rollNumber: { fontSize: 13, fontWeight: "600" },
    metaRight: { alignItems: "flex-end", gap: 4 },
    enrollDate: { fontSize: 12, fontWeight: "600" },
    chevron: { fontSize: 24, lineHeight: 20, fontWeight: "300" },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
    actionPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    actionPillText: { fontSize: 12, fontWeight: "700" },
    formDataSection: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 10 },
    detailLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
    formFieldRow: { gap: 4 },
    fieldLabel: { fontSize: 12, fontWeight: "600" },
    fieldValue: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
    emptyCard: { borderWidth: 1, borderRadius: 14, padding: 20, marginTop: 8, alignItems: "center" },
    emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
    emptyText: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});

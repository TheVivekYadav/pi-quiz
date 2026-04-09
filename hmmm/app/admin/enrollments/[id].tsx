import { adminFetchQuizEnrollments, fetchQuizDetail } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
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
        <View style={[styles.enrollmentCard, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={[styles.rollNumber, { color: theme.textSecondary }]}>{item.rollNumber}</Text>
                </View>
                <Text style={[styles.enrollDate, { color: theme.textMuted }]}>
                    {new Date(item.enrolledAt).toLocaleDateString()}
                </Text>
            </View>

            {enrollmentData.formFields && enrollmentData.formFields.length > 0 && (
                <View style={styles.formDataSection}>
                    {enrollmentData.formFields.map((field: any) => (
                        <View key={field.id} style={styles.formFieldRow}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                                {field.label}
                            </Text>
                            <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                                {item.formResponses?.[field.id] || "—"}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

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
                        <Text style={[styles.statValue, { color: theme.primary }]}>
                            {enrollmentData.totalEnrolled}
                        </Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Enrolled</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={enrollmentData.enrollments}
                renderItem={renderEnrollment}
                keyExtractor={(item) => String(item.userId)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
                scrollEnabled
                nestedScrollEnabled
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
    stats: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
    statItem: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 24, fontWeight: "800" },
    statLabel: { fontSize: 12, marginTop: 4, fontWeight: "500" },
    enrollmentCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
    rollNumber: { fontSize: 13, fontWeight: "500" },
    enrollDate: { fontSize: 12, fontWeight: "500" },
    formDataSection: { borderTopWidth: 1, paddingTop: 12 },
    formFieldRow: { marginBottom: 10 },
    fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
    fieldValue: { fontSize: 13, fontWeight: "500" },
    emptyCard: { borderWidth: 1, borderRadius: 12, padding: 20, margin: 16, alignItems: "center" },
    emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
    emptyText: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});

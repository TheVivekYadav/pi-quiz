import { apiUrl } from "@/constants/api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Form = {
  id: string;
  title: string;
  fields: unknown[];
};

export default function FormsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  const shareFillUrl = async (formId: string) => {
    const appUrl = `hmmm://fill/${formId}`;
    const webUrl = `https://pit.engineer/fill/${formId}`;

    await Share.share({
      message: `Fill form\n\nApp: ${appUrl}\nWeb fallback: ${webUrl}`,
    });
  };

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const res = await fetch(apiUrl("/forms"));
        const data = await res.json();
        setForms(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch forms", err);
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 10,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
      }}
    >
      <Text style={[styles.eyebrow, { color: theme.primary }]}>WORKSPACE</Text>
      <Text style={[styles.title, { color: theme.textPrimary }]}>My Forms</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Manage all active forms, copy links, and view submissions.</Text>

      {loading && <ActivityIndicator size="large" color={theme.primary} />}

      {!loading && forms.length === 0 && (
        <View style={[styles.emptyState, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}>
          <Ionicons name="documents-outline" size={28} color={theme.primary} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No forms yet</Text>
          <Text style={[styles.emptyMeta, { color: theme.textMuted }]}>Create your first form and start collecting responses.</Text>
        </View>
      )}

      {forms.map((form) => (
        <Pressable
          key={form.id}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surfaceLight,
              borderColor: theme.border,
              shadowColor: theme.shadow,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={() => router.push(`/fill/${form.id}`)}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.formTitle, { color: theme.textPrimary }]}>{form.title}</Text>
            <View style={[styles.badge, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>LIVE</Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: theme.textMuted }]}>{form.fields.length} fields</Text>

          <View style={styles.actionGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.actionPrimary,
                { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push(`/fill/${form.id}`);
              }}
            >
              <Ionicons name="pencil-outline" size={14} color={theme.textInverse} />
              <Text style={[styles.actionPrimaryText, { color: theme.textInverse }]}>Fill</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionSecondary,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                shareFillUrl(form.id);
              }}
            >
              <Ionicons name="share-social-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.actionSecondaryText, { color: theme.textSecondary }]}>Share</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionSecondary,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push(`/responses/${form.id}`);
              }}
            >
              <Ionicons name="bar-chart-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.actionSecondaryText, { color: theme.textSecondary }]}>Responses</Text>
            </Pressable>
          </View>
        </Pressable>
      ))}

      <Pressable
        style={({ pressed }) => [
          styles.createBtn,
          { backgroundColor: theme.buttonPrimary, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push("/create")}
      >
        <Ionicons name="add" size={18} color={theme.textInverse} />
        <Text style={[styles.createBtnText, { color: theme.textInverse }]}>Create New Form</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyMeta: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 14,
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  meta: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 8,
  },
  actionPrimary: {
    borderRadius: 10,
    paddingVertical: 10,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionSecondary: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  createBtn: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
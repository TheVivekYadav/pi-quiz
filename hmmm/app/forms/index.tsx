import { useTheme } from "@/hook/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Form = {
  id: string;
  title: string;
  fields: any[];
};

export default function FormsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  const shareFillUrl = async (formId: string) => {
    const appUrl = `hmmm://fill/${formId}`;
    const webUrl = `https://hmmm.expo.app/fill/${formId}`;

    await Share.share({
      message: `Fill form\n\nApp: ${appUrl}\nWeb fallback: ${webUrl}`,
    });
  };

  // ✅ Fetch all forms
  useEffect(() => {
    const fetchForms = async () => {
      try {
        const res = await fetch("http://10.41.53.22:3000/forms");
        const data = await res.json();
        setForms(data);
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
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingHorizontal: 10,
          backgroundColor: theme.background,
        },
      ]}
    >
      <Text style={styles.title}>My Forms</Text>

      {/* Loading */}
      {loading && <ActivityIndicator size="large" />}

      {/* Empty state */}
      {!loading && forms.length === 0 && (
        <Text>No forms created yet</Text>
      )}

      {/* Forms List */}
      {forms.map((form) => (
        <TouchableOpacity
          key={form.id}
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => router.push(`/fill/${form.id}`)}
        >
          <Text style={styles.formTitle}>{form.title}</Text>
          <Text style={styles.meta}>
            {form.fields.length} fields
          </Text>

          <TouchableOpacity
            style={styles.fillBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/fill/${form.id}`);
            }}
          >
            <Text style={styles.fillBtnText}>Fill Form</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              shareFillUrl(form.id);
            }}
          >
            <Text style={styles.linkBtnText}>Get URL</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {/* Create Button */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => router.push("/create")}
      >
        <Text style={{ color: "white" }}>+ Create New Form</Text>
      </TouchableOpacity>
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
  card: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    marginTop: 5,
    color: "gray",
  },
  createBtn: {
    backgroundColor: "black",
    padding: 15,
    alignItems: "center",
    borderRadius: 8,
    marginTop: 20,
  },
  fillBtn: {
    marginTop: 12,
    backgroundColor: "black",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  fillBtnText: {
    color: "white",
    fontWeight: "600",
  },
  linkBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  linkBtnText: {
    color: "#111",
    fontWeight: "600",
  },
});
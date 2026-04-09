import { adminGetDatabaseTables, adminGetTableSchema, adminGetTableRecords, adminCreateTableRecord, adminUpdateTableRecord, adminDeleteTableRecord } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TableInfo {
  name: string;
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

export default function DatabaseBrowser() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [schema, setSchema] = useState<Column[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadSchema();
      loadRecords();
    }
  }, [selectedTable]);

  const loadTables = async () => {
    try {
      const data = await adminGetDatabaseTables();
      setTables(data);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  };

  const loadSchema = async () => {
    if (!selectedTable) return;
    try {
      const data = await adminGetTableSchema(selectedTable);
      setSchema(data.columns);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load schema");
    }
  };

  const loadRecords = async () => {
    if (!selectedTable) return;
    setLoadingRecords(true);
    try {
      const data = await adminGetTableRecords(selectedTable, limit, offset);
      setRecords(data.records);
      setTotalRecords(data.total);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load records");
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!selectedTable) return;

    try {
      if (editingRecord) {
        await adminUpdateTableRecord(selectedTable, editingRecord.id, formData);
        Alert.alert("Success", "Record updated");
      } else {
        await adminCreateTableRecord(selectedTable, formData);
        Alert.alert("Success", "Record created");
      }
      setShowNewRecord(false);
      setEditingRecord(null);
      setFormData({});
      loadRecords();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save record");
    }
  };

  const handleDeleteRecord = (record: any) => {
    if (!selectedTable) return;

    Alert.alert("Delete Record", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await adminDeleteTableRecord(selectedTable, record.id);
            Alert.alert("Success", "Record deleted");
            loadRecords();
          } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to delete record");
          }
        },
      },
    ]);
  };

  const openEditRecord = (record: any) => {
    setEditingRecord(record);
    setFormData(record);
    setShowNewRecord(true);
  };

  const closeModal = () => {
    setShowNewRecord(false);
    setEditingRecord(null);
    setFormData({});
  };

  const renderTableSelector = () => (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </Pressable>
        <Text style={[styles.headerText, { color: theme.textPrimary }]}>Database Browser</Text>
        <View style={{ width: 24 }} />
      </View>

      {loadingTables ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedTable(item.name)}
              style={[styles.tableButton, { backgroundColor: theme.border }]}
            >
              <Text style={[styles.tableButtonText, { color: theme.textPrimary }]}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );

  if (!selectedTable) {
    return renderTableSelector();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setSelectedTable(null)}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </Pressable>
        <Text style={[styles.headerText, { color: theme.textPrimary }]}>
          {selectedTable} ({totalRecords})
        </Text>
        <Pressable onPress={() => { setShowNewRecord(true); setFormData({}); setEditingRecord(null); }}>
          <Ionicons name="add" size={24} color={theme.primary} />
        </Pressable>
      </View>

      {loadingRecords ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {records.map((record, idx) => (
            <View key={idx} style={[styles.recordCard, { backgroundColor: theme.border }]}>
              <View style={styles.recordContent}>
                {Object.entries(record).map(([key, value]) => (
                  <View key={key} style={styles.recordField}>
                    <Text style={[styles.fieldName, { color: theme.textSecondary }]}>{key}:</Text>
                    <Text style={[styles.fieldValue, { color: theme.textPrimary }]}>
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value).substring(0, 50)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.recordActions}>
                <Pressable onPress={() => openEditRecord(record)} style={[styles.actionBtn, { backgroundColor: `${theme.primary}20` }]}>
                  <Ionicons name="pencil" size={16} color={theme.primary} />
                </Pressable>
                <Pressable onPress={() => handleDeleteRecord(record)} style={[styles.actionBtn, { backgroundColor: `${theme.error}20` }]}>
                  <Ionicons name="trash" size={16} color={theme.error} />
                </Pressable>
              </View>
            </View>
          ))}

          {records.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No records found
            </Text>
          )}

          {totalRecords > records.length && (
            <Pressable
              onPress={() => setOffset(offset + limit)}
              style={[styles.loadMoreBtn, { backgroundColor: theme.border }]}
            >
              <Text style={[styles.loadMoreText, { color: theme.primary }]}>
                Load More ({offset + records.length} / {totalRecords})
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Add/Edit Record Modal */}
      <Modal visible={showNewRecord} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: `${theme.textMuted}80` }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {editingRecord ? "Edit Record" : "Add Record"}
              </Text>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
              {schema
                .filter((col) => col.name !== "id") // Skip ID fields
                .map((col) => (
                  <View key={col.name} style={styles.formField}>
                    <Text style={[styles.formLabel, { color: theme.textPrimary }]}>
                      {col.name} {!col.nullable && "*"}
                    </Text>
                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: theme.border,
                          color: theme.textPrimary,
                          borderColor: theme.primary,
                        },
                      ]}
                      placeholder={col.type}
                      placeholderTextColor={theme.textSecondary}
                      value={String(formData[col.name] || "")}
                      onChangeText={(text) =>
                        setFormData((prev: any) => ({ ...prev, [col.name]: text }))
                      }
                      multiline={col.type.includes("text")}
                      editable={col.name !== "id"}
                    />
                  </View>
                ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeModal}
                style={[styles.modalBtn, { backgroundColor: theme.border }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveRecord}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  tableButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  tableButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  recordCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  recordContent: {
    marginBottom: 12,
  },
  recordField: {
    marginBottom: 8,
  },
  fieldName: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: 14,
    marginTop: 2,
  },
  recordActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    marginVertical: 20,
  },
  loadMoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 20,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  formScroll: {
    flexGrow: 1,
  },
  formContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

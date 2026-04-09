import { adminCreateTableRecord, adminDeleteTableRecord, adminGetDatabaseTables, adminGetTableRecords, adminGetTableSchema, adminUpdateTableRecord } from "@/constants/quiz-api";
import { useTheme } from "@/hook/theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
    count: number;
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
    const [displayColumns, setDisplayColumns] = useState<string[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [offset, setOffset] = useState(0);
    const [limit] = useState(25);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
    const [nullOnly, setNullOnly] = useState(false);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [showEditor, setShowEditor] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [activeRecord, setActiveRecord] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});

    useEffect(() => {
        loadTables();
    }, []);

    useEffect(() => {
        if (!selectedTable) return;
        setOffset(0);
        setSearch("");
        setRoleFilter("all");
        setNullOnly(false);
        loadSchema();
    }, [selectedTable]);

    useEffect(() => {
        if (!selectedTable) return;
        loadRecords();
    }, [selectedTable, offset, roleFilter, nullOnly, sortDir]);

    useEffect(() => {
        if (!selectedTable) return;
        const timer = setTimeout(() => {
            setOffset(0);
            loadRecords();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

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
            const data = await adminGetTableRecords(selectedTable, limit, offset, {
                search: search.trim() || undefined,
                role: selectedTable === "users" && roleFilter !== "all" ? roleFilter : undefined,
                nullOnly,
                sortBy: schema.some((c) => c.name === "created_at") ? "created_at" : "id",
                sortDir,
            });
            setRecords(data.records);
            setTotalRecords(data.total);
            setDisplayColumns(data.displayColumns || []);
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to load records");
        } finally {
            setLoadingRecords(false);
        }
    };

    const prettyValue = (value: any) => {
        if (value === null || value === undefined || value === "") return "—";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
    };

    const coerceValue = (rawValue: string, column: Column) => {
        const v = rawValue.trim();
        if (!v) return column.nullable ? null : "";

        const t = column.type.toLowerCase();
        if (t.includes("int") || t.includes("numeric") || t.includes("double") || t.includes("real")) {
            const n = Number(v);
            return Number.isNaN(n) ? v : n;
        }
        if (t.includes("bool")) {
            if (v.toLowerCase() === "true") return true;
            if (v.toLowerCase() === "false") return false;
        }
        if (t.includes("json")) {
            try {
                return JSON.parse(v);
            } catch {
                return v;
            }
        }
        return v;
    };

    const visibleColumns = useMemo(() => {
        if (displayColumns.length > 0) return displayColumns;
        return schema.slice(0, 4).map((c) => c.name);
    }, [displayColumns, schema]);

    const hasPrev = offset > 0;
    const hasNext = offset + records.length < totalRecords;

    const openCreate = () => {
        setEditingRecord(null);
        setFormData({});
        setShowEditor(true);
    };

    const openEdit = (record: any) => {
        setEditingRecord(record);
        setFormData(record);
        setShowEditor(true);
    };

    const confirmDelete = (record: any) => {
        setDeleteTarget(record);
    };

    const performDelete = async () => {
        if (!selectedTable || !deleteTarget) return;
        setDeleting(true);
        try {
            await adminDeleteTableRecord(selectedTable, String(deleteTarget.id));
            setShowDetail(false);
            setDeleteTarget(null);
            await loadTables();
            await loadRecords();
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to delete record");
        } finally {
            setDeleting(false);
        }
    };

    const saveRecord = async () => {
        if (!selectedTable) return;

        const payload: Record<string, any> = {};
        schema
            .filter((col) => col.name !== "id")
            .forEach((col) => {
                payload[col.name] = coerceValue(String(formData[col.name] ?? ""), col);
            });

        try {
            if (editingRecord) {
                await adminUpdateTableRecord(selectedTable, String(editingRecord.id), payload);
            } else {
                await adminCreateTableRecord(selectedTable, payload);
            }
            setShowEditor(false);
            setEditingRecord(null);
            setFormData({});
            await loadTables();
            await loadRecords();
        } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to save record");
        }
    };

    if (!selectedTable) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={22} color={theme.primary} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Data Explorer</Text>
                    <View style={{ width: 22 }} />
                </View>

                {loadingTables ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                ) : (
                    <ScrollView contentContainerStyle={styles.tableListWrap}>
                        {tables.map((item) => (
                            <Pressable
                                key={item.name}
                                onPress={() => setSelectedTable(item.name)}
                                style={[styles.tableRow, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
                            >
                                <Text style={[styles.tableName, { color: theme.textPrimary }]}>{item.name}</Text>
                                <View style={[styles.countPill, { backgroundColor: theme.border }]}>
                                    <Text style={[styles.countText, { color: theme.textSecondary }]}>{item.count}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Pressable onPress={() => setSelectedTable(null)}>
                    <Ionicons name="chevron-back" size={22} color={theme.primary} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{selectedTable}</Text>
                <Pressable onPress={openCreate}>
                    <Ionicons name="add" size={22} color={theme.primary} />
                </Pressable>
            </View>

            <View style={[styles.toolbar, { borderColor: theme.border }]}>
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.searchInput, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surfaceLight }]}
                />

                <View style={styles.filtersRow}>
                    {selectedTable === "users" && (
                        <>
                            {(["all", "admin", "user"] as const).map((role) => (
                                <Pressable
                                    key={role}
                                    onPress={() => {
                                        setOffset(0);
                                        setRoleFilter(role);
                                    }}
                                    style={[
                                        styles.chip,
                                        {
                                            borderColor: theme.border,
                                            backgroundColor: roleFilter === role ? theme.primary : theme.surfaceLight,
                                        },
                                    ]}
                                >
                                    <Text style={{ color: roleFilter === role ? "#fff" : theme.textSecondary, fontSize: 12 }}>{role}</Text>
                                </Pressable>
                            ))}
                        </>
                    )}

                    <Pressable
                        onPress={() => {
                            setOffset(0);
                            setNullOnly((v) => !v);
                        }}
                        style={[styles.chip, { borderColor: theme.border, backgroundColor: nullOnly ? theme.primary : theme.surfaceLight }]}
                    >
                        <Text style={{ color: nullOnly ? "#fff" : theme.textSecondary, fontSize: 12 }}>Nulls</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setSortDir((s) => (s === "asc" ? "desc" : "asc"))}
                        style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
                    >
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{sortDir === "asc" ? "Asc" : "Desc"}</Text>
                    </Pressable>
                </View>
            </View>

            {loadingRecords ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
            ) : (
                <>
                    <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={styles.gridWrap}>
                        <View>
                            <View style={[styles.gridHeaderRow, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}>
                                {visibleColumns.map((col) => (
                                    <Text key={col} style={[styles.gridHeaderCell, { color: theme.textSecondary }]} numberOfLines={1}>
                                        {col.replaceAll("_", " ")}
                                    </Text>
                                ))}
                                <Text style={[styles.gridActionHead, { color: theme.textSecondary }]}>actions</Text>
                            </View>

                            {records.map((record, idx) => (
                                <Pressable
                                    key={String(record.id ?? idx)}
                                    onPress={() => {
                                        setActiveRecord(record);
                                        setShowDetail(true);
                                    }}
                                    style={[
                                        styles.gridDataRow,
                                        {
                                            borderColor: theme.border,
                                            backgroundColor: idx % 2 ? theme.surfaceLight : theme.background,
                                        },
                                    ]}
                                >
                                    {visibleColumns.map((col, index) => (
                                        <Text
                                            key={`${record.id}-${col}`}
                                            style={[
                                                styles.gridDataCell,
                                                {
                                                    color: index === 0 ? theme.textPrimary : index === 1 ? theme.textSecondary : theme.textMuted,
                                                    fontWeight: index === 0 ? "700" : index === 1 ? "600" : "400",
                                                },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {prettyValue(record[col])}
                                        </Text>
                                    ))}

                                    <View style={styles.gridActions}>
                                        <Pressable
                                            onPress={() => {
                                                setActiveRecord(record);
                                                setShowDetail(true);
                                            }}
                                        >
                                            <Text style={[styles.rowActionText, { color: theme.primary }]}>View</Text>
                                        </Pressable>
                                        <Pressable onPress={() => openEdit(record)}>
                                            <Text style={[styles.rowActionText, { color: theme.primary }]}>Edit</Text>
                                        </Pressable>
                                        <Pressable onPress={() => confirmDelete(record)}>
                                            <Ionicons name="ellipsis-vertical" size={16} color={theme.textSecondary} />
                                        </Pressable>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={[styles.paginationBar, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                            {Math.min(offset + 1, totalRecords)}-{Math.min(offset + records.length, totalRecords)} of {totalRecords}
                        </Text>
                        <View style={styles.paginationActions}>
                            <Pressable
                                disabled={!hasPrev}
                                onPress={() => setOffset((v) => Math.max(0, v - limit))}
                                style={[styles.pageButton, { borderColor: theme.border, opacity: hasPrev ? 1 : 0.45 }]}
                            >
                                <Text style={{ color: theme.textPrimary }}>Prev</Text>
                            </Pressable>
                            <Pressable
                                disabled={!hasNext}
                                onPress={() => setOffset((v) => v + limit)}
                                style={[styles.pageButton, { borderColor: theme.border, opacity: hasNext ? 1 : 0.45 }]}
                            >
                                <Text style={{ color: theme.textPrimary }}>Next</Text>
                            </Pressable>
                        </View>
                    </View>
                </>
            )}

            <Modal visible={showDetail} transparent animationType="slide">
                <View style={[styles.modalOverlay, { backgroundColor: `${theme.textMuted}99` }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Record #{prettyValue(activeRecord?.id)}</Text>
                            <Pressable onPress={() => setShowDetail(false)}>
                                <Ionicons name="close" size={22} color={theme.textPrimary} />
                            </Pressable>
                        </View>

                        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
                            {schema.map((col) => (
                                <View key={col.name} style={styles.formField}>
                                    <Text style={[styles.formLabel, { color: theme.textSecondary }]}>{col.name}</Text>
                                    <Text style={[styles.detailValue, { color: theme.textPrimary }]}>{prettyValue(activeRecord?.[col.name])}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <Pressable
                                onPress={() => {
                                    setShowDetail(false);
                                    if (activeRecord) openEdit(activeRecord);
                                }}
                                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
                            >
                                <Text style={{ color: theme.textPrimary }}>Edit</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => activeRecord && confirmDelete(activeRecord)}
                                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: `${theme.error}18` }]}
                            >
                                <Text style={{ color: theme.error }}>Delete</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!deleteTarget} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: `${theme.textMuted}99` }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Delete record</Text>
                            <Pressable onPress={() => !deleting && setDeleteTarget(null)}>
                                <Ionicons name="close" size={22} color={theme.textPrimary} />
                            </Pressable>
                        </View>

                        <View style={styles.formContent}>
                            <Text style={{ color: theme.textSecondary }}>
                                Are you sure you want to delete record #{prettyValue(deleteTarget?.id)}? This action cannot be undone.
                            </Text>
                        </View>

                        <View style={styles.modalActions}>
                            <Pressable
                                disabled={deleting}
                                onPress={() => setDeleteTarget(null)}
                                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.surfaceLight, opacity: deleting ? 0.6 : 1 }]}
                            >
                                <Text style={{ color: theme.textPrimary }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                disabled={deleting}
                                onPress={performDelete}
                                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: `${theme.error}18`, opacity: deleting ? 0.6 : 1 }]}
                            >
                                <Text style={{ color: theme.error }}>{deleting ? "Deleting..." : "Delete"}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showEditor} transparent animationType="slide">
                <View style={[styles.modalOverlay, { backgroundColor: `${theme.textMuted}99` }]}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{editingRecord ? "Edit record" : "Add record"}</Text>
                            <Pressable
                                onPress={() => {
                                    setShowEditor(false);
                                    setEditingRecord(null);
                                    setFormData({});
                                }}
                            >
                                <Ionicons name="close" size={22} color={theme.textPrimary} />
                            </Pressable>
                        </View>

                        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
                            {schema
                                .filter((col) => col.name !== "id")
                                .map((col) => (
                                    <View key={col.name} style={styles.formField}>
                                        <Text style={[styles.formLabel, { color: theme.textPrimary }]}>{col.name}</Text>
                                        <TextInput
                                            style={[
                                                styles.formInput,
                                                {
                                                    backgroundColor: theme.surfaceLight,
                                                    color: theme.textPrimary,
                                                    borderColor: theme.border,
                                                },
                                            ]}
                                            placeholder={col.type}
                                            placeholderTextColor={theme.textMuted}
                                            value={String(formData[col.name] ?? "")}
                                            onChangeText={(text) => setFormData((prev) => ({ ...prev, [col.name]: text }))}
                                            multiline={col.type.includes("text") || col.type.includes("json")}
                                        />
                                    </View>
                                ))}
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <Pressable
                                onPress={() => {
                                    setShowEditor(false);
                                    setEditingRecord(null);
                                    setFormData({});
                                }}
                                style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.surfaceLight }]}
                            >
                                <Text style={{ color: theme.textPrimary }}>Cancel</Text>
                            </Pressable>
                            <Pressable onPress={saveRecord} style={[styles.modalBtn, { borderColor: theme.border, backgroundColor: theme.primary }]}>
                                <Text style={{ color: "#fff" }}>Save</Text>
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
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "700",
    },
    tableListWrap: {
        paddingHorizontal: 14,
        paddingBottom: 18,
        gap: 8,
    },
    tableRow: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    tableName: {
        fontSize: 14,
        fontWeight: "600",
    },
    countPill: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    countText: {
        fontSize: 12,
        fontWeight: "700",
    },
    toolbar: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
    },
    filtersRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    chip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    gridWrap: {
        paddingHorizontal: 12,
        paddingBottom: 10,
        minWidth: 680,
    },
    gridHeaderRow: {
        borderWidth: 1,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 8,
        marginTop: 8,
        marginBottom: 6,
    },
    gridHeaderCell: {
        width: 150,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    gridActionHead: {
        width: 150,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    gridDataRow: {
        borderWidth: 1,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 8,
        marginBottom: 6,
    },
    gridDataCell: {
        width: 150,
        fontSize: 13,
        paddingRight: 8,
    },
    gridActions: {
        width: 150,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    rowActionText: {
        fontSize: 12,
        fontWeight: "700",
    },
    paginationBar: {
        borderTopWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    paginationActions: {
        flexDirection: "row",
        gap: 8,
    },
    pageButton: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
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
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 6,
    },
    detailValue: {
        fontSize: 14,
    },
    formInput: {
        borderWidth: 1,
        borderRadius: 8,
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
    },
});

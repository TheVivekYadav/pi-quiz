import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { login } from '../constants/auth-api';
import { setAuthToken } from '../constants/auth-session';
import { useTheme } from '../hook/theme';

export default function LoginScreen() {
    const colors = useTheme();
    const router = useRouter();
    const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();
    const [rollNumber, setRollNumber] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [branch, setBranch] = useState('');
    const [year, setYear] = useState('');
    const [loading, setLoading] = useState(false);
    // Step 1 = roll number only, Step 2 = optional profile details
    const [step, setStep] = useState<1 | 2>(1);

    const handleContinue = () => {
        if (!rollNumber.trim()) {
            Alert.alert('Error', 'Please enter your roll number');
            return;
        }
        setStep(2);
    };

    const handleLogin = async () => {
        const numericYear = year.trim() ? Number(year) : undefined;
        if (numericYear !== undefined && (Number.isNaN(numericYear) || numericYear < 1 || numericYear > 6)) {
            Alert.alert('Error', 'Year should be between 1 and 6');
            return;
        }

        setLoading(true);
        try {
            const result = await login(
                rollNumber,
                name || undefined,
                email || undefined,
                branch || undefined,
                numericYear,
                `${Platform.OS}-device`,
                undefined,
                Platform.OS,
            );

            setAuthToken(result.token, result.userId, result.rollNumber, result.role, result.sessionId, branch || undefined, numericYear);

            // Validate redirectTo to prevent open redirect (must start with /)
            const safeRedirect = redirectTo && redirectTo.startsWith('/') ? redirectTo : null;
            if (safeRedirect) {
                router.replace(safeRedirect as any);
            } else {
                router.replace('/(tabs)' as any);
            }
        } catch (error) {
            console.error('Login failed:', error);
            Alert.alert('Login Error', 'Failed to login. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {step === 1 ? 'Enter your roll number to continue' : 'Complete your profile (optional)'}
                    </Text>
                </View>

                {/* Step indicator */}
                <View style={styles.stepRow}>
                    <View style={[styles.stepDot, { backgroundColor: colors.accent }]} />
                    <View style={[styles.stepLine, { backgroundColor: step === 2 ? colors.accent : colors.border }]} />
                    <View style={[styles.stepDot, { backgroundColor: step === 2 ? colors.accent : colors.border }]} />
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {step === 1 ? (
                        /* ── Step 1: Roll Number ── */
                        <>
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>Roll Number *</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                                    placeholder="e.g., 21BCS001"
                                    placeholderTextColor={colors.textSecondary}
                                    value={rollNumber}
                                    onChangeText={setRollNumber}
                                    editable={!loading}
                                    autoCapitalize="characters"
                                    returnKeyType="done"
                                    onSubmitEditing={handleContinue}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: colors.accent }]}
                                onPress={handleContinue}
                                disabled={loading}
                            >
                                <Text style={[styles.buttonText, { color: colors.textInverse }]}>Continue →</Text>
                            </TouchableOpacity>

                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                New users are automatically registered on first login.
                            </Text>

                            <View style={[styles.infoBox, { backgroundColor: colors.surfaceLight }]}>
                                <Text style={[styles.infoBoxTitle, { color: colors.textPrimary }]}>ℹ Admin Access</Text>
                                <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
                                    Admin accounts are set up in the database by the platform owner.
                                </Text>
                            </View>
                        </>
                    ) : (
                        /* ── Step 2: Optional profile ── */
                        <>
                            <Text style={[styles.stepNote, { color: colors.textSecondary }]}>
                                Signing in as <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{rollNumber}</Text>
                            </Text>

                            {/* Name */}
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>Name (Optional)</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                                    placeholder="Enter your full name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={name}
                                    onChangeText={setName}
                                    editable={!loading}
                                />
                            </View>

                            {/* Email */}
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>Email (Optional)</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                                    placeholder="your.email@college.edu"
                                    placeholderTextColor={colors.textSecondary}
                                    value={email}
                                    onChangeText={setEmail}
                                    editable={!loading}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Branch */}
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>Branch (Optional)</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                                    placeholder="e.g., CSE"
                                    placeholderTextColor={colors.textSecondary}
                                    value={branch}
                                    onChangeText={setBranch}
                                    editable={!loading}
                                />
                            </View>

                            {/* Year */}
                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: colors.textPrimary }]}>Year (Optional)</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                                    placeholder="1 to 6"
                                    placeholderTextColor={colors.textSecondary}
                                    value={year}
                                    onChangeText={setYear}
                                    editable={!loading}
                                    keyboardType="numeric"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: colors.accent }, loading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.textInverse} />
                                ) : (
                                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Sign In</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.backBtn}
                                onPress={() => setStep(1)}
                                disabled={loading}
                            >
                                <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>← Change roll number</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
        justifyContent: 'center',
        minHeight: '100%',
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
        gap: 0,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    stepLine: {
        flex: 1,
        maxWidth: 80,
        height: 2,
        marginHorizontal: 6,
    },
    stepNote: {
        fontSize: 14,
        marginBottom: 16,
    },
    form: {
        gap: 20,
    },
    formGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    button: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    backBtn: {
        alignItems: 'center',
        marginTop: 4,
    },
    backBtnText: {
        fontSize: 14,
    },
    infoText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
    },
    infoBox: {
        borderRadius: 12,
        padding: 16,
        marginTop: 4,
    },
    infoBoxTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    infoBoxText: {
        fontSize: 13,
        lineHeight: 20,
    },
});

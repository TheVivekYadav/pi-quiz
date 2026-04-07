import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { login } from '../constants/auth-api';
import { setAuthToken } from '../constants/auth-session';
import { useTheme } from '../hook/theme';

export default function LoginScreen() {
    const colors = useTheme();
    const router = useRouter();
    const [rollNumber, setRollNumber] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [branch, setBranch] = useState('');
    const [year, setYear] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!rollNumber.trim()) {
            Alert.alert('Error', 'Please enter your roll number');
            return;
        }

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

            // Store auth token and user info
            setAuthToken(result.token, result.userId, result.rollNumber, result.role, result.sessionId, branch || undefined, numericYear);

            // Navigate to dashboard
            router.replace('/(tabs)' as any);
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
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Quiz Platform</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Welcome Back
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Roll Number */}
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Roll Number *</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: colors.border,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surface,
                                },
                            ]}
                            placeholder="e.g., 21BCS001"
                            placeholderTextColor={colors.textSecondary}
                            value={rollNumber}
                            onChangeText={setRollNumber}
                            editable={!loading}
                        />
                    </View>

                    {/* Name */}
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Name (Optional)</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: colors.border,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surface,
                                },
                            ]}
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
                            style={[
                                styles.input,
                                {
                                    borderColor: colors.border,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surface,
                                },
                            ]}
                            placeholder="your.email@college.edu"
                            placeholderTextColor={colors.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            editable={!loading}
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Branch */}
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.textPrimary }]}>Branch (Optional)</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: colors.border,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surface,
                                },
                            ]}
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
                            style={[
                                styles.input,
                                {
                                    borderColor: colors.border,
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surface,
                                },
                            ]}
                            placeholder="1 to 6"
                            placeholderTextColor={colors.textSecondary}
                            value={year}
                            onChangeText={setYear}
                            editable={!loading}
                            keyboardType="numeric"
                        />
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[
                            styles.button,
                            { backgroundColor: colors.accent },
                            loading && styles.buttonDisabled,
                        ]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                                Login / Register
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Info Text */}
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        First-time users will be automatically registered with their roll number.
                    </Text>

                    {/* Admin Note */}
                    <View style={[styles.infoBox, { backgroundColor: colors.surfaceLight }]}>
                        <Text style={[styles.infoBoxTitle, { color: colors.textPrimary }]}>ℹ Admin Access</Text>
                        <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
                            Admins can create and manage quizzes. Admin accounts must be manually set in the database.
                        </Text>
                    </View>
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
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
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
    infoText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 12,
    },
    infoBox: {
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
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

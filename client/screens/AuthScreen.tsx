import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

type AuthMode = "login" | "signup";

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleSubmit = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setError("Please enter your name.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsLoading(true);

    try {
      let result;
      if (mode === "login") {
        result = await login(email.trim(), password);
      } else {
        result = await signup(name.trim(), email.trim(), password);
      }

      if (!result.success) {
        setError(result.error || "An error occurred. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: insets.top + Spacing.xxl,
      paddingBottom: insets.bottom + Spacing.xxl,
      paddingHorizontal: Spacing.xl,
      justifyContent: "center",
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: Spacing.xxl,
    },
    logoIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.lg,
    },
    title: {
      fontFamily: "Nunito_700Bold",
      fontSize: 34,
      color: "#FFFFFF",
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontFamily: "Nunito_400Regular",
      fontSize: 16,
      color: "rgba(255,255,255,0.8)",
    },
    formContainer: {
      backgroundColor: theme.background,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    formTitle: {
      fontFamily: "Nunito_700Bold",
      fontSize: 20,
      color: theme.text,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    inputContainer: {
      marginBottom: Spacing.md,
    },
    inputLabel: {
      fontFamily: "Nunito_500Medium",
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: Spacing.xs,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    input: {
      flex: 1,
      fontFamily: "Nunito_400Regular",
      fontSize: 16,
      color: theme.text,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    inputIcon: {
      paddingHorizontal: Spacing.md,
    },
    eyeButton: {
      padding: Spacing.md,
    },
    errorText: {
      fontFamily: "Nunito_500Medium",
      fontSize: 14,
      color: "#E74C3C",
      marginBottom: Spacing.md,
      textAlign: "center",
    },
    submitButton: {
      borderRadius: BorderRadius.lg,
      overflow: "hidden",
      marginTop: Spacing.md,
    },
    submitGradient: {
      paddingVertical: Spacing.md,
      alignItems: "center",
    },
    submitText: {
      fontFamily: "Nunito_700Bold",
      fontSize: 16,
      color: "#FFFFFF",
    },
    disabledButton: {
      opacity: 0.6,
    },
    switchContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: Spacing.lg,
    },
    switchText: {
      fontFamily: "Nunito_400Regular",
      fontSize: 14,
      color: theme.textSecondary,
    },
    switchLink: {
      fontFamily: "Nunito_700Bold",
      fontSize: 14,
      color: theme.primary,
    },
    securityNote: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.xl,
      paddingHorizontal: Spacing.md,
    },
    securityText: {
      fontFamily: "Nunito_400Regular",
      fontSize: 12,
      color: "rgba(255,255,255,0.7)",
      marginLeft: Spacing.xs,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.primary, theme.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Feather name="headphones" size={40} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>ReWired</Text>
              <Text style={styles.subtitle}>
                Transform your mind with AI-powered affirmations
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </Text>

              {mode === "signup" && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <View style={styles.inputWrapper}>
                    <Feather
                      name="user"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="words"
                      testID="input-name"
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="mail"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    testID="input-email"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="lock"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    testID="input-password"
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    testID="button-toggle-password"
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              {mode === "signup" && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <Feather
                      name="lock"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter your password"
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      testID="input-confirm-password"
                    />
                  </View>
                </View>
              )}

              {error.length > 0 ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <Pressable
                style={[styles.submitButton, isLoading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={isLoading}
                testID="button-submit"
              >
                <LinearGradient
                  colors={[theme.primary, theme.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>
                      {mode === "login" ? "Sign In" : "Create Account"}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {mode === "login"
                    ? "Don't have an account? "
                    : "Already have an account? "}
                </Text>
                <Pressable onPress={toggleMode} testID="button-switch-mode">
                  <Text style={styles.switchLink}>
                    {mode === "login" ? "Sign Up" : "Sign In"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.securityNote}>
              <Feather name="shield" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.securityText}>
                Your data is encrypted and securely stored
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

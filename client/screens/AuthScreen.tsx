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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

type AuthMode = "login" | "signup";

// Login screen color palette (gold to dark navy blue)
const authColors = {
  gold: "#C9A227",
  goldLight: "#E5C95C",
  navy: "#0F1C3F",
  navyMid: "#1A2D4F",
  white: "#FFFFFF",
  offWhite: "#F5F7FA",
  whiteTranslucent: "rgba(255,255,255,0.95)",
  textSecondary: "#5A6A7E",
  border: "#E0E4EB",
  surface: "#F8F9FB",
  error: "#E74C3C",
};

export function AuthScreen() {
  const insets = useSafeAreaInsets();
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
    logoImage: {
      width: 120,
      height: 120,
      marginBottom: Spacing.lg,
    },
    title: {
      fontFamily: "Nunito_700Bold",
      fontSize: 34,
      color: authColors.navy,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontFamily: "Nunito_400Regular",
      fontSize: 16,
      color: authColors.navyMid,
      textAlign: "center",
    },
    formContainer: {
      backgroundColor: authColors.whiteTranslucent,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    formTitle: {
      fontFamily: "Nunito_700Bold",
      fontSize: 20,
      color: authColors.navy,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    inputContainer: {
      marginBottom: Spacing.md,
    },
    inputLabel: {
      fontFamily: "Nunito_500Medium",
      fontSize: 14,
      color: authColors.textSecondary,
      marginBottom: Spacing.xs,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: authColors.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: authColors.border,
    },
    input: {
      flex: 1,
      fontFamily: "Nunito_400Regular",
      fontSize: 16,
      color: authColors.navy,
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
      color: authColors.error,
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
      color: authColors.navy,
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
      color: authColors.textSecondary,
    },
    switchLink: {
      fontFamily: "Nunito_700Bold",
      fontSize: 14,
      color: authColors.gold,
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
        colors={[authColors.offWhite, authColors.gold, authColors.navyMid, authColors.navy]}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
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
              <Image
                source={require("../../assets/images/login-logo.jpg")}
                style={styles.logoImage}
                resizeMode="contain"
              />
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
                      color={authColors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      placeholderTextColor={authColors.textSecondary}
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
                    color={authColors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={authColors.textSecondary}
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
                    color={authColors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={authColors.textSecondary}
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
                      color={authColors.textSecondary}
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
                      color={authColors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter your password"
                      placeholderTextColor={authColors.textSecondary}
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
                  colors={[authColors.goldLight, authColors.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color={authColors.navy} />
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

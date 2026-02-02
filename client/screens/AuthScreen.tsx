import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Image,
  Platform,
  ImageBackground,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Dark theme color palette for contrast against dark meditation background
const authColors = {
  // Brand colors
  gold: "#C9A227",
  goldLight: "#E5C95C",
  // Text colors - light for dark background
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.75)",
  textMuted: "rgba(255,255,255,0.5)",
  // UI colors
  white: "#FFFFFF",
  cardBackground: "rgba(15,28,63,0.85)",
  glassBorder: "rgba(201,162,39,0.3)",
  error: "#FF6B5B",
  google: "#4285F4",
  apple: "#FFFFFF",
};

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { oauthLogin, login } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | "email" | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const isIOS = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";
  const isWeb = Platform.OS === "web";
  
  const hasGoogleClientId = (isWeb || isAndroid) && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [request, response, promptAsync] = Google.useAuthRequest(
    (isWeb || isAndroid) ? {
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    } : {
      clientId: "unused",
    }
  );

  React.useEffect(() => {
    if (response?.type === "success") {
      handleGoogleSuccess(response.authentication?.accessToken);
    } else if (response?.type === "error") {
      setError("Google sign-in was cancelled or failed");
      setIsLoading(false);
      setLoadingProvider(null);
    }
  }, [response]);

  const handleGoogleSuccess = async (accessToken?: string) => {
    if (!accessToken) {
      setError("Failed to get access token from Google");
      setIsLoading(false);
      setLoadingProvider(null);
      return;
    }

    try {
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userInfo = await userInfoResponse.json();

      const result = await oauthLogin({
        email: userInfo.email,
        name: userInfo.given_name || userInfo.name?.split(" ")[0] || "Friend",
        provider: "google",
        providerId: userInfo.id,
        avatarUrl: userInfo.picture,
      });

      if (!result.success) {
        setError(result.error || "Failed to sign in with Google");
      }
    } catch (err) {
      console.error("Google auth error:", err);
      setError("Failed to complete Google sign-in");
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsLoading(true);
    setLoadingProvider("google");
    
    try {
      await promptAsync();
    } catch (err) {
      console.error("Google prompt error:", err);
      setError("Failed to initiate Google sign-in");
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    setError("");
    setIsLoading(true);
    setLoadingProvider("apple");

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const email = credential.email || `${credential.user}@privaterelay.appleid.com`;
      const firstName = credential.fullName?.givenName || undefined;

      const result = await oauthLogin({
        email,
        name: firstName || "Friend",
        provider: "apple",
        providerId: credential.user,
      });

      if (!result.success) {
        setError(result.error || "Unable to sign in. Please try again.");
      }
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") {
        // User cancelled, not an error
      } else {
        console.error("Apple auth error:", err);
        setError("Unable to complete sign-in. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }
    
    setError("");
    setIsLoading(true);
    setLoadingProvider("email");

    try {
      const result = await login(email.trim(), password);
      if (!result.success) {
        setError(result.error || "Invalid email or password");
      }
    } catch (err) {
      console.error("Email login error:", err);
      setError("Failed to sign in. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/images/library-background.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + Spacing.xxl,
                paddingBottom: insets.bottom + Spacing.xxl + 100,
              }
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          {/* Top Section - Logo */}
          <View style={styles.topSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require("../../assets/images/rewired-logo.png")}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              
              {/* Liquid Glass Brand Container */}
              <BlurView
                intensity={80}
                tint="light"
                style={styles.brandGlassContainer}
              >
                <View style={styles.brandGlassInner}>
                  <Text style={styles.brandName}>RETUNE</Text>
                  <View style={styles.brandAccent} />
                </View>
              </BlurView>
              
              <Text style={styles.brandSubtitle}>Breathe, Believe, Become</Text>
            </View>
          </View>

          {/* Spacer to push login to bottom */}
          <View style={styles.spacer} />

          {/* Frosted Glass Card */}
          <BlurView
            intensity={80}
            tint="light"
            style={styles.glassCard}
          >
            <View style={styles.cardContent}>
              <Text style={styles.welcomeTitle}>Welcome</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to tune into your true self
              </Text>

              {error.length > 0 ? (
                <View style={styles.errorContainer}>
                  <Feather name="alert-circle" size={16} color={authColors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Apple Sign In - iOS only */}
              {Platform.OS === "ios" ? (
                <Pressable
                  style={[
                    styles.authButton,
                    styles.appleButton,
                    isLoading && styles.disabledButton,
                  ]}
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  testID="button-apple-signin"
                >
                  {loadingProvider === "apple" ? (
                    <ActivityIndicator color="#0F1C3F" />
                  ) : (
                    <>
                      <Feather name="smartphone" size={20} color="#0F1C3F" />
                      <Text style={styles.appleButtonText}>
                        Continue with Apple
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : null}

              {/* Google Sign In */}
              {hasGoogleClientId ? (
                <Pressable
                  style={[
                    styles.authButton,
                    styles.googleButton,
                    isLoading && styles.disabledButton,
                  ]}
                  onPress={handleGoogleSignIn}
                  disabled={isLoading || !request}
                  testID="button-google-signin"
                >
                  {loadingProvider === "google" ? (
                    <ActivityIndicator color={authColors.textPrimary} />
                  ) : (
                    <>
                      <Feather name="mail" size={20} color={authColors.google} />
                      <Text style={styles.googleButtonText}>
                        Continue with Google
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : null}

              {/* Email/Password Login Toggle */}
              <Pressable
                style={styles.emailToggle}
                onPress={() => setShowEmailLogin(!showEmailLogin)}
              >
                <Text style={styles.emailToggleText}>
                  {showEmailLogin ? "Hide email login" : "Sign in with email"}
                </Text>
                <Feather 
                  name={showEmailLogin ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color={authColors.textSecondary} 
                />
              </Pressable>

              {/* Email/Password Form */}
              {showEmailLogin ? (
                <View style={styles.emailForm}>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Email"
                    placeholderTextColor={authColors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="input-email"
                  />
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Password"
                    placeholderTextColor={authColors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    testID="input-password"
                  />
                  <Pressable
                    style={[
                      styles.authButton,
                      styles.emailLoginButton,
                      isLoading && styles.disabledButton,
                    ]}
                    onPress={handleEmailLogin}
                    disabled={isLoading}
                    testID="button-email-signin"
                  >
                    {loadingProvider === "email" ? (
                      <ActivityIndicator color={authColors.textPrimary} />
                    ) : (
                      <>
                        <Feather name="log-in" size={20} color={authColors.white} />
                        <Text style={styles.emailLoginButtonText}>Sign In</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>secure sign in</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.termsText}>
                By continuing, you agree to our{" "}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {" "}and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </BlurView>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Feather name="shield" size={14} color={authColors.gold} />
            <Text style={styles.securityText}>
              Your data is encrypted and securely stored
            </Text>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EDF2",
  },
  backgroundImage: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  topSection: {
    alignItems: "center",
  },
  spacer: {
    flex: 1,
    minHeight: 280,
  },
  logoContainer: {
    alignItems: "center",
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(15,28,63,0.6)",
    borderWidth: 2,
    borderColor: "rgba(201,162,39,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    shadowColor: "#C9A227",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  brandGlassContainer: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    marginTop: Spacing.lg,
    shadowColor: "#C9A227",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  brandGlassInner: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  brandName: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 44,
    color: authColors.white,
    letterSpacing: 8,
    textShadowColor: "rgba(201,162,39,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  brandAccent: {
    width: 60,
    height: 3,
    backgroundColor: authColors.gold,
    borderRadius: 2,
    marginTop: Spacing.sm,
    shadowColor: authColors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  brandSubtitle: {
    fontFamily: "SpaceGrotesk_500Medium",
    fontSize: 14,
    color: "#C9A227",
    textAlign: "center",
    letterSpacing: 3,
    marginTop: Spacing.lg,
    textTransform: "uppercase",
  },
  tagline: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    color: authColors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },
  topTagline: {
    fontFamily: "SpaceGrotesk_500Medium",
    fontSize: 13,
    color: authColors.goldLight,
    textAlign: "center",
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  glassCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#C9A227",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  cardContent: {
    padding: Spacing.xl,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  welcomeTitle: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    color: authColors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: "center",
    letterSpacing: 1,
  },
  welcomeSubtitle: {
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 14,
    color: authColors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,107,91,0.2)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: "Nunito_500Medium",
    fontSize: 13,
    color: authColors.error,
    marginLeft: Spacing.xs,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  appleButton: {
    backgroundColor: authColors.gold,
  },
  googleButton: {
    backgroundColor: authColors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  emailToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  emailToggleText: {
    fontFamily: "Nunito_500Medium",
    fontSize: 14,
    color: authColors.textSecondary,
  },
  emailForm: {
    marginBottom: Spacing.md,
  },
  emailInput: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
    color: authColors.textPrimary,
  },
  emailLoginButton: {
    backgroundColor: authColors.gold,
    marginTop: Spacing.xs,
  },
  emailLoginButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: authColors.white,
    marginLeft: Spacing.sm,
  },
  appleButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: "#0F1C3F",
    marginLeft: Spacing.sm,
  },
  googleButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: "#333333",
    marginLeft: Spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  dividerText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: authColors.textSecondary,
    paddingHorizontal: Spacing.md,
  },
  termsText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: authColors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  termsLink: {
    color: authColors.gold,
    fontFamily: "Nunito_600SemiBold",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  securityText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: authColors.textSecondary,
    marginLeft: Spacing.xs,
  },
});

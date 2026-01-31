import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

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
  google: "#4285F4",
  apple: "#000000",
};

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { oauthLogin } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");

  // Check if Google is available on this platform
  const isIOS = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";
  const isWeb = Platform.OS === "web";
  
  // On iOS, Google auth requires an iOS-specific client ID from Google Cloud Console
  // Since we don't have one configured, Google Sign-In is not available on iOS
  // Users on iOS should use Apple Sign-In instead
  const hasGoogleClientId = isWeb && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  // Google OAuth setup - only use on web where we have a valid client ID
  // On iOS/Android, we use Apple Sign-In instead to avoid crashes
  const [request, response, promptAsync] = Google.useAuthRequest(
    isWeb ? {
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    } : {
      // Provide a dummy config for non-web platforms - the hook won't be used
      clientId: "unused",
    }
  );

  // Handle Google auth response
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
      // Fetch user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const userInfo = await userInfoResponse.json();

      const result = await oauthLogin({
        email: userInfo.email,
        // Use only first name (given_name) for preferred name
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

      // Apple may not return email after first sign-in, use user ID as fallback
      const email = credential.email || `${credential.user}@privaterelay.appleid.com`;
      // Use only first name for preferred name
      // Apple only returns name on first sign-in
      const firstName = credential.fullName?.givenName || undefined;

      const result = await oauthLogin({
        email,
        name: firstName || "Friend",
        provider: "apple",
        providerId: credential.user,
      });

      if (!result.success) {
        setError(result.error || "Failed to sign in with Apple");
      }
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") {
        // User cancelled, not an error
      } else {
        console.error("Apple auth error:", err);
        setError("Failed to complete Apple sign-in");
      }
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
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
      borderRadius: 60,
      marginBottom: Spacing.lg,
    },
    brandContainer: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: Spacing.xs,
    },
    brandRe: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 36,
      color: authColors.navy,
    },
    brandWired: {
      fontFamily: "Poppins_600SemiBold",
      fontSize: 36,
      color: authColors.gold,
    },
    subtitle: {
      fontFamily: "Poppins_400Regular",
      fontSize: 16,
      color: authColors.navyMid,
      textAlign: "center",
    },
    formContainer: {
      backgroundColor: authColors.whiteTranslucent,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      shadowColor: "#0F1C3F",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    formTitle: {
      fontFamily: "Nunito_700Bold",
      fontSize: 20,
      color: authColors.navy,
      marginBottom: Spacing.sm,
      textAlign: "center",
    },
    formSubtitle: {
      fontFamily: "Nunito_400Regular",
      fontSize: 14,
      color: authColors.textSecondary,
      marginBottom: Spacing.xl,
      textAlign: "center",
    },
    errorText: {
      fontFamily: "Nunito_500Medium",
      fontSize: 14,
      color: authColors.error,
      marginBottom: Spacing.md,
      textAlign: "center",
    },
    socialButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
    },
    googleButton: {
      backgroundColor: authColors.white,
      borderWidth: 1,
      borderColor: authColors.border,
    },
    appleButton: {
      backgroundColor: authColors.apple,
    },
    socialButtonText: {
      fontFamily: "Nunito_600SemiBold",
      fontSize: 16,
      marginLeft: Spacing.sm,
    },
    googleButtonText: {
      color: authColors.navy,
    },
    appleButtonText: {
      color: authColors.white,
    },
    disabledButton: {
      opacity: 0.6,
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: Spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: authColors.border,
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
    googleIcon: {
      width: 20,
      height: 20,
    },
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[authColors.offWhite, authColors.gold, authColors.navyMid, authColors.navy]}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
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
            <View style={styles.brandContainer}>
              <Text style={styles.brandRe}>Re</Text>
              <Text style={styles.brandWired}>wired</Text>
            </View>
            <Text style={styles.subtitle}>
              Transform your mind with AI-powered affirmations
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Get Started</Text>
            <Text style={styles.formSubtitle}>
              Sign in to save your affirmations and sync across devices
            </Text>

            {error.length > 0 ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Apple Sign In Button - iOS only, shown first on iOS */}
            {Platform.OS === "ios" ? (
              <Pressable
                style={[
                  styles.socialButton,
                  styles.appleButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleAppleSignIn}
                disabled={isLoading}
                testID="button-apple-signin"
              >
                {loadingProvider === "apple" ? (
                  <ActivityIndicator color={authColors.white} />
                ) : (
                  <>
                    <Feather name="smartphone" size={20} color={authColors.white} />
                    <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                      Continue with Apple
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}

            {/* Google Sign In Button - only show if platform has client ID configured */}
            {hasGoogleClientId ? (
              <Pressable
                style={[
                  styles.socialButton,
                  styles.googleButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={handleGoogleSignIn}
                disabled={isLoading || !request}
                testID="button-google-signin"
              >
                {loadingProvider === "google" ? (
                  <ActivityIndicator color={authColors.navy} />
                ) : (
                  <>
                    <Feather name="mail" size={20} color={authColors.google} />
                    <Text style={[styles.socialButtonText, styles.googleButtonText]}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}

            <View style={styles.dividerContainer}>
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

          <View style={styles.securityNote}>
            <Feather name="shield" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.securityText}>
              Your data is encrypted and securely stored
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

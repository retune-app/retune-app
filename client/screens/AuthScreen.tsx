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
  ImageBackground,
  Dimensions,
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

// Calming color palette matching the meditation background
const authColors = {
  // Soft ethereal tones from the meditation image
  softBlue: "#B8C5D4",
  paleGold: "#E8D5A8",
  warmGold: "#D4B76A",
  deepGold: "#C9A227",
  // Text colors
  textPrimary: "#3A4A5C",
  textSecondary: "#6B7B8C",
  textLight: "rgba(255,255,255,0.9)",
  // UI colors
  white: "#FFFFFF",
  whiteTranslucent: "rgba(255,255,255,0.85)",
  glassBorder: "rgba(255,255,255,0.5)",
  error: "#D4574A",
  google: "#4285F4",
  apple: "#1A1A1A",
};

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { oauthLogin } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");

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

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../../assets/images/library-background-light.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Spacing.xxl,
              paddingBottom: insets.bottom + Spacing.xxl,
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Brand */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require("../../assets/images/rewired-logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>InnerTune</Text>
            <Text style={styles.tagline}>
              Transform your mind through the power of affirmations
            </Text>
          </View>

          {/* Frosted Glass Card */}
          <BlurView
            intensity={60}
            tint="light"
            style={styles.glassCard}
          >
            <View style={styles.cardContent}>
              <Text style={styles.welcomeTitle}>Welcome</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to begin your journey of self-discovery
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
                    <ActivityIndicator color={authColors.white} />
                  ) : (
                    <>
                      <Feather name="smartphone" size={20} color={authColors.white} />
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
            <Feather name="shield" size={14} color={authColors.textSecondary} />
            <Text style={styles.securityText}>
              Your data is encrypted and securely stored
            </Text>
          </View>
        </ScrollView>
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
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  brandName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 38,
    color: authColors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    color: authColors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },
  glassCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: authColors.glassBorder,
  },
  cardContent: {
    padding: Spacing.xl,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  welcomeTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 24,
    color: authColors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: authColors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,87,74,0.1)",
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
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  appleButton: {
    backgroundColor: authColors.apple,
  },
  googleButton: {
    backgroundColor: authColors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  appleButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: authColors.white,
    marginLeft: Spacing.sm,
  },
  googleButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: authColors.textPrimary,
    marginLeft: Spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(107,123,140,0.2)",
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
    color: authColors.deepGold,
    fontFamily: "Nunito_600SemiBold",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  securityText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: authColors.textSecondary,
    marginLeft: Spacing.xs,
  },
});

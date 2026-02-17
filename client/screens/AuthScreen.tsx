import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  Pressable,
  Image,
  Platform,
  ImageBackground,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

function useGoogleAuth() {
  const googleWebClientId = GOOGLE_WEB_CLIENT_ID || undefined;
  const googleIosClientId = GOOGLE_IOS_CLIENT_ID || undefined;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    scopes: ["profile", "email"],
  });

  return { request, response, promptAsync, googleWebClientId, googleIosClientId };
}

class GoogleAuthErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("Google auth setup error caught:", error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

type GoogleSignInProps = {
  onSuccess: (accessToken?: string) => void;
  onError: (msg: string) => void;
  isLoading: boolean;
  loadingProvider: "google" | "apple" | null;
  setLoadingProvider: (p: "google" | "apple" | null) => void;
  setIsLoading: (v: boolean) => void;
};

function GoogleSignInFallback({
  onSuccess,
  onError,
  isLoading,
  loadingProvider,
  setLoadingProvider,
  setIsLoading,
}: GoogleSignInProps) {
  const handlePress = async () => {
    onError("");
    setIsLoading(true);
    setLoadingProvider("google");

    try {
      const redirectUri = "https://retuned.app";
      const clientId = GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID;

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent("profile email openid")}`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        "subconsciousrewire://"
      );

      if (result.type === "success" && result.url) {
        const url = result.url;
        const queryPart = url.split("?")[1];
        const fragmentPart = url.split("#")[1];
        const paramString = queryPart || fragmentPart;

        if (paramString) {
          const params = new URLSearchParams(paramString);
          const accessToken = params.get("access_token");
          if (accessToken) {
            onSuccess(accessToken);
            return;
          }
        }
        onError("Failed to get access token from Google");
      }
    } catch (err) {
      console.error("Google sign-in fallback error:", err);
      onError("Failed to initiate Google sign-in");
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <Pressable
      style={[
        buttonStyles.authButton,
        buttonStyles.googleButton,
        isLoading && buttonStyles.disabledButton,
      ]}
      onPress={handlePress}
      disabled={isLoading}
      testID="button-google-signin"
    >
      {loadingProvider === "google" ? (
        <ActivityIndicator color={authColors.textPrimary} />
      ) : (
        <>
          <Feather name="mail" size={20} color={authColors.google} />
          <Text style={buttonStyles.googleButtonText}>
            Continue with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}

function GoogleSignInButton({
  onSuccess,
  onError,
  isLoading,
  loadingProvider,
  setLoadingProvider,
  setIsLoading,
}: GoogleSignInProps) {
  const { request, response, promptAsync, googleWebClientId, googleIosClientId } = useGoogleAuth();
  const isIOS = Platform.OS === "ios";
  const hasGoogleClientId = !!googleWebClientId || (isIOS && !!googleIosClientId);

  React.useEffect(() => {
    if (response?.type === "success") {
      onSuccess(response.authentication?.accessToken);
    } else if (response?.type === "error") {
      onError("Google sign-in was cancelled or failed");
      setIsLoading(false);
      setLoadingProvider(null);
    }
  }, [response]);

  if (!hasGoogleClientId) return null;

  return (
    <Pressable
      style={[
        buttonStyles.authButton,
        buttonStyles.googleButton,
        isLoading && buttonStyles.disabledButton,
      ]}
      onPress={async () => {
        onError("");
        setIsLoading(true);
        setLoadingProvider("google");
        try {
          await promptAsync();
        } catch (err) {
          console.error("Google prompt error:", err);
          onError("Failed to initiate Google sign-in");
          setIsLoading(false);
          setLoadingProvider(null);
        }
      }}
      disabled={isLoading || !request}
      testID="button-google-signin"
    >
      {loadingProvider === "google" ? (
        <ActivityIndicator color={authColors.textPrimary} />
      ) : (
        <>
          <Feather name="mail" size={20} color={authColors.google} />
          <Text style={buttonStyles.googleButtonText}>
            Continue with Google
          </Text>
        </>
      )}
    </Pressable>
  );
}

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

const buttonStyles = StyleSheet.create({
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    gap: 10,
  },
  googleButton: {
    backgroundColor: authColors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  disabledButton: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: "#333333",
    marginLeft: Spacing.sm,
  },
});

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { oauthLogin } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");

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

      const userEmail = credential.email || `${credential.user}@privaterelay.appleid.com`;
      const firstName = credential.fullName?.givenName || undefined;

      const result = await oauthLogin({
        email: userEmail,
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
                paddingTop: insets.top + Spacing.lg,
                paddingBottom: insets.bottom + Spacing.xl + 40,
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
                  source={require("../../assets/images/icon-dark-1024x1024.png")}
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
                  <Text style={styles.brandName}>RETUNED</Text>
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

              {/* Google Sign In - browser-based on iOS/Android, hook-based on web */}
              {Platform.OS === "web" ? (
                <GoogleAuthErrorBoundary fallback={
                  <GoogleSignInFallback
                    onSuccess={handleGoogleSuccess}
                    onError={setError}
                    isLoading={isLoading}
                    loadingProvider={loadingProvider}
                    setLoadingProvider={setLoadingProvider}
                    setIsLoading={setIsLoading}
                  />
                }>
                  <GoogleSignInButton
                    onSuccess={handleGoogleSuccess}
                    onError={setError}
                    isLoading={isLoading}
                    loadingProvider={loadingProvider}
                    setLoadingProvider={setLoadingProvider}
                    setIsLoading={setIsLoading}
                  />
                </GoogleAuthErrorBoundary>
              ) : (
                <GoogleSignInFallback
                  onSuccess={handleGoogleSuccess}
                  onError={setError}
                  isLoading={isLoading}
                  loadingProvider={loadingProvider}
                  setLoadingProvider={setLoadingProvider}
                  setIsLoading={setIsLoading}
                />
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>secure sign in</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.termsText}>
                By continuing, you agree to our{" "}
                <Text style={styles.termsLink} onPress={() => WebBrowser.openBrowserAsync("https://retuned.app/terms-of-service")}>Terms of Service</Text>
                {" "}and{" "}
                <Text style={styles.termsLink} onPress={() => WebBrowser.openBrowserAsync("https://retuned.app/privacy-policy")}>Privacy Policy</Text>
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

          {__DEV__ ? (
            <Pressable
              onPress={async () => {
                setError("");
                setIsLoading(true);
                try {
                  const result = await oauthLogin({
                    email: "appreview@retuned.app",
                    name: "App Reviewer",
                    provider: "apple",
                    providerId: "apple-review-test-account",
                  });
                  if (!result.success) {
                    setError(result.error || "Dev login failed");
                  }
                } catch (err) {
                  setError("Dev login failed");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              style={{ paddingVertical: 12, alignItems: 'center', marginTop: 8 }}
              testID="button-dev-login"
            >
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'Nunito_400Regular' }}>
                Dev Login
              </Text>
            </Pressable>
          ) : null}
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
    minHeight: 100,
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
    fontFamily: "Nunito_700Bold",
    fontSize: 38,
    color: authColors.white,
    letterSpacing: 5,
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
    fontFamily: "Nunito_400Regular",
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
    fontFamily: "Nunito_600SemiBold",
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
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
  },
  welcomeTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 24,
    color: authColors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: "center",
    letterSpacing: 1,
  },
  welcomeSubtitle: {
    fontFamily: "Nunito_400Regular",
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
  appleButtonText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: "#0F1C3F",
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
    textDecorationLine: "underline" as const,
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

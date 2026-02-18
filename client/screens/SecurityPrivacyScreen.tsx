import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthToken } from "@/lib/auth-token";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SecuritySectionProps {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  title: string;
  points: string[];
}

function SecuritySection({ icon, iconColor, iconBgColor, title, points }: SecuritySectionProps) {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBgColor }]}>
          <Feather name={icon as any} size={22} color={iconColor} />
        </View>
        <ThemedText type="body" style={styles.sectionTitle}>{title}</ThemedText>
      </View>
      <View style={styles.sectionBody}>
        {points.map((point, index) => (
          <View key={index} style={styles.pointRow}>
            <View style={[styles.pointDot, { backgroundColor: iconColor + "40" }]}>
              <Feather name="check" size={12} color={iconColor} />
            </View>
            <ThemedText type="small" style={[styles.pointText, { color: theme.textSecondary }]}>
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function SecurityPrivacyScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  
  const deleteDataMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getApiUrl();
      const authToken = getAuthToken();
      
      const headers: Record<string, string> = {};
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }

      const response = await fetch(`${apiUrl}/api/user/data`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete data");
      }
      return response.json();
    },
    onSuccess: async () => {
      setShowDeleteModal(false);
      queryClient.clear();
      await logout();
      if (Platform.OS === "web") {
        Alert.alert("Data Deleted", "All your data has been permanently deleted.");
      }
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to delete your data. Please try again.");
    },
  });
  
  const handleDeleteData = () => {
    if (confirmText.toLowerCase() === "delete") {
      deleteDataMutation.mutate();
    }
  };

  const sections: SecuritySectionProps[] = [
    {
      icon: "mic",
      iconColor: "#6366F1",
      iconBgColor: "#6366F120",
      title: "Voice Privacy",
      points: [
        "Voice recordings are used only for cloning and immediately deleted afterward",
        "Your cloned voice is stored securely with our voice technology partner and can be fully removed at any time",
        "Stock AI voices are generated on demand — no personal data is stored",
      ],
    },
    {
      icon: "lock",
      iconColor: "#C9A227",
      iconBgColor: "#C9A22720",
      title: "Data Security",
      points: [
        "All data is encrypted in transit using HTTPS/TLS",
        "Passwords are securely hashed — we never store them in plain text",
        "Your affirmations and personal content are isolated to your account only",
      ],
    },
    {
      icon: "eye-off",
      iconColor: "#10B981",
      iconBgColor: "#10B98120",
      title: "What We Don't Do",
      points: [
        "We never sell or share your data with third parties",
        "Your personal goals are used only to generate your affirmation, then immediately discarded",
        "We don't track you across other apps or websites",
      ],
    },
    {
      icon: "user-check",
      iconColor: "#F59E0B",
      iconBgColor: "#F59E0B20",
      title: "You're in Control",
      points: [
        "Delete all your data at any time — account, affirmations, voice clone, everything",
        "We collect only what's needed: account info, your affirmations, and basic usage stats",
        "No hidden data collection or surprise analytics",
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <LinearGradient
        colors={isDark 
          ? ["rgba(15, 28, 63, 1)", "rgba(26, 45, 79, 0.8)"] 
          : ["rgba(255, 255, 255, 1)", "rgba(248, 250, 251, 0.9)"]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          testID="button-back"
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>Security & Privacy</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroSection, { backgroundColor: theme.primary + "15" }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primary + "30" }]}>
            <Feather name="shield" size={40} color={theme.primary} />
          </View>
          <ThemedText type="h4" style={styles.heroTitle}>Your privacy is built in, not bolted on</ThemedText>
          <ThemedText type="small" style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Here's how we protect your voice, your words, and your data
          </ThemedText>
        </View>

        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <SecuritySection key={index} {...section} />
          ))}
        </View>

        <View style={[styles.deleteSection, { backgroundColor: "#EF444410", borderColor: "#EF444430" }]}>
          <View style={styles.deleteSectionHeader}>
            <View style={[styles.deleteIcon, { backgroundColor: "#EF444420" }]}>
              <Feather name="alert-triangle" size={24} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={[styles.deleteSectionTitle, { color: "#EF4444" }]}>
                Delete All My Data
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Permanently remove your account and all associated data
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" style={[styles.deleteWarning, { color: theme.textSecondary }]}>
            This will permanently delete your account, affirmations, voice recordings, listening history, and all other personal data. This action cannot be undone.
          </ThemedText>
          <Button
            variant="ghost"
            onPress={() => setShowDeleteModal(true)}
            style={[styles.deleteButton, { borderColor: "#EF4444" }]}
            testID="button-delete-data"
          >
            <ThemedText style={{ color: "#EF4444", fontWeight: "600" }}>
              Delete My Data
            </ThemedText>
          </Button>
        </View>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#EF444420" }]}>
              <Feather name="alert-triangle" size={32} color="#EF4444" />
            </View>
            
            <ThemedText type="h4" style={styles.modalTitle}>
              Delete All Your Data?
            </ThemedText>
            
            <ThemedText type="body" style={[styles.modalDescription, { color: theme.textSecondary }]}>
              This will permanently delete:
            </ThemedText>
            
            <View style={styles.modalList}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>• Your account and profile</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>• All affirmations and audio files</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>• Voice clone and recordings</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>• Listening history and statistics</ThemedText>
            </View>
            
            <ThemedText type="small" style={[styles.confirmLabel, { color: theme.textSecondary }]}>
              Type "delete" to confirm:
            </ThemedText>
            
            <TextInput
              style={[styles.confirmInput, { 
                backgroundColor: theme.backgroundSecondary, 
                color: theme.text,
                borderColor: confirmText.toLowerCase() === "delete" ? "#10B981" : theme.border
              }]}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="delete"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              testID="input-confirm-delete"
            />
            
            <View style={styles.modalButtons}>
              <Button
                variant="secondary"
                onPress={() => {
                  setShowDeleteModal(false);
                  setConfirmText("");
                }}
                style={styles.modalButton}
                testID="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                onPress={handleDeleteData}
                loading={deleteDataMutation.isPending}
                disabled={confirmText.toLowerCase() !== "delete"}
                style={[styles.modalButton, styles.deleteConfirmButton, { 
                  backgroundColor: confirmText.toLowerCase() === "delete" ? "#EF4444" : "#EF444450",
                }]}
                testID="button-confirm-delete"
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Delete Forever
                </ThemedText>
              </Button>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    textAlign: "center",
  },
  sectionsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  sectionTitle: {
    fontFamily: "Nunito_700Bold",
    flex: 1,
  },
  sectionBody: {
    gap: Spacing.sm,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  pointDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  pointText: {
    flex: 1,
    lineHeight: 20,
  },
  deleteSection: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  deleteSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  deleteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteSectionTitle: {
    fontFamily: "Nunito_700Bold",
  },
  deleteWarning: {
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalDescription: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  modalList: {
    alignSelf: "flex-start",
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  confirmLabel: {
    alignSelf: "flex-start",
    marginBottom: Spacing.xs,
  },
  confirmInput: {
    width: "100%",
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
  },
  deleteConfirmButton: {
    borderWidth: 0,
  },
});

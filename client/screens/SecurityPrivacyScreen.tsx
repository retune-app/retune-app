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
import { useAuth, getAuthToken } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SecuritySectionProps {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  title: string;
  subtitle: string;
  description: string;
  highlight: string;
}

function SecuritySection({ icon, iconColor, iconBgColor, title, subtitle, description, highlight }: SecuritySectionProps) {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBgColor }]}>
          <Feather name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={styles.sectionTitleContainer}>
          <ThemedText type="body" style={styles.sectionTitle}>{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{subtitle}</ThemedText>
        </View>
      </View>
      <View style={styles.sectionBody}>
        <ThemedText type="body" style={[styles.highlightText, { color: theme.primary }]}>
          {highlight}
        </ThemedText>
        <ThemedText type="small" style={[styles.descriptionText, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
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
      icon: "lock",
      iconColor: "#C9A227",
      iconBgColor: "#C9A22720",
      title: "Data Protection",
      subtitle: "passwords, sessions",
      highlight: "Your Replit PostgreSQL database",
      description: "Passwords are hashed with bcrypt before storage",
    },
    {
      icon: "mic",
      iconColor: "#6366F1",
      iconBgColor: "#6366F120",
      title: "Voice Data Security",
      subtitle: "voice samples, cloned voice IDs",
      highlight: "ElevenLabs cloud",
      description: "When users upload voice samples for cloning, ElevenLabs stores and processes them to create the cloned voice",
    },
    {
      icon: "database",
      iconColor: "#10B981",
      iconBgColor: "#10B98120",
      title: "Data Isolation",
      subtitle: "affirmations, personal data",
      highlight: "Your Replit PostgreSQL database",
      description: "All user content stays in your database",
    },
    {
      icon: "shield",
      iconColor: "#F59E0B",
      iconBgColor: "#F59E0B20",
      title: "Encryption",
      subtitle: "TLS/HTTPS",
      highlight: "Replit infrastructure",
      description: "Handles the HTTPS encryption in transit",
    },
    {
      icon: "trash-2",
      iconColor: "#EF4444",
      iconBgColor: "#EF444420",
      title: "Your Control",
      subtitle: "deletion rights",
      highlight: "Applies to both your database and ElevenLabs",
      description: "Your database (which you control) and ElevenLabs (cloned voices can be deleted via their API)",
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
          <ThemedText type="h4" style={styles.heroTitle}>Your data protection is our priority</ThemedText>
          <ThemedText type="small" style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Here's exactly where your data lives and how it's protected
          </ThemedText>
        </View>

        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <SecuritySection key={index} {...section} />
          ))}
        </View>

        <View style={[styles.assuranceCard, { backgroundColor: theme.cardBackground }]}>
          <ThemedText type="body" style={[styles.assuranceTitle, { color: theme.text }]}>
            Our Commitment to You
          </ThemedText>
          <View style={styles.assuranceList}>
            <View style={styles.assuranceItem}>
              <View style={[styles.checkIcon, { backgroundColor: "#10B98120" }]}>
                <Feather name="check" size={14} color="#10B981" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                We collect only what's needed to power your experience: account info, affirmations, voice samples, and usage stats
              </ThemedText>
            </View>
            <View style={styles.assuranceItem}>
              <View style={[styles.checkIcon, { backgroundColor: "#10B98120" }]}>
                <Feather name="check" size={14} color="#10B981" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                We never sell or share your data to third parties
              </ThemedText>
            </View>
            <View style={styles.assuranceItem}>
              <View style={[styles.checkIcon, { backgroundColor: "#10B98120" }]}>
                <Feather name="check" size={14} color="#10B981" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                You can delete all your data at any time
              </ThemedText>
            </View>
            <View style={styles.assuranceItem}>
              <View style={[styles.checkIcon, { backgroundColor: "#10B98120" }]}>
                <Feather name="check" size={14} color="#10B981" />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                Voice data can be removed from ElevenLabs
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Delete My Data Section */}
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

      {/* Delete Confirmation Modal */}
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: "Nunito_700Bold",
  },
  sectionBody: {
    paddingLeft: 48 + Spacing.md,
  },
  highlightText: {
    fontFamily: "Nunito_700Bold",
    marginBottom: Spacing.xs,
  },
  descriptionText: {
    lineHeight: 20,
  },
  assuranceCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  assuranceTitle: {
    fontFamily: "Nunito_700Bold",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  assuranceList: {
    gap: Spacing.sm,
  },
  assuranceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  // Delete section styles
  deleteSection: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
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
  // Modal styles
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

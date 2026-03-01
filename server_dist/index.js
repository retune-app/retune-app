var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";
import { createServer } from "node:http";

// server/routes.ts
import multer2 from "multer";
import path3 from "path";
import fs3 from "fs";
import rateLimit from "express-rate-limit";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  affirmationCollections: () => affirmationCollections,
  affirmationCollectionsRelations: () => affirmationCollectionsRelations,
  affirmations: () => affirmations,
  affirmationsRelations: () => affirmationsRelations,
  analyticsEvents: () => analyticsEvents,
  authTokens: () => authTokens,
  breathingSessions: () => breathingSessions,
  breathingSessionsRelations: () => breathingSessionsRelations,
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  collections: () => collections,
  collectionsRelations: () => collectionsRelations,
  conversations: () => conversations,
  customCategories: () => customCategories,
  customCategoriesRelations: () => customCategoriesRelations,
  insertAffirmationSchema: () => insertAffirmationSchema,
  insertAnalyticsEventSchema: () => insertAnalyticsEventSchema,
  insertBreathingSessionSchema: () => insertBreathingSessionSchema,
  insertCategorySchema: () => insertCategorySchema,
  insertCollectionSchema: () => insertCollectionSchema,
  insertConversationSchema: () => insertConversationSchema,
  insertCustomCategorySchema: () => insertCustomCategorySchema,
  insertJourneyCompletionSchema: () => insertJourneyCompletionSchema,
  insertListeningSessionSchema: () => insertListeningSessionSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertNotificationSettingsSchema: () => insertNotificationSettingsSchema,
  insertOAuthUserSchema: () => insertOAuthUserSchema,
  insertPushTokenSchema: () => insertPushTokenSchema,
  insertReminderSchema: () => insertReminderSchema,
  insertSupportRequestSchema: () => insertSupportRequestSchema,
  insertUserSchema: () => insertUserSchema,
  insertVoiceSampleSchema: () => insertVoiceSampleSchema,
  journeyCompletions: () => journeyCompletions,
  journeyCompletionsRelations: () => journeyCompletionsRelations,
  listeningSessions: () => listeningSessions,
  listeningSessionsRelations: () => listeningSessionsRelations,
  messages: () => messages,
  notificationSettings: () => notificationSettings,
  notificationSettingsRelations: () => notificationSettingsRelations,
  pushTokens: () => pushTokens,
  pushTokensRelations: () => pushTokensRelations,
  reminders: () => reminders,
  remindersRelations: () => remindersRelations,
  serverErrors: () => serverErrors,
  supportRequests: () => supportRequests,
  users: () => users,
  usersRelations: () => usersRelations,
  voiceSamples: () => voiceSamples,
  voiceSamplesRelations: () => voiceSamplesRelations
});
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  // Optional for OAuth users
  name: text("name").notNull(),
  authProvider: text("auth_provider").default("email"),
  // 'email', 'google', 'apple'
  providerId: text("provider_id"),
  // OAuth provider's user ID
  avatarUrl: text("avatar_url"),
  // Profile picture from OAuth
  hasVoiceSample: boolean("has_voice_sample").default(false),
  voiceId: text("voice_id"),
  preferredVoiceType: text("preferred_voice_type").default("ai"),
  // 'personal' or 'ai'
  preferredAiGender: text("preferred_ai_gender").default("female"),
  // 'male' or 'female'
  preferredMaleVoiceId: text("preferred_male_voice_id").default("hume_orion"),
  // Default: Orion (Hume AI)
  preferredFemaleVoiceId: text("preferred_female_voice_id").default("hume_lotus"),
  // Default: Lotus (Hume AI)
  // Usage limits for App Store compliance
  voiceClonesUsed: integer("voice_clones_used").default(0),
  // Max 2 lifetime clones
  affirmationsThisMonth: integer("affirmations_this_month").default(0),
  // Max 10 AI-generated per month
  monthlyResetDate: timestamp("monthly_reset_date").default(sql`CURRENT_TIMESTAMP`),
  // When to reset monthly limits
  hasConsentedToVoiceCloning: boolean("has_consented_to_voice_cloning").default(false),
  // GDPR/privacy consent
  voiceLastUsedAt: timestamp("voice_last_used_at"),
  voiceExpiryWarningAt: timestamp("voice_expiry_warning_at"),
  ttsProvider: text("tts_provider").default("elevenlabs"),
  elevenLabsVoiceId: text("elevenlabs_voice_id"),
  cartesiaVoiceId: text("cartesia_voice_id"),
  role: text("role").default("user"),
  // 'user', 'admin', 'reviewer'
  subscriptionTier: text("subscription_tier").default("free"),
  // 'free' or 'premium'
  favoriteBreathingTechniqueId: text("favorite_breathing_technique_id"),
  active: boolean("active").default(true),
  country: text("country"),
  city: text("city"),
  timezone: text("timezone"),
  lastActiveAt: timestamp("last_active_at"),
  signupSource: text("signup_source"),
  lastLoginIp: text("last_login_ip"),
  devicePlatform: text("device_platform"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  authProvider: true,
  providerId: true,
  avatarUrl: true
});
var insertOAuthUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  authProvider: z.enum(["google", "apple"]),
  providerId: z.string(),
  avatarUrl: z.string().optional()
});
var conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var customCategories = pgTable("custom_categories", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var affirmations = pgTable("affirmations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  script: text("script").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  customCategoryId: integer("custom_category_id").references(() => customCategories.id, { onDelete: "set null" }),
  pillar: text("pillar"),
  // Main pillar category: Mind, Body, Spirit, Connection, Achievement
  categoryName: text("category_name"),
  // Comma-separated subcategory tags within the pillar
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  wordTimings: text("word_timings"),
  // JSON string of WordTiming[] for RSVP sync
  voiceType: text("voice_type").default("ai"),
  // 'personal' or 'ai' - which voice was used
  voiceGender: text("voice_gender").default("female"),
  // 'male' or 'female' for AI voices
  aiVoiceId: text("ai_voice_id"),
  // ElevenLabs voice ID used for this affirmation
  isManual: boolean("is_manual").default(false),
  isFavorite: boolean("is_favorite").default(false),
  playCount: integer("play_count").default(0),
  displayOrder: integer("display_order").default(0),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var voiceSamples = pgTable("voice_samples", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  audioUrl: text("audio_url"),
  // Nullable for privacy - file deleted after cloning
  duration: integer("duration"),
  voiceId: text("voice_id"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var listeningSessions = pgTable("listening_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  affirmationId: integer("affirmation_id").references(() => affirmations.id, { onDelete: "set null" }),
  durationSeconds: integer("duration_seconds").default(0),
  // How long they listened
  completedAt: timestamp("completed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  dateKey: text("date_key").notNull()
  // YYYY-MM-DD format for easy grouping
});
var breathingSessions = pgTable("breathing_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  techniqueId: text("technique_id").notNull(),
  // box, 478, coherent, etc.
  durationSeconds: integer("duration_seconds").notNull(),
  completedAt: timestamp("completed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  dateKey: text("date_key").notNull()
  // YYYY-MM-DD format for easy grouping
});
var supportRequests = pgTable("support_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  appVersion: text("app_version"),
  status: text("status").default("pending"),
  // pending, in_progress, resolved
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  morningEnabled: boolean("morning_enabled").default(false),
  morningTime: text("morning_time").default("08:00"),
  // HH:MM format
  afternoonEnabled: boolean("afternoon_enabled").default(false),
  afternoonTime: text("afternoon_time").default("13:00"),
  eveningEnabled: boolean("evening_enabled").default(false),
  eveningTime: text("evening_time").default("20:00"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  time: text("time").notNull(),
  enabled: boolean("enabled").default(true),
  notificationMessage: text("notification_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform").default("unknown"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var affirmationCollections = pgTable("affirmation_collections", {
  id: serial("id").primaryKey(),
  affirmationId: integer("affirmation_id").notNull().references(() => affirmations.id, { onDelete: "cascade" }),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var journeyCompletions = pgTable("journey_completions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentMood: text("current_mood").notNull(),
  targetMood: text("target_mood").notNull(),
  vibeId: text("vibe_id"),
  stepsPlanned: integer("steps_planned").notNull(),
  stepsCompleted: integer("steps_completed").notNull(),
  stepsSkipped: integer("steps_skipped").default(0),
  stepTypes: text("step_types").notNull(),
  completedFully: boolean("completed_fully").default(false),
  timeOfDay: text("time_of_day"),
  durationSeconds: integer("duration_seconds"),
  completedAt: timestamp("completed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  dateKey: text("date_key").notNull()
});
var usersRelations = relations(users, ({ many, one }) => ({
  affirmations: many(affirmations),
  voiceSamples: many(voiceSamples),
  collections: many(collections),
  customCategories: many(customCategories),
  notificationSettings: one(notificationSettings),
  reminders: many(reminders),
  pushTokens: many(pushTokens),
  listeningSessions: many(listeningSessions),
  journeyCompletions: many(journeyCompletions)
}));
var listeningSessionsRelations = relations(listeningSessions, ({ one }) => ({
  user: one(users, { fields: [listeningSessions.userId], references: [users.id] }),
  affirmation: one(affirmations, { fields: [listeningSessions.affirmationId], references: [affirmations.id] })
}));
var breathingSessionsRelations = relations(breathingSessions, ({ one }) => ({
  user: one(users, { fields: [breathingSessions.userId], references: [users.id] })
}));
var notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, { fields: [notificationSettings.userId], references: [users.id] })
}));
var remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.userId], references: [users.id] })
}));
var pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, { fields: [pushTokens.userId], references: [users.id] })
}));
var customCategoriesRelations = relations(customCategories, ({ one }) => ({
  user: one(users, { fields: [customCategories.userId], references: [users.id] })
}));
var affirmationsRelations = relations(affirmations, ({ one, many }) => ({
  user: one(users, { fields: [affirmations.userId], references: [users.id] }),
  category: one(categories, { fields: [affirmations.categoryId], references: [categories.id] }),
  collections: many(affirmationCollections)
}));
var collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  affirmations: many(affirmationCollections)
}));
var categoriesRelations = relations(categories, ({ many }) => ({
  affirmations: many(affirmations)
}));
var voiceSamplesRelations = relations(voiceSamples, ({ one }) => ({
  user: one(users, { fields: [voiceSamples.userId], references: [users.id] })
}));
var affirmationCollectionsRelations = relations(affirmationCollections, ({ one }) => ({
  affirmation: one(affirmations, { fields: [affirmationCollections.affirmationId], references: [affirmations.id] }),
  collection: one(collections, { fields: [affirmationCollections.collectionId], references: [collections.id] })
}));
var journeyCompletionsRelations = relations(journeyCompletions, ({ one }) => ({
  user: one(users, { fields: [journeyCompletions.userId], references: [users.id] })
}));
var insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});
var insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true
});
var insertAffirmationSchema = createInsertSchema(affirmations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertVoiceSampleSchema = createInsertSchema(voiceSamples).omit({
  id: true,
  createdAt: true
});
var insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true
});
var insertCustomCategorySchema = createInsertSchema(customCategories).omit({
  id: true,
  createdAt: true
});
var insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertListeningSessionSchema = createInsertSchema(listeningSessions).omit({
  id: true,
  completedAt: true
});
var insertBreathingSessionSchema = createInsertSchema(breathingSessions).omit({
  id: true,
  completedAt: true
});
var insertSupportRequestSchema = createInsertSchema(supportRequests).omit({
  id: true,
  createdAt: true,
  status: true
});
var insertReminderSchema = createInsertSchema(reminders).omit({
  id: true,
  createdAt: true
});
var insertPushTokenSchema = createInsertSchema(pushTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertJourneyCompletionSchema = createInsertSchema(journeyCompletions).omit({
  id: true,
  completedAt: true
});
var serverErrors = pgTable("server_errors", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("error"),
  component: text("component"),
  message: text("message").notNull(),
  stack: text("stack"),
  metadata: jsonb("metadata"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  eventName: text("event_name").notNull(),
  properties: jsonb("properties"),
  screenName: text("screen_name"),
  platform: text("platform"),
  appVersion: text("app_version"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true
});

// server/db.ts
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 1e4,
  idleTimeoutMillis: 3e4,
  max: 20
});
var db = drizzle(pool, { schema: schema_exports });

// server/routes.ts
import { eq as eq8, desc as desc3, asc, and as and6, sql as sql7, isNull, isNotNull as isNotNull4 } from "drizzle-orm";

// server/replit_integrations/audio/client.ts
import OpenAI, { toFile } from "openai";
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

// server/routes.ts
import OpenAI3 from "openai";

// server/premium.ts
var FREE_FEATURES = [
  "Breathing exercises (10 techniques)",
  "Focus Reading Mode",
  "Up to 20 AI affirmations per month",
  "2 AI voices (Lotus & Sage)",
  "Ambient sound library",
  "Daily reminders (up to 5)",
  "Basic listening analytics"
];
var PREMIUM_FEATURES_LIST = [
  "Affirmations \u2014 AI personalized voice",
  "Micro-Meditations \u2014 AI personalized voice",
  "Mood Journey \u2014 personalized wellness paths",
  "Inner Voice - personal voice cloning",
  "25+ ambient soundscapes",
  "Unlimited AI affirmations",
  "Advanced analytics & insights",
  "Priority support",
  "Early access to new features"
];
var BETA_MODE = true;
function isPremiumUser(user) {
  if (BETA_MODE) return true;
  return user.subscriptionTier === "premium";
}

// shared/vibes.ts
var VIBES = {
  reset: {
    id: "reset",
    label: "Reset",
    subtitle: "I need to start fresh",
    description: "Clearing out the old, making space for what's next",
    moodMapping: {
      startingMoods: ["overwhelmed", "stressed", "scattered"],
      targetMoods: ["calm", "focused", "grounded"]
    },
    tts: {
      scriptTone: "Clear, steady, and renewing. Like the first breath after a storm passes. Use language that acknowledges what was and opens space for what's coming.",
      humeSpeed: 0.9,
      pauseSeconds: 1.5,
      elevenLabsStability: 0.55,
      elevenLabsStyle: 0.3
    },
    breathing: {
      primaryTechniqueId: "box",
      primaryTechniqueName: "Box Breathing",
      fallbackTechniqueId: "478",
      fallbackTechniqueName: "4-7-8 Relaxation",
      suggestedDuration: 180
    },
    ambient: {
      preferredCategories: ["nature", "water"],
      preferredSounds: ["morning-rain", "gentle-stream", "morning-birds"]
    },
    language: {
      tonePrompt: "Fresh start energy. Acknowledge what they're leaving behind without dwelling. Forward-looking but not pushy. Clean, simple sentences.",
      avoidWords: ["just", "simply", "easy", "forget"],
      sentenceStyle: "short_declarative"
    },
    meditation: {
      style: "clearing",
      focusArea: "Releasing what's done, arriving in the present",
      ttsConfig: {
        scriptTone: "Steady, clearing, and spacious. Like sweeping a room clean. Each phrase creates more open space.",
        humeSpeed: 0.88,
        pauseSeconds: 1.7,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.3
      }
    },
    matching: {
      boostTags: ["Clarity", "Letting Go", "Calm", "Focus", "Resilience"],
      boostPillars: ["Mind", "Spirit"],
      penaltyTags: ["Drive", "Energy"]
    },
    ui: {
      accentColor: "#50C9B0",
      gradientColors: ["#50C9B0", "#3BA89A"],
      icon: "refresh-cw"
    }
  },
  chill: {
    id: "chill",
    label: "Chill",
    subtitle: "I need to calm down",
    description: "Slowing everything down, finding ease",
    moodMapping: {
      startingMoods: ["stressed", "anxious", "wired"],
      targetMoods: ["calm", "grounded"]
    },
    tts: {
      scriptTone: "Soft, unhurried, and soothing. Like sinking into a warm bath. Use languid, flowing language with natural pauses.",
      humeSpeed: 0.85,
      pauseSeconds: 1.8,
      elevenLabsStability: 0.6,
      elevenLabsStyle: 0.25
    },
    breathing: {
      primaryTechniqueId: "calming-2to1",
      primaryTechniqueName: "2:1 Calming Breath",
      fallbackTechniqueId: "coherent",
      fallbackTechniqueName: "Coherent Breathing",
      suggestedDuration: 180
    },
    ambient: {
      preferredCategories: ["water", "nature"],
      preferredSounds: ["ocean-waves", "gentle-rain", "forest-night"]
    },
    language: {
      tonePrompt: "Calm and easy. No urgency. Words that feel like exhaling. Invite them to let go without forcing it.",
      avoidWords: ["hustle", "push", "achieve", "power"],
      sentenceStyle: "flowing_gentle"
    },
    meditation: {
      style: "body_scan",
      focusArea: "Releasing tension, softening the body",
      ttsConfig: {
        scriptTone: "Serene, spacious, and deeply unhurried. Like floating on still water. Use languid, flowing language with long vowel sounds.",
        humeSpeed: 0.85,
        pauseSeconds: 1.8,
        elevenLabsStability: 0.6,
        elevenLabsStyle: 0.25
      }
    },
    matching: {
      boostTags: ["Calm", "Inner Peace", "Letting Go", "Presence", "Healing"],
      boostPillars: ["Spirit", "Mind"],
      penaltyTags: ["Drive", "Energy", "Discipline"]
    },
    ui: {
      accentColor: "#7B68EE",
      gradientColors: ["#7B68EE", "#6252CC"],
      icon: "cloud"
    }
  },
  locked_in: {
    id: "locked_in",
    label: "Locked In",
    subtitle: "I need to focus",
    description: "Sharpening up, cutting through the noise",
    moodMapping: {
      startingMoods: ["tired", "good", "scattered"],
      targetMoods: ["focused", "determined", "energized"]
    },
    tts: {
      scriptTone: "Clear, precise, and direct. Like a laser cutting through fog. Each word lands with purpose. No filler, no fluff.",
      humeSpeed: 0.95,
      pauseSeconds: 1.2,
      elevenLabsStability: 0.5,
      elevenLabsStyle: 0.4
    },
    breathing: {
      primaryTechniqueId: "box",
      primaryTechniqueName: "Box Breathing",
      fallbackTechniqueId: "vishama-vritti",
      fallbackTechniqueName: "Vishama Vritti",
      suggestedDuration: 120
    },
    ambient: {
      preferredCategories: ["focus", "minimal"],
      preferredSounds: ["brown-noise", "deep-focus", "white-noise"]
    },
    language: {
      tonePrompt: "Sharp and clean. Coach energy without the rah-rah. Direct statements that cut through mental fog. Confident, not aggressive.",
      avoidWords: ["maybe", "try", "hope", "wish"],
      sentenceStyle: "short_punchy"
    },
    meditation: {
      style: "focused_attention",
      focusArea: "Sharpening awareness, quieting distraction",
      ttsConfig: {
        scriptTone: "Clear, precise, and centering. Like a laser beam of gentle attention cutting through noise. Clean, purposeful language.",
        humeSpeed: 0.92,
        pauseSeconds: 1.5,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.3
      }
    },
    matching: {
      boostTags: ["Focus", "Clarity", "Discipline", "Drive", "Purpose"],
      boostPillars: ["Mind", "Achievement"],
      penaltyTags: ["Sleep", "Comfort", "Letting Go"]
    },
    ui: {
      accentColor: "#42A5F5",
      gradientColors: ["#42A5F5", "#1E88E5"],
      icon: "crosshair"
    }
  },
  glow_up: {
    id: "glow_up",
    label: "Glow Up",
    subtitle: "I want to feel good about myself",
    description: "Building yourself up from the inside out",
    moodMapping: {
      startingMoods: ["sad", "good", "frustrated"],
      targetMoods: ["confident", "joyful", "lit_up"]
    },
    tts: {
      scriptTone: "Warm, affirming, and uplifting. Like sunlight on your face. Confident without being aggressive. Celebrating who you are.",
      humeSpeed: 0.93,
      pauseSeconds: 1.4,
      elevenLabsStability: 0.5,
      elevenLabsStyle: 0.4
    },
    breathing: {
      primaryTechniqueId: "coherent",
      primaryTechniqueName: "Coherent Breathing",
      fallbackTechniqueId: "energizing",
      fallbackTechniqueName: "Energizing Breath",
      suggestedDuration: 180
    },
    ambient: {
      preferredCategories: ["uplifting", "nature"],
      preferredSounds: ["morning-birds", "sunrise-ambient", "warm-breeze"]
    },
    language: {
      tonePrompt: "Warm confidence. Build them up without being cheesy. Words that make them stand taller. Genuine, not performative.",
      avoidWords: ["perfect", "flawless", "amazing", "incredible"],
      sentenceStyle: "affirming_natural"
    },
    meditation: {
      style: "self_compassion",
      focusArea: "Reconnecting with inner strength and worth",
      ttsConfig: {
        scriptTone: "Warm, reverent, and heart-centered. Like sunlight pouring through a window. Rich, appreciative language that savors each quality.",
        humeSpeed: 0.9,
        pauseSeconds: 1.6,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.35
      }
    },
    matching: {
      boostTags: ["Confidence", "Body Love", "Joy", "Gratitude", "Growth"],
      boostPillars: ["Mind", "Connection", "Spirit"],
      penaltyTags: ["Sleep", "Discipline"]
    },
    ui: {
      accentColor: "#F5A623",
      gradientColors: ["#F5A623", "#E5961F"],
      icon: "star"
    }
  },
  in_my_head: {
    id: "in_my_head",
    label: "In My Head",
    subtitle: "I can't stop overthinking",
    description: "Getting out of the loop, back into the body",
    moodMapping: {
      startingMoods: ["anxious", "overwhelmed", "scattered", "wired"],
      targetMoods: ["calm", "focused", "grounded"]
    },
    tts: {
      scriptTone: "Grounding, steady, and anchoring. Like roots growing deep into earth. Concrete, physical language. Repeat grounding cues. Prioritize predictability.",
      humeSpeed: 0.9,
      pauseSeconds: 1.7,
      elevenLabsStability: 0.6,
      elevenLabsStyle: 0.2
    },
    breathing: {
      primaryTechniqueId: "physio-sigh",
      primaryTechniqueName: "Physiological Sigh",
      fallbackTechniqueId: "triangle",
      fallbackTechniqueName: "Triangle Breathing",
      suggestedDuration: 180
    },
    ambient: {
      preferredCategories: ["nature", "grounding"],
      preferredSounds: ["rain-on-leaves", "forest-ambience", "creek-water"]
    },
    language: {
      tonePrompt: "Grounding and physical. Pull them out of their head and into their body. Name physical sensations. Short sentences that anchor.",
      avoidWords: ["think", "analyze", "figure out", "understand"],
      sentenceStyle: "grounding_physical"
    },
    meditation: {
      style: "body_scan",
      focusArea: "Leaving the mind, arriving in the body",
      ttsConfig: {
        scriptTone: "Grounding, steady, and anchoring. Use concrete, physical language \u2014 feet on ground, weight of body, solid surfaces. Repeat grounding cues.",
        humeSpeed: 0.9,
        pauseSeconds: 1.7,
        elevenLabsStability: 0.6,
        elevenLabsStyle: 0.2
      }
    },
    matching: {
      boostTags: ["Calm", "Presence", "Letting Go", "Inner Peace", "Clarity"],
      boostPillars: ["Mind", "Spirit"],
      penaltyTags: ["Drive", "Achievement", "Discipline"]
    },
    ui: {
      accentColor: "#4FC3F7",
      gradientColors: ["#4FC3F7", "#29B6F6"],
      icon: "wind"
    }
  },
  steady: {
    id: "steady",
    label: "Steady",
    subtitle: "I'm good, keep it going",
    description: "Maintaining your balance, deepening what's working",
    moodMapping: {
      startingMoods: ["good", "calm"],
      targetMoods: ["grateful", "joyful", "grounded"]
    },
    tts: {
      scriptTone: "Warm, grounded, and present. Like sitting by a fire with someone you trust. Unhurried, appreciative, savoring.",
      humeSpeed: 0.9,
      pauseSeconds: 1.5,
      elevenLabsStability: 0.55,
      elevenLabsStyle: 0.35
    },
    breathing: {
      primaryTechniqueId: "coherent",
      primaryTechniqueName: "Coherent Breathing",
      fallbackTechniqueId: "box",
      fallbackTechniqueName: "Box Breathing",
      suggestedDuration: 180
    },
    ambient: {
      preferredCategories: ["nature", "peaceful"],
      preferredSounds: ["gentle-breeze", "birds-morning", "campfire"]
    },
    language: {
      tonePrompt: "Quiet strength. Acknowledge how good it feels to be here. Deepen what's already working. No urgency to change anything.",
      avoidWords: ["fix", "improve", "change", "need to"],
      sentenceStyle: "appreciative_steady"
    },
    meditation: {
      style: "open_awareness",
      focusArea: "Savoring the present, deepening gratitude",
      ttsConfig: {
        scriptTone: "Warm, reverent, and heart-centered. Appreciative language that savors each moment and connection. Unhurried and present.",
        humeSpeed: 0.9,
        pauseSeconds: 1.6,
        elevenLabsStability: 0.55,
        elevenLabsStyle: 0.35
      }
    },
    matching: {
      boostTags: ["Gratitude", "Presence", "Inner Peace", "Joy", "Love"],
      boostPillars: ["Spirit", "Connection"],
      penaltyTags: ["Drive", "Discipline"]
    },
    ui: {
      accentColor: "#C9A227",
      gradientColors: ["#E5C95C", "#C9A227"],
      icon: "anchor"
    }
  },
  fired_up: {
    id: "fired_up",
    label: "Fired Up",
    subtitle: "I'm ready to go",
    description: "Channeling raw energy into unstoppable momentum",
    moodMapping: {
      startingMoods: ["good", "wired", "tired"],
      targetMoods: ["energized", "confident", "lit_up", "determined"]
    },
    tts: {
      scriptTone: "Bold, powerful, and activating. Like standing at the edge of something big. Confident, forward-moving, direct. Energy without aggression.",
      humeSpeed: 1,
      pauseSeconds: 0.9,
      elevenLabsStability: 0.4,
      elevenLabsStyle: 0.5
    },
    breathing: {
      primaryTechniqueId: "energizing",
      primaryTechniqueName: "Energizing Breath",
      fallbackTechniqueId: "box",
      fallbackTechniqueName: "Box Breathing",
      suggestedDuration: 120
    },
    ambient: {
      preferredCategories: ["energy", "focus"],
      preferredSounds: ["beta-waves", "power-drone", "heartbeat"]
    },
    language: {
      tonePrompt: "High energy but grounded. Coach before the big game. Direct, punchy, no fluff. Make them feel capable and ready.",
      avoidWords: ["relax", "slow down", "gentle", "soft"],
      sentenceStyle: "punchy_empowering"
    },
    meditation: {
      style: "visualization",
      focusArea: "Seeing success, feeling power in the body",
      ttsConfig: {
        scriptTone: "Strong, grounded, and empowering. Bold language that reinforces inner strength and self-trust. Forward-moving and direct.",
        humeSpeed: 0.95,
        pauseSeconds: 1.4,
        elevenLabsStability: 0.5,
        elevenLabsStyle: 0.4
      }
    },
    matching: {
      boostTags: ["Energy", "Drive", "Confidence", "Purpose", "Growth"],
      boostPillars: ["Achievement", "Body"],
      penaltyTags: ["Sleep", "Calm", "Comfort", "Letting Go"]
    },
    ui: {
      accentColor: "#E85D5D",
      gradientColors: ["#E85D5D", "#D04545"],
      icon: "zap"
    }
  },
  heavy: {
    id: "heavy",
    label: "Heavy",
    subtitle: "I'm carrying a lot right now",
    description: "Making space for what hurts, without rushing through it",
    moodMapping: {
      startingMoods: ["sad", "overwhelmed", "frustrated"],
      targetMoods: ["calm", "grateful", "grounded"]
    },
    tts: {
      scriptTone: "Tender, compassionate, and unhurried. Like being held by someone who gets it. No silver linings, no fixing. Just presence and warmth.",
      humeSpeed: 0.85,
      pauseSeconds: 2,
      elevenLabsStability: 0.6,
      elevenLabsStyle: 0.2
    },
    breathing: {
      primaryTechniqueId: "coherent",
      primaryTechniqueName: "Coherent Breathing",
      fallbackTechniqueId: "deep-relax-7211",
      fallbackTechniqueName: "7-2-11 Deep Relaxation",
      suggestedDuration: 180
    },
    ambient: {
      preferredCategories: ["gentle", "comfort"],
      preferredSounds: ["soft-rain", "warm-fire", "gentle-piano"]
    },
    language: {
      tonePrompt: "Deeply compassionate. No toxic positivity. No 'it gets better.' Acknowledge the weight. Be present with them. Gentle and honest.",
      avoidWords: ["positive", "bright side", "get over", "move on", "strong", "warrior"],
      sentenceStyle: "compassionate_slow"
    },
    meditation: {
      style: "loving_kindness",
      focusArea: "Self-compassion, being gentle with yourself",
      ttsConfig: {
        scriptTone: "Warm, tender, and compassionate. Like being gently held by someone who truly understands. Soft, comforting language that acknowledges pain without rushing past it.",
        humeSpeed: 0.85,
        pauseSeconds: 2,
        elevenLabsStability: 0.6,
        elevenLabsStyle: 0.2
      }
    },
    matching: {
      boostTags: ["Healing", "Self-Compassion", "Comfort", "Inner Peace", "Love"],
      boostPillars: ["Connection", "Spirit", "Home"],
      penaltyTags: ["Drive", "Energy", "Discipline", "Achievement"]
    },
    ui: {
      accentColor: "#7986CB",
      gradientColors: ["#7986CB", "#5C6BC0"],
      icon: "cloud-rain"
    }
  }
};
var VIBE_LIST = ["reset", "chill", "locked_in", "glow_up", "in_my_head", "steady", "fired_up", "heavy"];
function getVibeConfig(vibeId) {
  return VIBES[vibeId];
}
function getStartingMoodForVibe(vibeId) {
  return VIBES[vibeId].moodMapping.startingMoods[0];
}
function getTargetMoodForVibe(vibeId) {
  return VIBES[vibeId].moodMapping.targetMoods[0];
}
function resolveVibeFromMoodPair(startingMood, targetMood) {
  let bestVibe = "reset";
  let bestScore = -1;
  for (const vibeId of VIBE_LIST) {
    const vibe = VIBES[vibeId];
    let score = 0;
    if (vibe.moodMapping.startingMoods.includes(startingMood)) {
      score += vibe.moodMapping.startingMoods.indexOf(startingMood) === 0 ? 3 : 2;
    }
    if (vibe.moodMapping.targetMoods.includes(targetMood)) {
      score += vibe.moodMapping.targetMoods.indexOf(targetMood) === 0 ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestVibe = vibeId;
    }
  }
  return bestVibe;
}

// server/vibe-engine.ts
function routeVibe(vibeId) {
  const vibe = getVibeConfig(vibeId);
  if (!vibe) return null;
  return {
    vibeId: vibe.id,
    vibe,
    startingMood: getStartingMoodForVibe(vibe.id),
    targetMood: getTargetMoodForVibe(vibe.id),
    breathingTechniqueId: vibe.breathing.primaryTechniqueId,
    breathingTechniqueName: vibe.breathing.primaryTechniqueName,
    suggestedBreathingDuration: vibe.breathing.suggestedDuration,
    tts: vibe.tts,
    meditationStyle: vibe.meditation.style,
    meditationFocus: vibe.meditation.focusArea,
    meditationTTS: vibe.meditation.ttsConfig,
    matching: vibe.matching,
    ambientSounds: vibe.ambient.preferredSounds,
    ambientCategories: vibe.ambient.preferredCategories,
    languageTone: vibe.language.tonePrompt,
    languageAvoidWords: vibe.language.avoidWords,
    accentColor: vibe.ui.accentColor,
    icon: vibe.ui.icon
  };
}
function scoreAffirmationForVibe(affirmation, matching, userPreferredVoiceType) {
  let score = 0;
  const tags = (affirmation.categoryName || "").split(",").map((t) => t.trim()).filter(Boolean);
  const tagMatches = tags.filter((t) => matching.boostTags.includes(t)).length;
  score += tagMatches * 4;
  if (affirmation.pillar && matching.boostPillars.includes(affirmation.pillar)) {
    score += matching.boostPillars.indexOf(affirmation.pillar) === 0 ? 3 : 2;
  }
  const penaltyMatches = tags.filter((t) => matching.penaltyTags.includes(t)).length;
  score -= penaltyMatches * 3;
  if (affirmation.isFavorite) score += 1;
  if (affirmation.voiceType === userPreferredVoiceType) score += 1;
  return score;
}
function pickBestAffirmation(affirmations2, matching, userPreferredVoiceType) {
  const withAudio = affirmations2.filter((a) => a.audioUrl);
  if (withAudio.length === 0) return null;
  const scored = withAudio.map((a) => ({
    affirmation: a,
    score: scoreAffirmationForVibe(a, matching, userPreferredVoiceType)
  }));
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0].score;
  if (topScore > 0) {
    const topPool = scored.filter((a) => a.score === topScore);
    const picked = topPool[Math.floor(Math.random() * topPool.length)];
    return {
      affirmation: picked.affirmation,
      matchReason: topScore >= 4 ? "tag" : "pillar"
    };
  }
  return {
    affirmation: withAudio[Math.floor(Math.random() * withAudio.length)],
    matchReason: "any"
  };
}
function getSuggestedCreationTheme(vibeId, timeOfDay) {
  const themes = {
    reset: { morning: "starting fresh with clear intentions", afternoon: "clearing mental clutter and resetting", evening: "releasing the day and making space", night: "letting go and preparing for renewal" },
    chill: { morning: "calm energy to start your day", afternoon: "finding ease in the middle of everything", evening: "unwinding and settling into peace", night: "deep relaxation and restful surrender" },
    locked_in: { morning: "sharp focus for what matters most today", afternoon: "cutting through distraction and delivering", evening: "clarity on tomorrow's priorities", night: "planting focused intentions while you rest" },
    determined: { morning: "building resolve for what matters most today", afternoon: "pushing through with unwavering purpose", evening: "strengthening your commitment to your path", night: "letting determination take root while you rest" },
    glow_up: { morning: "stepping into your best self today", afternoon: "owning your strengths right now", evening: "celebrating who you're becoming", night: "letting confidence build while you sleep" },
    in_my_head: { morning: "grounding yourself before the day begins", afternoon: "getting out of the loop and into the moment", evening: "releasing overthinking and finding stillness", night: "quieting the mind for peaceful sleep" },
    steady: { morning: "deepening your natural rhythm", afternoon: "sustaining your flow and presence", evening: "appreciating how far you've come", night: "resting in gratitude and contentment" },
    fired_up: { morning: "channeling your energy into action", afternoon: "maintaining your unstoppable momentum", evening: "carrying your fire into tomorrow", night: "letting your ambition recharge overnight" },
    heavy: { morning: "being gentle with yourself today", afternoon: "making space for what you're feeling", evening: "honoring your emotions without rushing", night: "resting your heart and trusting the process" }
  };
  return themes[vibeId]?.[timeOfDay] || "your current emotional state";
}
function getVibeJourneyPromptContext(vibeId) {
  const vibe = getVibeConfig(vibeId);
  if (!vibe) return "";
  return `The user selected the "${vibe.label}" vibe ("${vibe.subtitle}"). This means: ${vibe.description}. 
Tone guidance: ${vibe.language.tonePrompt}
Words/phrases to avoid: ${vibe.language.avoidWords.join(", ")}`;
}

// server/replit_integrations/elevenlabs/client.ts
import { ElevenLabsClient } from "elevenlabs";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
var SENTENCE_PAUSE_SECONDS = 1.5;
function findSentenceEndIndices(words) {
  const indices = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i].word;
    if (/[.!?]["']?$/.test(word)) {
      indices.push(i);
    }
  }
  return indices;
}
function adjustWordTimingsForPauses(wordTimings, sentenceEndIndices, pauseMs) {
  if (sentenceEndIndices.length === 0) return wordTimings;
  const adjusted = [];
  let cumulativePause = 0;
  let nextPauseIndex = 0;
  for (let i = 0; i < wordTimings.length; i++) {
    const word = wordTimings[i];
    adjusted.push({
      word: word.word,
      startMs: word.startMs + cumulativePause,
      endMs: word.endMs + cumulativePause
    });
    if (nextPauseIndex < sentenceEndIndices.length && i === sentenceEndIndices[nextPauseIndex] && i < wordTimings.length - 1) {
      cumulativePause += pauseMs;
      nextPauseIndex++;
    }
  }
  return adjusted;
}
async function insertSilenceIntoAudio(audioBuffer, wordTimings, sentenceEndIndices, pauseSeconds) {
  if (sentenceEndIndices.length === 0 || sentenceEndIndices.every((i) => i >= wordTimings.length - 1)) {
    return audioBuffer;
  }
  const inputPath = join(tmpdir(), `input-${randomUUID()}.mp3`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.mp3`);
  const silencePath = join(tmpdir(), `silence-${randomUUID()}.mp3`);
  const concatListPath = join(tmpdir(), `concat-${randomUUID()}.txt`);
  try {
    await writeFile(inputPath, audioBuffer);
    await new Promise((resolve2, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-f",
        "lavfi",
        "-i",
        `anullsrc=r=44100:cl=mono`,
        "-t",
        pauseSeconds.toString(),
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        "-y",
        silencePath
      ]);
      ffmpeg.stderr.on("data", () => {
      });
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve2();
        else reject(new Error(`ffmpeg silence generation exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    const splitPositions = [];
    for (const idx of sentenceEndIndices) {
      if (idx < wordTimings.length - 1) {
        splitPositions.push(wordTimings[idx].endMs / 1e3);
      }
    }
    if (splitPositions.length === 0) {
      return audioBuffer;
    }
    const segments = [];
    let lastPos = 0;
    for (let i = 0; i < splitPositions.length; i++) {
      const segmentPath = join(tmpdir(), `segment-${randomUUID()}-${i}.mp3`);
      const startTime = lastPos;
      const endTime = splitPositions[i];
      await new Promise((resolve2, reject) => {
        const ffmpeg = spawn("ffmpeg", [
          "-i",
          inputPath,
          "-ss",
          startTime.toString(),
          "-to",
          endTime.toString(),
          "-c:a",
          "libmp3lame",
          "-q:a",
          "2",
          "-ar",
          "44100",
          "-y",
          segmentPath
        ]);
        ffmpeg.stderr.on("data", () => {
        });
        ffmpeg.on("close", (code) => {
          if (code === 0) resolve2();
          else reject(new Error(`ffmpeg segment extraction exited with code ${code}`));
        });
        ffmpeg.on("error", reject);
      });
      segments.push(segmentPath);
      lastPos = endTime;
    }
    const finalSegmentPath = join(tmpdir(), `segment-${randomUUID()}-final.mp3`);
    await new Promise((resolve2, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        inputPath,
        "-ss",
        lastPos.toString(),
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        "-ar",
        "44100",
        "-y",
        finalSegmentPath
      ]);
      ffmpeg.stderr.on("data", () => {
      });
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve2();
        else reject(new Error(`ffmpeg final segment extraction exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    segments.push(finalSegmentPath);
    let concatContent = "";
    for (let i = 0; i < segments.length; i++) {
      concatContent += `file '${segments[i]}'
`;
      if (i < segments.length - 1) {
        concatContent += `file '${silencePath}'
`;
      }
    }
    await writeFile(concatListPath, concatContent);
    await new Promise((resolve2, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        "-ar",
        "44100",
        "-y",
        outputPath
      ]);
      ffmpeg.stderr.on("data", () => {
      });
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve2();
        else reject(new Error(`ffmpeg concat exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });
    const result = await readFile(outputPath);
    const filesToClean = [inputPath, outputPath, silencePath, concatListPath, ...segments];
    await Promise.all(filesToClean.map((f) => unlink(f).catch(() => {
    })));
    return result;
  } catch (error) {
    console.error("Error inserting silence into audio:", error);
    await Promise.all([
      unlink(inputPath).catch(() => {
      }),
      unlink(outputPath).catch(() => {
      }),
      unlink(silencePath).catch(() => {
      }),
      unlink(concatListPath).catch(() => {
      })
    ]);
    return audioBuffer;
  }
}
var connectionSettings;
var credentialsCachedAt = 0;
var CREDENTIALS_TTL_MS = 5 * 60 * 1e3;
async function getCredentials() {
  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }
  if (connectionSettings?.settings?.api_key && Date.now() - credentialsCachedAt < CREDENTIALS_TTL_MS) {
    return connectionSettings.settings.api_key;
  }
  connectionSettings = null;
  let hostname = process.env.REPLIT_CONNECTORS_HOSTNAME || "";
  if (hostname.startsWith("https://")) {
    hostname = hostname.replace("https://", "");
  }
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=elevenlabs",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("ElevenLabs not connected");
  }
  credentialsCachedAt = Date.now();
  return connectionSettings.settings.api_key;
}
async function getElevenLabsClient() {
  const apiKey = await getCredentials();
  return new ElevenLabsClient({ apiKey });
}
async function cloneVoice(audioFilePath, name = "Inner Voice") {
  const apiKey = await getCredentials();
  const fileBuffer = fs.readFileSync(audioFilePath);
  const fileName = path.basename(audioFilePath);
  const formData = new FormData();
  formData.append("name", name);
  formData.append("files", new Blob([fileBuffer]), fileName);
  formData.append("description", "User voice for personalized affirmations");
  const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey
    },
    body: formData
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Voice cloning error:", response.status, errorText);
    let parsedDetail = "";
    try {
      const errorJson = JSON.parse(errorText);
      parsedDetail = errorJson?.detail?.message || errorJson?.detail || errorJson?.error || "";
    } catch (_) {
      parsedDetail = errorText;
    }
    const err = new Error(parsedDetail || `Voice cloning failed: ${response.statusText}`);
    err.statusCode = response.status;
    err.elevenLabsDetail = parsedDetail;
    throw err;
  }
  const result = await response.json();
  return result.voice_id;
}
async function textToSpeech(text2, voiceId = "21m00Tcm4TlvDq8ikWAM", voiceSettingsOverride) {
  const apiKey = await getCredentials();
  const effectivePause = voiceSettingsOverride?.pauseSeconds ?? SENTENCE_PAUSE_SECONDS;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text2,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: voiceSettingsOverride?.stability ?? 0.5,
          similarity_boost: 0.75,
          style: voiceSettingsOverride?.style ?? 0.3,
          use_speaker_boost: true
        }
      })
    }
  );
  if (!response.ok) {
    const error = await response.text();
    console.error("TTS error:", error);
    throw new Error(`TTS failed: ${response.statusText}`);
  }
  const result = await response.json();
  const audioBase64 = result.audio_base64;
  const rawAudioBuffer = Buffer.from(audioBase64, "base64");
  let wordTimings = parseCharacterTimingsToWords(result.alignment);
  const sentenceEndIndices = findSentenceEndIndices(wordTimings);
  let finalAudioBuffer = rawAudioBuffer;
  if (sentenceEndIndices.length > 0 && effectivePause > 0) {
    finalAudioBuffer = await insertSilenceIntoAudio(
      rawAudioBuffer,
      wordTimings,
      sentenceEndIndices,
      effectivePause
    );
    wordTimings = adjustWordTimingsForPauses(
      wordTimings,
      sentenceEndIndices,
      effectivePause * 1e3
    );
  }
  let estimatedDuration;
  if (wordTimings.length > 0 && typeof wordTimings[wordTimings.length - 1].endMs === "number" && !isNaN(wordTimings[wordTimings.length - 1].endMs)) {
    estimatedDuration = Math.ceil(wordTimings[wordTimings.length - 1].endMs / 1e3);
  } else {
    const wordCount = text2.split(/\s+/).filter((w) => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil(wordCount / 150 * 60));
  }
  if (isNaN(estimatedDuration) || estimatedDuration <= 0) {
    const wordCount = text2.split(/\s+/).filter((w) => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil(wordCount / 150 * 60));
  }
  const audioArrayBuffer = new Uint8Array(finalAudioBuffer).buffer;
  return {
    audio: audioArrayBuffer,
    duration: estimatedDuration,
    wordTimings
  };
}
function parseCharacterTimingsToWords(alignment) {
  if (!alignment) {
    console.warn("No alignment data provided");
    return [];
  }
  if (alignment.characters && alignment.character_start_times_seconds && alignment.character_end_times_seconds) {
    const chars = typeof alignment.characters === "string" ? alignment.characters.split("") : Array.isArray(alignment.characters) ? alignment.characters : [];
    if (chars.length === 0) {
      console.warn("No characters found in alignment");
      return [];
    }
    const words = [];
    let currentWord = "";
    let wordStartMs = null;
    let wordEndMs = 0;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const startTime = alignment.character_start_times_seconds[i];
      const endTime = alignment.character_end_times_seconds[i];
      if (startTime === void 0 || startTime === null || isNaN(startTime) || endTime === void 0 || endTime === null || isNaN(endTime)) {
        continue;
      }
      const startMs = Math.round(startTime * 1e3);
      const endMs = Math.round(endTime * 1e3);
      if (char === void 0 || char === null) continue;
      if (char === " " || char === "\n" || char === "\r" || char === "	") {
        if (currentWord.length > 0 && wordStartMs !== null) {
          words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
        }
        currentWord = "";
        wordStartMs = null;
      } else {
        if (wordStartMs === null) {
          wordStartMs = startMs;
        }
        currentWord += char;
        wordEndMs = endMs;
      }
    }
    if (currentWord.length > 0 && wordStartMs !== null) {
      words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
    }
    const validWords = words.filter(
      (w) => w.word && typeof w.word === "string" && !w.word.includes("undefined") && !isNaN(w.startMs) && !isNaN(w.endMs)
    );
    return validWords;
  }
  if (alignment.chars && alignment.charStartTimesMs && alignment.charDurationsMs) {
    const words = [];
    let currentWord = "";
    let wordStartMs = null;
    let wordEndMs = 0;
    for (let i = 0; i < alignment.chars.length; i++) {
      const char = alignment.chars[i];
      const startMs = alignment.charStartTimesMs[i];
      const durationMs = alignment.charDurationsMs[i];
      const endMs = startMs + durationMs;
      if (char === void 0 || char === null) continue;
      if (char === " " || char === "\n" || char === "\r" || char === "	") {
        if (currentWord.length > 0 && wordStartMs !== null) {
          words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
        }
        currentWord = "";
        wordStartMs = null;
      } else {
        if (wordStartMs === null) {
          wordStartMs = startMs;
        }
        currentWord += char;
        wordEndMs = endMs;
      }
    }
    if (currentWord.length > 0 && wordStartMs !== null) {
      words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
    }
    return words;
  }
  if (alignment.characters && Array.isArray(alignment.characters) && alignment.characters.length > 0 && typeof alignment.characters[0] === "object") {
    const words = [];
    let currentWord = "";
    let wordStartMs = null;
    let wordEndMs = 0;
    for (const charData of alignment.characters) {
      const char = charData.character;
      if (char === void 0 || char === null) continue;
      if (char === " " || char === "\n" || char === "\r" || char === "	") {
        if (currentWord.length > 0 && wordStartMs !== null) {
          words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
        }
        currentWord = "";
        wordStartMs = null;
      } else {
        if (wordStartMs === null) {
          wordStartMs = charData.start_time_ms;
        }
        currentWord += char;
        wordEndMs = charData.end_time_ms;
      }
    }
    if (currentWord.length > 0 && wordStartMs !== null) {
      words.push({ word: currentWord, startMs: wordStartMs, endMs: wordEndMs });
    }
    return words;
  }
  console.warn("Unrecognized alignment format. Full structure:", JSON.stringify(alignment).substring(0, 500));
  return [];
}
async function listVoices() {
  const apiKey = await getCredentials();
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: {
      "xi-api-key": apiKey
    }
  });
  if (!response.ok) {
    throw new Error("Failed to list voices");
  }
  const result = await response.json();
  return result.voices;
}
async function deleteVoice(voiceId) {
  const apiKey = await getCredentials();
  const response = await fetch(
    `https://api.elevenlabs.io/v1/voices/${voiceId}`,
    {
      method: "DELETE",
      headers: {
        "xi-api-key": apiKey
      }
    }
  );
  if (!response.ok) {
    throw new Error("Failed to delete voice");
  }
}
async function generateSoundEffect(text2, durationSeconds = 22, promptInfluence = 0.3) {
  const apiKey = await getCredentials();
  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: text2,
      duration_seconds: durationSeconds,
      prompt_influence: promptInfluence
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error("Sound generation error:", error);
    throw new Error(`Sound generation failed: ${response.statusText}`);
  }
  const audioBuffer = await response.arrayBuffer();
  return audioBuffer;
}

// server/hume-client.ts
var SENTENCE_PAUSE_SECONDS2 = 1.5;
function sanitizeWordTimings(wordTimings) {
  if (wordTimings.length === 0) return wordTimings;
  const sanitized = [];
  let lastEndMs = 0;
  for (let i = 0; i < wordTimings.length; i++) {
    let { word, startMs, endMs } = wordTimings[i];
    if (startMs < lastEndMs) {
      startMs = lastEndMs;
    }
    if (endMs <= startMs) {
      const nextStart = i + 1 < wordTimings.length ? wordTimings[i + 1].startMs : startMs + 200;
      endMs = Math.max(startMs + 50, Math.min(startMs + 200, nextStart));
    }
    sanitized.push({ word, startMs, endMs });
    lastEndMs = endMs;
  }
  return sanitized;
}
function splitIntoSentences(text2) {
  const parts = text2.match(/[^.!?]+[.!?]["']?\s*/g);
  if (!parts || parts.length === 0) return [text2];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}
function fixPerUtteranceTimestamps(rawTimings, trailingSilenceMs) {
  if (rawTimings.length <= 1) return rawTimings;
  const result = [];
  let cumulativeOffset = 0;
  for (let i = 0; i < rawTimings.length; i++) {
    if (i > 0 && rawTimings[i].startMs < rawTimings[i - 1].endMs - 100) {
      const prevAdjustedEnd = rawTimings[i - 1].endMs + cumulativeOffset;
      cumulativeOffset = prevAdjustedEnd + trailingSilenceMs;
    }
    result.push({
      word: rawTimings[i].word,
      startMs: rawTimings[i].startMs + cumulativeOffset,
      endMs: rawTimings[i].endMs + cumulativeOffset
    });
  }
  return result;
}
async function humeTextToSpeech(text2, voiceName = "Kora", speed, pauseSeconds) {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY environment variable is not set");
  }
  const effectivePause = pauseSeconds ?? SENTENCE_PAUSE_SECONDS2;
  const sentences = splitIntoSentences(text2);
  const utterances = sentences.map((sentence, i) => ({
    text: sentence,
    voice: { name: voiceName, provider: "HUME_AI" },
    trailing_silence: i < sentences.length - 1 ? effectivePause : 0.35,
    ...speed !== void 0 && { speed }
  }));
  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "2",
      utterances,
      include_timestamp_types: ["word"],
      split_utterances: false,
      strip_headers: true
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Hume TTS error:", response.status, errorText);
    throw new Error(`Hume TTS failed (${response.status}): ${errorText}`);
  }
  const result = await response.json();
  const generation = result.generations?.[0];
  if (!generation || !generation.audio) {
    throw new Error("Hume TTS returned no audio data");
  }
  const audioBuffer = Buffer.from(generation.audio, "base64");
  let wordTimings = [];
  const snippets = generation.snippets;
  if (snippets && Array.isArray(snippets)) {
    for (const snippetGroup of snippets) {
      const snippetList = Array.isArray(snippetGroup) ? snippetGroup : [snippetGroup];
      for (const snippet of snippetList) {
        if (snippet.timestamps && Array.isArray(snippet.timestamps)) {
          for (const ts of snippet.timestamps) {
            if (ts.type === "word" && ts.text && ts.time) {
              wordTimings.push({
                word: ts.text,
                startMs: Math.round(ts.time.begin),
                endMs: Math.round(ts.time.end)
              });
            }
          }
        }
      }
    }
  }
  wordTimings = fixPerUtteranceTimestamps(wordTimings, effectivePause * 1e3);
  wordTimings = sanitizeWordTimings(wordTimings);
  let estimatedDuration;
  if (wordTimings.length > 0 && typeof wordTimings[wordTimings.length - 1].endMs === "number" && !isNaN(wordTimings[wordTimings.length - 1].endMs)) {
    estimatedDuration = Math.ceil(wordTimings[wordTimings.length - 1].endMs / 1e3);
  } else {
    const wordCount = text2.split(/\s+/).filter((w) => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil(wordCount / 150 * 60));
  }
  if (isNaN(estimatedDuration) || estimatedDuration <= 0) {
    const wordCount = text2.split(/\s+/).filter((w) => w.length > 0).length;
    estimatedDuration = Math.max(1, Math.ceil(wordCount / 150 * 60));
  }
  const audioArrayBuffer = new Uint8Array(audioBuffer).buffer;
  return {
    audio: audioArrayBuffer,
    duration: estimatedDuration,
    wordTimings
  };
}
async function humeSimpleTTS(text2, voiceName = "Kora") {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) {
    throw new Error("HUME_API_KEY environment variable is not set");
  }
  const response = await fetch("https://api.hume.ai/v0/tts", {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "2",
      utterances: [
        {
          text: text2,
          voice: { name: voiceName, provider: "HUME_AI" }
        }
      ]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Hume simple TTS error:", response.status, errorText);
    throw new Error(`Hume TTS failed (${response.status}): ${errorText}`);
  }
  const result = await response.json();
  const generation = result.generations?.[0];
  if (!generation || !generation.audio) {
    throw new Error("Hume TTS returned no audio data");
  }
  const audioBuffer = Buffer.from(generation.audio, "base64");
  return new Uint8Array(audioBuffer).buffer;
}

// server/voice-rotation.ts
import { eq, and, isNotNull, sql as sql2 } from "drizzle-orm";
var VOICE_SLOT_WARNING_THRESHOLD = 0.83;
var ELEVENLABS_PLAN_VOICE_LIMIT = 160;
async function findInactiveVoices(inactiveDays = 60) {
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);
  const inactiveUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    voiceId: users.voiceId,
    voiceLastUsedAt: users.voiceLastUsedAt,
    createdAt: users.createdAt
  }).from(users).where(
    and(
      isNotNull(users.voiceId),
      sql2`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) < ${cutoffDate.toISOString()}`
    )
  );
  return inactiveUsers;
}
async function rotateUserVoice(userId, voiceId) {
  try {
    await deleteVoice(voiceId);
    console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceRotation", message: `Deleted voice ${voiceId} from ElevenLabs for user ${userId}` }));
  } catch (error) {
    console.error(`Failed to delete voice ${voiceId} from ElevenLabs:`, error?.message);
  }
  await db.update(users).set({
    voiceId: null,
    hasVoiceSample: false,
    preferredVoiceType: "ai",
    voiceLastUsedAt: null
  }).where(eq(users.id, userId));
  await db.update(voiceSamples).set({ status: "rotated" }).where(eq(voiceSamples.userId, userId));
  return { userId, voiceId, rotated: true };
}
async function runVoiceRotation(inactiveDays = 60) {
  const inactiveVoices = await findInactiveVoices(inactiveDays);
  const results = [];
  for (const user of inactiveVoices) {
    if (user.voiceId) {
      const result = await rotateUserVoice(user.id, user.voiceId);
      results.push(result);
    }
  }
  return {
    totalChecked: inactiveVoices.length,
    rotated: results.length,
    results
  };
}
async function getVoiceSlotStats() {
  const [activeVoicesDb] = await db.select({ count: sql2`count(*)` }).from(users).where(isNotNull(users.voiceId));
  const [totalUsers] = await db.select({ count: sql2`count(*)` }).from(users);
  const thirtyDaysAgo = /* @__PURE__ */ new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [recentlyActive] = await db.select({ count: sql2`count(*)` }).from(users).where(
    and(
      isNotNull(users.voiceId),
      sql2`${users.voiceLastUsedAt} > ${thirtyDaysAgo.toISOString()}`
    )
  );
  let elevenLabsSlots = { used: 0, total: 0, warning: false, warningMessage: "" };
  try {
    const allVoices = await listVoices();
    const clonedVoices = allVoices.filter((v) => v.category === "cloned");
    const used = clonedVoices.length;
    const total = ELEVENLABS_PLAN_VOICE_LIMIT;
    const usageRatio = used / total;
    const warning = usageRatio >= VOICE_SLOT_WARNING_THRESHOLD;
    const warningMessage = warning ? `WARNING: ElevenLabs voice slots at ${used}/${total} (${Math.round(usageRatio * 100)}%). Consider upgrading your plan or running voice rotation.` : "";
    if (warning) {
      console.warn(`[Voice Slots] ${warningMessage}`);
    }
    elevenLabsSlots = { used, total, warning, warningMessage };
  } catch (error) {
    console.error("[Voice Slots] Failed to fetch ElevenLabs voice data:", error?.message);
    elevenLabsSlots = { used: 0, total: 0, warning: false, warningMessage: "Failed to fetch live ElevenLabs data" };
  }
  return {
    database: {
      activeVoiceSlots: Number(activeVoicesDb?.count || 0),
      totalUsers: Number(totalUsers?.count || 0),
      recentlyActiveVoices: Number(recentlyActive?.count || 0)
    },
    elevenLabs: elevenLabsSlots
  };
}
async function freeVoiceSlotForNewClone(requestingUserId) {
  try {
    const allVoices = await listVoices();
    const clonedVoices = allVoices.filter((v) => v.category === "cloned");
    if (clonedVoices.length < ELEVENLABS_PLAN_VOICE_LIMIT) {
      return { freed: true };
    }
    console.warn(`[Voice Slots] All ${ELEVENLABS_PLAN_VOICE_LIMIT} slots full. Finding least recently used voice to rotate...`);
    const usersWithVoices = await db.select({
      id: users.id,
      voiceId: users.voiceId,
      voiceLastUsedAt: users.voiceLastUsedAt,
      createdAt: users.createdAt
    }).from(users).where(
      and(
        isNotNull(users.voiceId),
        sql2`${users.id} != ${requestingUserId}`
      )
    ).orderBy(sql2`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) ASC`).limit(1);
    if (usersWithVoices.length === 0) {
      return { freed: false, error: "No eligible voices to rotate" };
    }
    const lruUser = usersWithVoices[0];
    if (!lruUser.voiceId) {
      return { freed: false, error: "LRU user has no voice ID" };
    }
    console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceSlots", message: `[Voice Slots] Rotating LRU voice: user=${lruUser.id}, voiceId=${lruUser.voiceId}, lastUsed=${lruUser.voiceLastUsedAt || lruUser.createdAt}` }));
    await rotateUserVoice(lruUser.id, lruUser.voiceId);
    return { freed: true, rotatedUserId: lruUser.id, rotatedVoiceId: lruUser.voiceId };
  } catch (error) {
    console.error("[Voice Slots] Failed to free slot:", error?.message);
    return { freed: false, error: error?.message || "Unknown error" };
  }
}
async function checkVoiceSlotWarning() {
  try {
    const allVoices = await listVoices();
    const clonedVoices = allVoices.filter((v) => v.category === "cloned");
    const used = clonedVoices.length;
    const total = ELEVENLABS_PLAN_VOICE_LIMIT;
    const usageRatio = used / total;
    if (usageRatio >= VOICE_SLOT_WARNING_THRESHOLD) {
      const msg = `[Voice Slots WARNING] ${used}/${total} slots used (${Math.round(usageRatio * 100)}%). Running auto-cleanup...`;
      console.warn(msg);
      return msg;
    }
    return null;
  } catch (error) {
    console.error("[Voice Slots] Warning check failed:", error?.message);
    return null;
  }
}

// server/push-notifications.ts
import ExpoModule from "expo-server-sdk";
import { eq as eq2, and as and2, isNotNull as isNotNull2, sql as sql3 } from "drizzle-orm";
var Expo = ExpoModule.default || ExpoModule;
var expo = new Expo();
async function sendPushNotifications(messages2) {
  const validMessages = messages2.filter((m) => {
    const token = Array.isArray(m.to) ? m.to[0] : m.to;
    return Expo.isExpoPushToken(token);
  });
  if (validMessages.length === 0) return [];
  const chunks = expo.chunkPushNotifications(validMessages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("[Push] Error sending chunk:", error);
    }
  }
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      const token = Array.isArray(validMessages[i].to) ? validMessages[i].to[0] : validMessages[i].to;
      if (typeof token === "string") {
        try {
          await db.delete(pushTokens).where(eq2(pushTokens.token, token));
          console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "push", message: `[Push] Removed invalid token: ${token.substring(0, 20)}...` }));
        } catch (err) {
          console.error("[Push] Failed to remove invalid token:", err);
        }
      }
    }
  }
  return tickets;
}
async function sendVoiceExpiryWarnings() {
  const WARNING_DAYS_FIRST = 53;
  const ROTATION_DAYS = 60;
  const now = /* @__PURE__ */ new Date();
  const firstWarningCutoff = /* @__PURE__ */ new Date();
  firstWarningCutoff.setDate(now.getDate() - WARNING_DAYS_FIRST);
  const rotationCutoff = /* @__PURE__ */ new Date();
  rotationCutoff.setDate(now.getDate() - ROTATION_DAYS);
  const atRiskUsers = await db.select({
    id: users.id,
    name: users.name,
    voiceId: users.voiceId,
    voiceLastUsedAt: users.voiceLastUsedAt,
    voiceExpiryWarningAt: users.voiceExpiryWarningAt,
    createdAt: users.createdAt
  }).from(users).where(
    and2(
      isNotNull2(users.voiceId),
      sql3`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) <= ${firstWarningCutoff.toISOString()}`,
      sql3`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) > ${rotationCutoff.toISOString()}`
    )
  );
  if (atRiskUsers.length === 0) {
    console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceExpiry", message: "[Voice Expiry] No users with expiring voice clones" }));
    return { warned: 0 };
  }
  let totalWarned = 0;
  for (const user of atRiskUsers) {
    const lastUsed = user.voiceLastUsedAt || user.createdAt;
    const daysSinceUse = Math.floor((now.getTime() - lastUsed.getTime()) / (1e3 * 60 * 60 * 24));
    const daysUntilExpiry = ROTATION_DAYS - daysSinceUse;
    const lastWarning = user.voiceExpiryWarningAt;
    const daysSinceLastWarning = lastWarning ? Math.floor((now.getTime() - lastWarning.getTime()) / (1e3 * 60 * 60 * 24)) : Infinity;
    if (daysSinceLastWarning < 3) {
      continue;
    }
    const userTokens = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq2(pushTokens.userId, user.id));
    if (userTokens.length === 0) {
      continue;
    }
    const isUrgent = daysUntilExpiry <= 2;
    const title = isUrgent ? "Your Inner Voice expires tomorrow" : "Your Inner Voice is expiring soon";
    const body = isUrgent ? "Tap to keep your voice clone active before it's removed." : `Your voice clone expires in ${daysUntilExpiry} days. Tap to keep it active.`;
    const messages2 = userTokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: { type: "voice_expiry", screen: "VoiceSettings" },
      sound: "default",
      priority: isUrgent ? "high" : "default"
    }));
    await sendPushNotifications(messages2);
    await db.update(users).set({ voiceExpiryWarningAt: now }).where(eq2(users.id, user.id));
    totalWarned++;
    console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceExpiry", message: `[Voice Expiry] Warned user ${user.id} (${user.name}) \u2014 ${daysUntilExpiry} days until expiry` }));
  }
  console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceExpiry", message: `[Voice Expiry] Sent warnings to ${totalWarned} users` }));
  return { warned: totalWarned };
}

// server/auth.ts
import bcrypt from "bcrypt";
import crypto from "crypto";
import session from "express-session";
import { eq as eq3, and as and3, gt, lt } from "drizzle-orm";

// server/geolocation.ts
var geoCache = /* @__PURE__ */ new Map();
var CACHE_TTL = 24 * 60 * 60 * 1e3;
async function getGeoFromIp(ip) {
  const cleanIp = ip.replace("::ffff:", "").split(",")[0].trim();
  if (!cleanIp || cleanIp === "unknown" || cleanIp === "127.0.0.1" || cleanIp === "::1") {
    return { country: null, city: null, timezone: null };
  }
  const cached = geoCache.get(cleanIp);
  if (cached && cached.expires > Date.now()) {
    return cached.result;
  }
  try {
    const response = await fetch(`https://ipwho.is/${cleanIp}`, {
      signal: AbortSignal.timeout(3e3)
    });
    if (!response.ok) {
      return { country: null, city: null, timezone: null };
    }
    const data = await response.json();
    if (!data.success) {
      return { country: null, city: null, timezone: null };
    }
    const result = {
      country: data.country || null,
      city: data.city || null,
      timezone: data.timezone?.id || null
    };
    geoCache.set(cleanIp, { result, expires: Date.now() + CACHE_TTL });
    return result;
  } catch {
    return { country: null, city: null, timezone: null };
  }
}
function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
}

// server/auth.ts
var loginAttempts = /* @__PURE__ */ new Map();
var RATE_LIMIT_WINDOW = 15 * 60 * 1e3;
var MAX_ATTEMPTS = 5;
function checkRateLimit(ip) {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (!attempt || now > attempt.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  attempt.count++;
  if (attempt.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((attempt.resetTime - now) / 1e3);
    console.warn(`Rate limit: BLOCKED - ${ip} exceeded ${MAX_ATTEMPTS} attempts`);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}
function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}
var SALT_ROUNDS = 12;
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function setupAuth(app2) {
  const sessionSecret = process.env.SESSION_SECRET || "rewired-session-secret-change-in-production";
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;
  app2.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1e3,
        // 30 days
        sameSite: isProduction ? "none" : "lax"
      }
    })
  );
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password, signupSource, devicePlatform } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const [existingUser] = await db.select().from(users).where(eq3(users.email, email.toLowerCase()));
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }
      const clientIp = getClientIp(req);
      const geo = await getGeoFromIp(clientIp);
      const hashedPassword = await hashPassword(password);
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        country: geo.country,
        city: geo.city,
        timezone: geo.timezone,
        lastLoginIp: clientIp,
        signupSource: signupSource || null,
        devicePlatform: devicePlatform || null,
        lastActiveAt: /* @__PURE__ */ new Date()
      }).returning();
      const authToken = await generateAuthToken(newUser.id);
      req.session.userId = newUser.id;
      await new Promise((resolve2, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve2();
        });
      });
      res.json({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          hasVoiceSample: newUser.hasVoiceSample
        },
        authToken
        // Token for mobile apps
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const clientIp = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const rateLimitCheck = checkRateLimit(clientIp);
      if (!rateLimitCheck.allowed) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "security", message: `SECURITY: Rate limit exceeded for IP ${clientIp}` }));
        res.setHeader("Retry-After", rateLimitCheck.retryAfter.toString());
        return res.status(429).json({
          error: "Too many login attempts. Please try again later.",
          retryAfter: rateLimitCheck.retryAfter
        });
      }
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const [user] = await db.select().from(users).where(eq3(users.email, email.toLowerCase()));
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!user.password) {
        return res.status(401).json({ error: "Please use social login for this account" });
      }
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      resetRateLimit(clientIp);
      const geo = await getGeoFromIp(clientIp);
      await db.update(users).set({
        country: geo.country || user.country,
        city: geo.city || user.city,
        timezone: geo.timezone || user.timezone,
        lastLoginIp: clientIp,
        lastActiveAt: /* @__PURE__ */ new Date()
      }).where(eq3(users.id, user.id));
      const authToken = await generateAuthToken(user.id);
      req.session.userId = user.id;
      await new Promise((resolve2, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve2();
        });
      });
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          hasVoiceSample: user.hasVoiceSample
        },
        authToken
        // Token for mobile apps
      });
    } catch (error) {
      console.error("Login error:", error?.message || error);
      res.status(500).json({ error: "Failed to login" });
    }
  });
  app2.post("/api/auth/logout", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (userId) {
        await db.delete(authTokens).where(eq3(authTokens.userId, userId));
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "security", message: `SECURITY: Invalidated all auth tokens for user ${userId} on logout` }));
      }
      const headerToken = req.headers["x-auth-token"];
      if (headerToken) {
        await db.delete(authTokens).where(eq3(authTokens.token, headerToken));
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ error: "Failed to logout" });
        }
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });
  app2.post("/api/auth/oauth", async (req, res) => {
    try {
      const { email, name, provider, providerId, avatarUrl, signupSource, devicePlatform } = req.body;
      if (!email || !provider || !providerId) {
        return res.status(400).json({ error: "Email, provider, and providerId are required" });
      }
      if (!["google", "apple"].includes(provider)) {
        return res.status(400).json({ error: "Invalid auth provider" });
      }
      const clientIp = getClientIp(req);
      const geo = await getGeoFromIp(clientIp);
      const [existingUser] = await db.select().from(users).where(eq3(users.email, email.toLowerCase()));
      let user;
      if (existingUser) {
        [user] = await db.update(users).set({
          authProvider: existingUser.providerId ? existingUser.authProvider : provider,
          providerId: existingUser.providerId || providerId,
          avatarUrl: avatarUrl || existingUser.avatarUrl,
          country: geo.country || existingUser.country,
          city: geo.city || existingUser.city,
          timezone: geo.timezone || existingUser.timezone,
          lastLoginIp: clientIp,
          lastActiveAt: /* @__PURE__ */ new Date()
        }).where(eq3(users.id, existingUser.id)).returning();
      } else {
        [user] = await db.insert(users).values({
          email: email.toLowerCase(),
          name: name || email.split("@")[0],
          authProvider: provider,
          providerId,
          avatarUrl,
          country: geo.country,
          city: geo.city,
          timezone: geo.timezone,
          lastLoginIp: clientIp,
          signupSource: signupSource || null,
          devicePlatform: devicePlatform || null,
          lastActiveAt: /* @__PURE__ */ new Date()
        }).returning();
      }
      const authToken = await generateAuthToken(user.id);
      req.session.userId = user.id;
      await new Promise((resolve2, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve2();
        });
      });
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          hasVoiceSample: user.hasVoiceSample,
          avatarUrl: user.avatarUrl
        },
        authToken
      });
    } catch (error) {
      console.error("OAuth login error:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });
  app2.get("/api/auth/me", async (req, res) => {
    try {
      let userId = req.session.userId;
      if (!userId) {
        const headerToken = req.header("X-Auth-Token");
        if (headerToken) {
          userId = await verifyAuthToken(headerToken) ?? void 0;
        }
      }
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const [user] = await db.select().from(users).where(eq3(users.id, userId));
      if (!user) {
        req.session.destroy(() => {
        });
        return res.status(401).json({ error: "User not found" });
      }
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          hasVoiceSample: user.hasVoiceSample,
          voiceId: user.voiceId
        }
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });
  setInterval(async () => {
    try {
      await db.delete(authTokens).where(lt(authTokens.expiresAt, /* @__PURE__ */ new Date()));
      console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "auth", message: "Expired auth tokens cleaned up" }));
    } catch (error) {
      console.error("[auth] Token cleanup error:", error);
    }
  }, 6 * 60 * 60 * 1e3);
}
async function generateAuthToken(userId) {
  const existingTokens = await db.select().from(authTokens).where(and3(
    eq3(authTokens.userId, userId),
    gt(authTokens.expiresAt, /* @__PURE__ */ new Date())
  )).limit(1);
  if (existingTokens.length > 0) {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
    await db.update(authTokens).set({ expiresAt: newExpiry }).where(eq3(authTokens.token, existingTokens[0].token));
    return existingTokens[0].token;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3);
  await db.insert(authTokens).values({
    token,
    userId,
    expiresAt
  });
  return token;
}
async function verifyAuthToken(token) {
  const results = await db.select().from(authTokens).where(and3(
    eq3(authTokens.token, token),
    gt(authTokens.expiresAt, /* @__PURE__ */ new Date())
  )).limit(1);
  if (results.length === 0) {
    return null;
  }
  return results[0].userId;
}
function asyncMiddleware(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
var lastActiveCache = /* @__PURE__ */ new Map();
var LAST_ACTIVE_THROTTLE = 5 * 60 * 1e3;
function updateLastActive(userId) {
  const now = Date.now();
  const last = lastActiveCache.get(userId) || 0;
  if (now - last < LAST_ACTIVE_THROTTLE) return;
  lastActiveCache.set(userId, now);
  db.update(users).set({ lastActiveAt: /* @__PURE__ */ new Date() }).where(eq3(users.id, userId)).catch(() => {
  });
}
async function requireAuthAsync(req, res, next) {
  if (req.session.userId) {
    req.userId = req.session.userId;
    updateLastActive(req.session.userId);
    next();
    return;
  }
  const authToken = req.header("X-Auth-Token");
  if (authToken) {
    try {
      const userId = await verifyAuthToken(authToken);
      if (userId) {
        req.userId = userId;
        updateLastActive(userId);
        next();
        return;
      }
    } catch (error) {
      console.error("Token verification error:", error);
    }
  }
  res.status(401).json({ error: "Authentication required" });
}
var requireAuth = asyncMiddleware(requireAuthAsync);
function optionalAuth(req, res, next) {
  if (req.session.userId) {
    req.userId = req.session.userId;
  }
  next();
}

// server/moderation.ts
import OpenAI2 from "openai";
var directOpenAI = process.env.OPENAI_API_KEY ? new OpenAI2({ apiKey: process.env.OPENAI_API_KEY }) : null;
var replitOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? new OpenAI2({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL }) : null;
var SUPPORTIVE_MESSAGES = {
  hate: "This content contains language that may be hurtful to others. Retuned is about lifting yourself up \u2014 let's keep it positive.",
  "hate/threatening": "This content contains threatening language. Affirmations work best when they focus on growth and empowerment.",
  harassment: "This content could be seen as harassment. Let's redirect toward self-compassion and personal growth.",
  "harassment/threatening": "This content contains threatening language. Retuned is designed for positive self-empowerment.",
  "self-harm": "We care about your well-being. If you're struggling, please reach out to a crisis helpline. Affirmations should nurture and support you.",
  "self-harm/intent": "We care about your well-being. If you're struggling, please reach out to a crisis helpline (988 Suicide & Crisis Lifeline). Affirmations should nurture and support you.",
  "self-harm/instructions": "This content isn't appropriate for affirmations. If you're struggling, please reach out to a crisis helpline (988 Suicide & Crisis Lifeline).",
  sexual: "This content isn't aligned with Retuned's purpose. Let's focus on affirmations that empower your mind, body, and spirit.",
  "sexual/minors": "This content is not permitted. Retuned is designed for positive self-empowerment only.",
  violence: "This content contains violent language. Affirmations are most powerful when they focus on peace, strength, and growth.",
  "violence/graphic": "This content contains graphic violence and isn't appropriate for affirmations. Let's focus on healing and empowerment."
};
var POLITICAL_MESSAGE = "Retuned is a space for personal growth, not politics. Affirmations work best when they focus on you \u2014 your mindset, your goals, your well-being.";
var DEFAULT_MESSAGE = "This content doesn't align with Retuned's purpose of positive self-empowerment. Please revise your text to focus on growth, healing, or well-being.";
async function moderateContent(text2) {
  if (!text2 || text2.trim().length === 0) {
    return { flagged: false, categories: [], message: "" };
  }
  const client = directOpenAI || replitOpenAI;
  if (!client) {
    console.warn("No OpenAI client available for content moderation \u2014 skipping check");
    return { flagged: false, categories: [], message: "" };
  }
  try {
    const response = await client.moderations.create({
      input: text2,
      model: "omni-moderation-latest"
    });
    const result = response.results[0];
    if (!result.flagged) {
      return { flagged: false, categories: [], message: "" };
    }
    const flaggedCategories = [];
    const cats = result.categories;
    for (const [category, isFlagged] of Object.entries(cats)) {
      if (isFlagged) {
        flaggedCategories.push(category);
      }
    }
    let message = DEFAULT_MESSAGE;
    for (const cat of flaggedCategories) {
      if (SUPPORTIVE_MESSAGES[cat]) {
        message = SUPPORTIVE_MESSAGES[cat];
        break;
      }
    }
    return { flagged: true, categories: flaggedCategories, message };
  } catch (error) {
    console.error("Content moderation API error:", error);
    return { flagged: false, categories: [], message: "" };
  }
}
async function validateAffirmationContent(text2) {
  if (!text2 || text2.trim().length === 0) {
    return { flagged: false, categories: [], message: "" };
  }
  const moderationResult = await moderateContent(text2);
  if (moderationResult.flagged) {
    return moderationResult;
  }
  const client = directOpenAI || replitOpenAI;
  if (!client) {
    console.warn("No OpenAI client available for affirmation validation \u2014 skipping check");
    return { flagged: false, categories: [], message: "" };
  }
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content validator for a self-affirmation app called Retuned. Your job is to determine if user-written text is appropriate as a personal affirmation or goal.

ALLOW content that is:
- Positive self-talk, personal growth, or wellness goals
- Statements about health, confidence, relationships, career, spirituality
- Even if imperfect or casual in tone, as long as intent is self-improvement

REJECT content that is:
- Political in any way \u2014 mentions of politicians, political parties, elections, political movements, government policies, or political figures (e.g. "I love [any politician]", "I support [any party]"). This applies uniformly regardless of political affiliation or viewpoint.
- Harmful intentions toward others (robbery, violence, revenge, manipulation)
- Sexually explicit or crude/vulgar language
- Promoting illegal activities or substance abuse
- Nonsensical or trolling input with no self-improvement intent
- Negative self-talk disguised as affirmations (e.g. "I am worthless")

Respond with ONLY valid JSON: {"allowed": true} or {"allowed": false, "reason": "brief explanation"}`
        },
        {
          role: "user",
          content: text2
        }
      ],
      temperature: 0,
      max_tokens: 80
    });
    const content = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.allowed === false) {
        const isPolitical = parsed.reason && /politic|politician|party|election|government/i.test(parsed.reason);
        return {
          flagged: true,
          categories: [isPolitical ? "political_content" : "affirmation_policy"],
          message: isPolitical ? POLITICAL_MESSAGE : parsed.reason ? `This doesn't seem like a positive affirmation. ${parsed.reason}. Try rephrasing to focus on what you want to attract into your life.` : DEFAULT_MESSAGE
        };
      }
    }
    return { flagged: false, categories: [], message: "" };
  } catch (error) {
    console.error("Affirmation validation error:", error);
    return { flagged: false, categories: [], message: "" };
  }
}

// server/github.ts
import { Octokit } from "@octokit/rest";
var connectionSettings2;
async function getAccessToken() {
  if (connectionSettings2 && connectionSettings2.settings.expires_at && new Date(connectionSettings2.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings2.settings.access_token;
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings2 = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=github",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  const accessToken = connectionSettings2?.settings?.access_token || connectionSettings2.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings2 || !accessToken) {
    throw new Error("GitHub not connected");
  }
  return accessToken;
}
async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}
var STATUS_LABELS = ["in-progress", "blocked", "completed"];
async function postIssueComment(owner, repo, issueNumber, body) {
  const octokit = await getGitHubClient();
  const result = await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
  return result.data;
}
async function setIssueStatusLabel(owner, repo, issueNumber, status) {
  const octokit = await getGitHubClient();
  const { data: currentLabels } = await octokit.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber
  });
  const labelsToRemove = currentLabels.filter(
    (label) => STATUS_LABELS.includes(label.name) && label.name !== status
  );
  for (const label of labelsToRemove) {
    try {
      await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label.name
      });
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  try {
    await octokit.issues.getLabel({ owner, repo, name: status });
  } catch (e) {
    if (e.status === 404) {
      const colorMap = {
        "in-progress": "fbca04",
        "blocked": "e11d48",
        "completed": "22c55e"
      };
      await octokit.issues.createLabel({
        owner,
        repo,
        name: status,
        color: colorMap[status],
        description: `Task is ${status}`
      });
    } else {
      throw e;
    }
  }
  await octokit.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [status]
  });
  return { issueNumber, status };
}
async function updateProjectCard(owner, projectNumber, issueNodeId, statusFieldValue) {
  const octokit = await getGitHubClient();
  const projectQuery = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { id }
                ... on PullRequest { id }
              }
            }
          }
        }
      }
      organization(login: $owner) {
        projectV2(number: $number) {
          id
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { id }
                ... on PullRequest { id }
              }
            }
          }
        }
      }
    }
  `;
  const projectData = await octokit.graphql(projectQuery, {
    owner,
    number: projectNumber
  });
  const project = projectData.user?.projectV2 || projectData.organization?.projectV2;
  if (!project) {
    throw new Error(`Project #${projectNumber} not found for ${owner}`);
  }
  const statusField = project.fields.nodes.find(
    (f) => f.name === "Status" && f.options
  );
  if (!statusField) {
    throw new Error("Status field not found on project board");
  }
  const targetOption = statusField.options.find(
    (o) => o.name.toLowerCase() === statusFieldValue.toLowerCase()
  );
  if (!targetOption) {
    const available = statusField.options.map((o) => o.name).join(", ");
    throw new Error(`Status "${statusFieldValue}" not found. Available: ${available}`);
  }
  const item = project.items.nodes.find(
    (i) => i.content?.id === issueNodeId
  );
  if (!item) {
    throw new Error("Issue not found on this project board");
  }
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  `;
  await octokit.graphql(mutation, {
    projectId: project.id,
    itemId: item.id,
    fieldId: statusField.id,
    optionId: targetOption.id
  });
  return { projectNumber, issueNodeId, status: statusFieldValue };
}
async function getIssueNodeId(owner, repo, issueNumber) {
  const octokit = await getGitHubClient();
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;
  const result = await octokit.graphql(query, {
    owner,
    repo,
    number: issueNumber
  });
  return result.repository.issue.id;
}
async function getAssignedIssues(owner, repo) {
  const octokit = await getGitHubClient();
  const { data: user } = await octokit.users.getAuthenticated();
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    assignee: user.login,
    state: "open",
    per_page: 100
  });
  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    labels: issue.labels.map((l) => typeof l === "string" ? l : l.name),
    state: issue.state,
    url: issue.html_url
  }));
}
async function listRepos() {
  const octokit = await getGitHubClient();
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 30
  });
  return repos.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    url: r.html_url
  }));
}
var COORD_DIR = ".retuned/coordination";
var STATUS_PATH = `${COORD_DIR}/status.json`;
var PRIORITIES_PATH = `${COORD_DIR}/priorities.json`;
var ACK_PATH = `${COORD_DIR}/acknowledgments.json`;
async function getFileContent(owner, repo, path5) {
  const octokit = await getGitHubClient();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: path5 });
    if ("content" in data && typeof data.content === "string") {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return { content: JSON.parse(decoded), sha: data.sha };
    }
    return null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
async function commitFile(owner, repo, path5, content, message, sha) {
  const octokit = await getGitHubClient();
  const encoded = Buffer.from(JSON.stringify(content, null, 2) + "\n").toString("base64");
  const params = {
    owner,
    repo,
    path: path5,
    message,
    content: encoded
  };
  if (sha) params.sha = sha;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  return data;
}
async function initCoordination(owner, repo) {
  const results = [];
  const statusFile = await getFileContent(owner, repo, STATUS_PATH);
  if (!statusFile) {
    const initialStatus = {
      current_work: "",
      status: "idle",
      started_at: null,
      estimated_completion: null,
      blockers: []
    };
    await commitFile(owner, repo, STATUS_PATH, initialStatus, "Initialize coordination: status.json");
    results.push("Created status.json");
  } else {
    results.push("status.json already exists");
  }
  const prioritiesFile = await getFileContent(owner, repo, PRIORITIES_PATH);
  if (!prioritiesFile) {
    const initialPriorities = {
      updated_at: null,
      priorities: [],
      notes: "RETUNED team will populate this with daily priorities"
    };
    await commitFile(owner, repo, PRIORITIES_PATH, initialPriorities, "Initialize coordination: priorities.json");
    results.push("Created priorities.json");
  } else {
    results.push("priorities.json already exists");
  }
  return results;
}
async function updateStatus(owner, repo, update) {
  const existing = await getFileContent(owner, repo, STATUS_PATH);
  const currentStatus = existing?.content || {
    current_work: "",
    status: "idle",
    started_at: null,
    estimated_completion: null,
    blockers: []
  };
  const newStatus = { ...currentStatus, ...update };
  if (update.status === "in_progress" && !update.started_at) {
    newStatus.started_at = (/* @__PURE__ */ new Date()).toISOString();
  }
  if (update.status === "completed") {
    newStatus.blockers = [];
  }
  if (update.status === "idle") {
    newStatus.current_work = "";
    newStatus.started_at = null;
    newStatus.estimated_completion = null;
    newStatus.blockers = [];
  }
  const statusLabel = update.status || currentStatus.status;
  const commitMsg = `Update status: ${statusLabel}${update.current_work ? ` - ${update.current_work}` : ""}`;
  await commitFile(owner, repo, STATUS_PATH, newStatus, commitMsg, existing?.sha);
  return newStatus;
}
async function addBlocker(owner, repo, blocker) {
  const existing = await getFileContent(owner, repo, STATUS_PATH);
  if (!existing) throw new Error("status.json not found. Run init first.");
  const status = existing.content;
  status.blockers.push(blocker);
  status.status = "in_progress";
  await commitFile(owner, repo, STATUS_PATH, status, `Add blocker: ${blocker}`, existing.sha);
  return status;
}
async function getStatus(owner, repo) {
  const result = await getFileContent(owner, repo, STATUS_PATH);
  return result?.content || null;
}
async function getPriorities(owner, repo) {
  const result = await getFileContent(owner, repo, PRIORITIES_PATH);
  return result?.content || null;
}
async function acknowledgePriorities(owner, repo) {
  const priorities = await getFileContent(owner, repo, PRIORITIES_PATH);
  if (!priorities) throw new Error("priorities.json not found");
  const existing = await getFileContent(owner, repo, ACK_PATH);
  const acks = existing?.content || { acknowledgments: [] };
  acks.acknowledgments.push({
    acknowledged_at: (/* @__PURE__ */ new Date()).toISOString(),
    priorities_snapshot: priorities.content
  });
  if (acks.acknowledgments.length > 20) {
    acks.acknowledgments = acks.acknowledgments.slice(-20);
  }
  await commitFile(
    owner,
    repo,
    ACK_PATH,
    acks,
    `Acknowledge priorities - ${(/* @__PURE__ */ new Date()).toISOString()}`,
    existing?.sha
  );
  return { acknowledged_at: (/* @__PURE__ */ new Date()).toISOString(), priorities: priorities.content };
}
var DOCS_DIR = ".retuned/docs";
var INBOX_DIR = ".retuned/inbox";
async function getRawFileContent(owner, repo, path5) {
  const octokit = await getGitHubClient();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: path5 });
    if ("content" in data && typeof data.content === "string") {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return { content: decoded, sha: data.sha };
    }
    return null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}
async function commitRawFile(owner, repo, path5, content, message, sha) {
  const octokit = await getGitHubClient();
  const encoded = Buffer.from(content).toString("base64");
  const params = { owner, repo, path: path5, message, content: encoded };
  if (sha) params.sha = sha;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  return data;
}
async function pushDocument(owner, repo, category, filename, content, commitMessage) {
  const path5 = `${DOCS_DIR}/${category}/${filename}`;
  const existing = await getRawFileContent(owner, repo, path5);
  const message = commitMessage || `Add ${category} doc: ${filename}`;
  await commitRawFile(owner, repo, path5, content, message, existing?.sha);
  return { path: path5, url: `https://github.com/${owner}/${repo}/blob/main/${path5}` };
}
async function pushInboxMessage(owner, repo, direction, filename, content) {
  const path5 = `${INBOX_DIR}/${direction}/${filename}`;
  const existing = await getRawFileContent(owner, repo, path5);
  const message = direction === "to-team" ? `Agent update: ${filename}` : `Team message: ${filename}`;
  await commitRawFile(owner, repo, path5, content, message, existing?.sha);
  return { path: path5, url: `https://github.com/${owner}/${repo}/blob/main/${path5}` };
}
async function getInboxMessages(owner, repo, direction) {
  const octokit = await getGitHubClient();
  const path5 = `${INBOX_DIR}/${direction}`;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: path5 });
    if (Array.isArray(data)) {
      const messages2 = [];
      for (const file of data) {
        if (file.type === "file" && file.name.endsWith(".md")) {
          const content = await getRawFileContent(owner, repo, file.path);
          messages2.push({ name: file.name, path: file.path, content: content?.content || "" });
        }
      }
      return messages2;
    }
    return [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}
async function initDocStructure(owner, repo) {
  const results = [];
  const folders = [
    {
      path: `${DOCS_DIR}/proposals`,
      readme: `# Proposals

Technical evaluations and proposals for team review.

Files here are pending discussion \u2014 move to \`decisions/\` once approved or rejected.
`
    },
    {
      path: `${DOCS_DIR}/decisions`,
      readme: `# Decisions

Finalized technical decisions with outcomes.

Each file should note whether the proposal was approved or rejected and why.
`
    },
    {
      path: `${DOCS_DIR}/changelogs`,
      readme: `# Changelogs

Summaries of significant changes made to the codebase.

Dropped here after major features or refactors for team awareness.
`
    },
    {
      path: `${INBOX_DIR}/to-agent`,
      readme: `# To Agent

Drop markdown files here with instructions, feedback, or questions for the Replit agent.

The agent will pick these up at the start of each session.
`
    },
    {
      path: `${INBOX_DIR}/to-team`,
      readme: `# To Team

Updates, summaries, and questions from the Replit agent to the team.

Check here for agent progress reports and decisions that need input.
`
    }
  ];
  for (const folder of folders) {
    const readmePath = `${folder.path}/README.md`;
    const existing = await getRawFileContent(owner, repo, readmePath);
    if (!existing) {
      await commitRawFile(owner, repo, readmePath, folder.readme, `Initialize ${folder.path}`);
      results.push(`Created ${readmePath}`);
    } else {
      results.push(`${readmePath} already exists`);
    }
  }
  return results;
}

// server/routes/github-routes.ts
function registerGithubRoutes(app2) {
  app2.get("/api/github/repos", requireAuth, async (req, res) => {
    try {
      const repos = await listRepos();
      res.json(repos);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch repositories" });
    }
  });
  app2.get("/api/github/issues/:owner/:repo", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const issues = await getAssignedIssues(owner, repo);
      res.json(issues);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to fetch issues" });
    }
  });
  app2.post("/api/github/issues/:owner/:repo/:issueNumber/comment", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const issueNumber = req.params.issueNumber;
      const { body } = req.body;
      if (!body) {
        return res.status(400).json({ error: "Comment body is required" });
      }
      const comment = await postIssueComment(owner, repo, parseInt(issueNumber), body);
      res.json({ success: true, commentId: comment.id, url: comment.html_url });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to post comment" });
    }
  });
  app2.post("/api/github/issues/:owner/:repo/:issueNumber/label", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const issueNumber = req.params.issueNumber;
      const { status } = req.body;
      const validStatuses = ["in-progress", "blocked", "completed"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
      }
      const result = await setIssueStatusLabel(owner, repo, parseInt(issueNumber), status);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to update label" });
    }
  });
  app2.post("/api/github/project/:owner/:projectNumber/move", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const projectNumber = req.params.projectNumber;
      const { repo, issueNumber, status } = req.body;
      if (!repo || !issueNumber || !status) {
        return res.status(400).json({ error: "repo, issueNumber, and status are required" });
      }
      const nodeId = await getIssueNodeId(owner, repo, parseInt(issueNumber));
      const result = await updateProjectCard(owner, parseInt(projectNumber), nodeId, status);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to update project card" });
    }
  });
  app2.post("/api/github/issues/:owner/:repo/:issueNumber/status", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const issueNumber = req.params.issueNumber;
      const { status, comment, projectNumber } = req.body;
      const validStatuses = ["in-progress", "blocked", "completed"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
      }
      const num = parseInt(issueNumber);
      const results = { success: true };
      const labelResult = await setIssueStatusLabel(owner, repo, num, status);
      results.label = labelResult;
      const statusMessages = {
        "in-progress": "\u{1F504} **Status: In Progress**",
        "blocked": "\u{1F6AB} **Status: Blocked**",
        "completed": "\u2705 **Status: Completed**"
      };
      const commentBody = comment ? `${statusMessages[status]}

${comment}` : statusMessages[status];
      const commentResult = await postIssueComment(owner, repo, num, commentBody);
      results.comment = { id: commentResult.id, url: commentResult.html_url };
      if (projectNumber) {
        try {
          const nodeId = await getIssueNodeId(owner, repo, num);
          const projectResult = await updateProjectCard(owner, parseInt(projectNumber), nodeId, status);
          results.project = projectResult;
        } catch (e) {
          results.projectError = e.message;
        }
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to update issue status" });
    }
  });
  app2.post("/api/github/coordination/:owner/:repo/init", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const results = await initCoordination(owner, repo);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to initialize coordination" });
    }
  });
  app2.get("/api/github/coordination/:owner/:repo/status", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const status = await getStatus(owner, repo);
      if (!status) {
        return res.status(404).json({ error: "status.json not found. Run init first." });
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to get status" });
    }
  });
  app2.post("/api/github/coordination/:owner/:repo/status", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const { current_work, status, estimated_completion } = req.body;
      const validStatuses = ["idle", "in_progress", "completed"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
      }
      const result = await updateStatus(owner, repo, { current_work, status, estimated_completion });
      res.json({ success: true, status: result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to update status" });
    }
  });
  app2.post("/api/github/coordination/:owner/:repo/blocker", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const { blocker } = req.body;
      if (!blocker) {
        return res.status(400).json({ error: "blocker text is required" });
      }
      const result = await addBlocker(owner, repo, blocker);
      res.json({ success: true, status: result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to add blocker" });
    }
  });
  app2.get("/api/github/coordination/:owner/:repo/priorities", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const priorities = await getPriorities(owner, repo);
      if (!priorities) {
        return res.status(404).json({ error: "priorities.json not found. Run init first." });
      }
      res.json(priorities);
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to get priorities" });
    }
  });
  app2.post("/api/github/coordination/:owner/:repo/acknowledge", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const result = await acknowledgePriorities(owner, repo);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to acknowledge priorities" });
    }
  });
  app2.post("/api/github/docs/:owner/:repo/init", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const results = await initDocStructure(owner, repo);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to initialize doc structure" });
    }
  });
  app2.post("/api/github/docs/:owner/:repo/push", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const { category, filename, content, commitMessage } = req.body;
      if (!category || !filename || !content) {
        return res.status(400).json({ error: "category, filename, and content are required" });
      }
      const result = await pushDocument(owner, repo, category, filename, content, commitMessage);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to push document" });
    }
  });
  app2.post("/api/github/inbox/:owner/:repo/:direction", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const direction = req.params.direction;
      if (direction !== "to-agent" && direction !== "to-team") {
        return res.status(400).json({ error: "direction must be 'to-agent' or 'to-team'" });
      }
      const { filename, content } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ error: "filename and content are required" });
      }
      const result = await pushInboxMessage(owner, repo, direction, filename, content);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to push inbox message" });
    }
  });
  app2.get("/api/github/inbox/:owner/:repo/:direction", requireAuth, async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const direction = req.params.direction;
      if (direction !== "to-agent" && direction !== "to-team") {
        return res.status(400).json({ error: "direction must be 'to-agent' or 'to-team'" });
      }
      const messages2 = await getInboxMessages(owner, repo, direction);
      res.json({ messages: messages2 });
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to get inbox messages" });
    }
  });
}

// server/routes/breathing-routes.ts
import { eq as eq4, desc, and as and4, sql as sql4 } from "drizzle-orm";
var breathingWisdomCache = /* @__PURE__ */ new Map();
var breathingWisdomFallbacks = {
  box: [
    "Navy SEALs use this exact pattern to stay sharp under pressure",
    "Your cortisol is dropping with every cycle you complete",
    "This is literally retraining your stress response right now",
    "Equal inhale-hold-exhale timing synchronizes your autonomic nervous system",
    "You're strengthening your vagus nerve \u2014 your body's calm switch",
    "Each cycle improves your heart rate variability \u2014 that's real progress",
    "This rhythm is resetting your baroreceptors \u2014 your blood pressure is evening out",
    "You're building stress resilience that carries into your whole day"
  ],
  "478": [
    "That long exhale is activating your parasympathetic nervous system",
    "The extended exhale slows your heart rate \u2014 your body is downshifting right now",
    "Your brain waves are shifting from stress mode to calm mode right now",
    "The 7-second hold boosts oxygen absorption \u2014 your cells are thanking you",
    "Your prefrontal cortex is coming back online as your breathing slows",
    "You're doing something measurable for your nervous system right now",
    "Each cycle is reducing your heart rate by a few beats per minute",
    "That 8-second exhale is twice as long as the inhale \u2014 the ratio is what calms you"
  ],
  coherent: [
    "Five breaths per minute is the optimal rate for heart-brain coherence",
    "Your heart and brain are literally synchronizing right now",
    "This balanced rhythm is the sweet spot for maximum HRV improvement",
    "Olympic athletes use this exact rhythm for peak performance",
    "At this pace your respiratory and cardiovascular rhythms lock together",
    "Your heart rate variability is improving with each breath you take",
    "Consistent practice here compounds \u2014 you're investing in yourself",
    "This rhythm brings your entire autonomic nervous system into balance"
  ],
  energizing: [
    "You're flooding your prefrontal cortex with oxygen right now",
    "This pattern increases norepinephrine \u2014 your natural focus chemical",
    "Your mitochondria are producing more energy with each fast breath",
    "Rapid breathing drives your sympathetic nervous system \u2014 natural alertness kicking in",
    "You're activating your body's natural energy system \u2014 no caffeine needed",
    "Your brain uses 20% of your total oxygen \u2014 you're giving it a boost",
    "This rhythm is spiking your adrenaline just enough to sharpen your focus",
    "Every round is sharpening your mental clarity for the hours ahead"
  ],
  alternate: [
    "Alternating nostrils balances your left and right brain hemispheres",
    "Your nasal cycle naturally shifts every 90 minutes \u2014 you're harmonizing it",
    "This technique lowers your heart rate and blood pressure simultaneously",
    "Each nostril connects to opposite brain hemispheres \u2014 you're activating both",
    "Yogic practitioners have used this for thousands of years to center the mind",
    "Your autonomic nervous system is rebalancing with every switch",
    "Right nostril breathing activates your sympathetic system, left calms it \u2014 you're doing both",
    "This is one of the fastest ways to bring your nervous system into equilibrium"
  ],
  triangle: [
    "Three equal phases create a perfectly balanced breathing rhythm",
    "This pattern is used in military training for calm under pressure",
    "Equal timing across inhale, hold, and exhale synchronizes your nervous system",
    "The simplicity of this pattern makes it easier for your brain to relax into",
    "Triangle breathing reduces cognitive load \u2014 fewer counts means deeper focus",
    "Your heart rate variability improves faster with simple, repeatable patterns",
    "This rhythm naturally slows your breathing to about 5 breaths per minute",
    "The hold phase gives your lungs extra time to absorb oxygen efficiently"
  ],
  "physio-sigh": [
    "Stanford researchers found this is the fastest way to reduce stress in real time",
    "The double inhale pops open collapsed air sacs in your lungs",
    "That quick second sip of air maximizes your lung surface area instantly",
    "The long exhale drives your heart rate down within a single breath cycle",
    "This is your body's natural reset \u2014 you do it involuntarily before sleep",
    "One physiological sigh can shift your nervous system in under 30 seconds",
    "The exhale-to-inhale ratio here is what makes it so calming so fast",
    "Your diaphragm is doing a full reset with every double-inhale cycle"
  ],
  "calming-2to1": [
    "The 2:1 exhale-to-inhale ratio is the gold standard for activating calm",
    "Longer exhales directly stimulate your vagus nerve \u2014 your body's brake pedal",
    "This ratio is used in clinical anxiety treatment protocols",
    "Your heart rate drops measurably during every extended exhale",
    "The simplicity of two counts makes this one of the easiest calming techniques",
    "Doubling your exhale length doubles your parasympathetic activation",
    "This pattern mirrors the breathing rhythm your body uses during deep sleep",
    "Each cycle is training your nervous system to downshift more efficiently"
  ],
  "deep-relax-7211": [
    "The 11-second exhale is one of the longest in any breathing practice",
    "This pattern drops your breathing rate to just 3 breaths per minute",
    "Ultra-slow breathing like this has been shown to lower blood pressure",
    "The brief hold lets CO2 build just enough to deepen your next exhale",
    "Therapists use this pattern specifically for insomnia and sleep disorders",
    "Your brain waves are shifting toward theta \u2014 the frequency right before sleep",
    "This extended exhale gives your vagus nerve maximum stimulation time",
    "At this pace your body is entering its deepest possible relaxation state"
  ],
  "vishama-vritti": [
    "Unequal breathing ratios sharpen mental focus by engaging your prefrontal cortex",
    "The extended hold phase increases CO2 tolerance \u2014 a marker of stress resilience",
    "This Vedic technique has been practiced for over 3,000 years for mental clarity",
    "The asymmetric pattern forces your brain to stay present and attentive",
    "Your concentration improves because the varying counts demand active awareness",
    "The long hold phase trains your nervous system to stay calm under pressure",
    "This rhythm strengthens the connection between your breathing and your attention",
    "Unequal ratios challenge your autonomic system \u2014 that's what builds resilience"
  ]
};
function registerBreathingRoutes(app2) {
  app2.post("/api/breathing-sessions", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { techniqueId, durationSeconds } = req.body;
      if (!techniqueId || typeof durationSeconds !== "number" || durationSeconds <= 0) {
        return res.status(400).json({ error: "Invalid session data" });
      }
      const today = /* @__PURE__ */ new Date();
      const dateKey = today.toISOString().split("T")[0];
      const [session2] = await db.insert(breathingSessions).values({
        userId,
        techniqueId,
        durationSeconds,
        dateKey
      }).returning();
      res.json(session2);
    } catch (error) {
      console.error("Error recording breathing session:", error);
      res.status(500).json({ error: "Failed to record breathing session" });
    }
  });
  app2.get("/api/breathing-sessions/today", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const today = /* @__PURE__ */ new Date();
      const dateKey = today.toISOString().split("T")[0];
      const sessions = await db.select({
        totalSeconds: sql4`COALESCE(SUM(${breathingSessions.durationSeconds}), 0)::int`,
        sessionCount: sql4`COUNT(*)::int`
      }).from(breathingSessions).where(and4(
        eq4(breathingSessions.userId, userId),
        eq4(breathingSessions.dateKey, dateKey)
      ));
      const result = sessions[0] || { totalSeconds: 0, sessionCount: 0 };
      res.json({
        totalMinutes: Math.floor(result.totalSeconds / 60),
        totalSeconds: result.totalSeconds,
        sessionCount: result.sessionCount,
        dateKey,
        goalMinutes: 5
        // Default daily goal
      });
    } catch (error) {
      console.error("Error getting today's breathing progress:", error);
      res.status(500).json({ error: "Failed to get breathing progress" });
    }
  });
  app2.get("/api/breathing-sessions/streak", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionsResult = await db.select({
        dateKey: breathingSessions.dateKey
      }).from(breathingSessions).where(eq4(breathingSessions.userId, userId)).groupBy(breathingSessions.dateKey).orderBy(desc(breathingSessions.dateKey));
      const dates = sessionsResult.map((s) => s.dateKey);
      if (dates.length === 0) {
        return res.json({ streak: 0, lastActiveDate: null });
      }
      let streak = 0;
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 864e5).toISOString().split("T")[0];
      if (dates[0] !== today && dates[0] !== yesterday) {
        return res.json({ streak: 0, lastActiveDate: dates[0] });
      }
      let currentDate = new Date(dates[0]);
      for (const dateKey of dates) {
        const sessionDate = new Date(dateKey);
        const diffDays = Math.floor((currentDate.getTime() - sessionDate.getTime()) / 864e5);
        if (diffDays <= 1) {
          streak++;
          currentDate = sessionDate;
        } else {
          break;
        }
      }
      res.json({ streak, lastActiveDate: dates[0] });
    } catch (error) {
      console.error("Error getting breathing streak:", error);
      res.status(500).json({ error: "Failed to get breathing streak" });
    }
  });
  app2.get("/api/breathing-wisdom", async (req, res) => {
    try {
      const techniqueId = req.query.techniqueId;
      const validTechniques = ["box", "478", "coherent", "energizing", "alternate", "triangle", "physio-sigh", "calming-2to1", "deep-relax-7211", "vishama-vritti"];
      if (!techniqueId || !validTechniques.includes(techniqueId)) {
        return res.status(400).json({ error: `Invalid technique ID. Must be one of: ${validTechniques.join(", ")}` });
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const cacheKey = `${techniqueId}-${today}`;
      const cached = breathingWisdomCache.get(cacheKey);
      if (cached) {
        const cacheAge = Date.now() - cached.timestamp;
        const twentyFourHours = 24 * 60 * 60 * 1e3;
        if (cacheAge < twentyFourHours) {
          return res.json({ wisdom: cached.wisdom });
        }
      }
      let wisdom;
      try {
        const techniqueDescriptions = {
          box: {
            name: "Box Breathing",
            pattern: "4-4-4-4 seconds (equal rhythm)",
            focus: "Focus, calm, grounding. Used by Navy SEALs and military personnel."
          },
          "478": {
            name: "4-7-8 Relaxation",
            pattern: "4 second inhale, 7 second hold, 8 second exhale",
            focus: "Sleep, anxiety relief, deep relaxation. Created by Dr. Andrew Weil."
          },
          coherent: {
            name: "Coherent Breathing",
            pattern: "5-5 seconds (balanced rhythm)",
            focus: "Heart-brain coherence, HRV optimization, emotional balance."
          },
          energizing: {
            name: "Energizing Breath",
            pattern: "2-1 seconds (quick rhythm)",
            focus: "Quick energy boost, alertness, oxygen flooding to brain."
          },
          alternate: {
            name: "Alternate Nostril (Nadi Shodhana)",
            pattern: "4-4-4-4 seconds alternating nostrils (inhale left, exhale right, inhale right, exhale left)",
            focus: "Brain hemisphere balancing, nervous system equilibrium, deep focus and calm."
          },
          triangle: {
            name: "Triangle Breathing",
            pattern: "4-4-4 seconds (inhale, hold, exhale)",
            focus: "Balance, grounding, simplicity. Three equal phases for calm focus."
          },
          "physio-sigh": {
            name: "Physiological Sigh",
            pattern: "4 second deep inhale + 1 second quick sip, 6 second exhale",
            focus: "Rapid stress relief, discovered by Stanford researchers. Mimics natural calming reflex."
          },
          "calming-2to1": {
            name: "2:1 Calming Breath",
            pattern: "4 second inhale, 8 second exhale (2:1 ratio)",
            focus: "Deep calm, sleep preparation. Extended exhale maximizes vagus nerve activation."
          },
          "deep-relax-7211": {
            name: "7-2-11 Deep Relaxation",
            pattern: "7 second inhale, 2 second hold, 11 second exhale",
            focus: "Sleep induction, deep relaxation. Used in clinical settings for insomnia."
          },
          "vishama-vritti": {
            name: "Vishama Vritti",
            pattern: "4 second inhale, 8 second hold, 6 second exhale (unequal ratio)",
            focus: "Mental clarity, concentration, stress resilience. Ancient Vedic breathing technique."
          }
        };
        const technique = techniqueDescriptions[techniqueId];
        const systemPrompt = `Generate 8 short tips about the ${technique.name} breathing technique. Each tip should be 8-15 words.

TODAY'S DATE: ${today}

TECHNIQUE DETAILS:
- Pattern: ${technique.pattern}
- Focus: ${technique.focus}

STYLE RULES:
- Half should be concrete science facts about what this breathing does to their body right now
- Half should be positive reinforcement \u2014 tell them they're doing something real and measurable for themselves
- State everything as direct fact. You KNOW the science \u2014 say it with confidence, no hedging
- Examples of GOOD tips:
  * "Your cortisol is dropping with every exhale right now"
  * "That extended exhale just activated your parasympathetic nervous system"
  * "Each cycle strengthens the connection between your prefrontal cortex and amygdala"
  * "Your baroreceptors are syncing to this rhythm \u2014 that's your blood pressure calming down"
  * "You're building real stress resilience that lasts beyond this session"
  * "Right now your vagus nerve is sending slow-down signals to your heart"
  * "This rhythm is shifting your brainwaves from beta toward alpha"
- Examples of BAD tips (too flowery/poetic \u2014 NEVER write these):
  * "Your body whispers secrets of tranquility"
  * "Ancient rhythms dance through your being"
  * "The universe breathes with you"
- BANNED PHRASES (never use these):
  * "studies show" / "research suggests" / "research shows"
  * "proven to" / "has been proven" / "science proves"
  * "according to" / "experts say" / "scientists found"
  * "up to X%" / any percentage claims
  * "can help" / "may reduce" / hedging language
- Do NOT give instructions like "try to..." or "make sure you..."
- NEVER use first-person "I" (e.g., "I know you can do it"). Always address the user directly with "you/your"
- Keep it grounded, factual, and encouraging \u2014 like a confident coach who knows the science cold

RESPONSE FORMAT:
Return ONLY the 8 tips, one per line. No numbering, no titles, no extra text.`;
        const userPrompt = `Generate 8 unique breathing wisdom tips for ${technique.name}. Today is ${today} \u2014 use this date to ensure tips feel fresh and varied each day.`;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 300
        });
        const content = response.choices[0]?.message?.content || "";
        wisdom = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith("*")).slice(0, 8);
        if (wisdom.length < 8) {
          const fallback = breathingWisdomFallbacks[techniqueId] || [];
          wisdom = [...wisdom, ...fallback].slice(0, 8);
        }
      } catch (aiError) {
        console.error("OpenAI error generating breathing wisdom:", aiError);
        wisdom = breathingWisdomFallbacks[techniqueId] || [];
      }
      breathingWisdomCache.set(cacheKey, {
        wisdom,
        timestamp: Date.now()
      });
      res.json({ wisdom });
    } catch (error) {
      console.error("Error generating breathing wisdom:", error);
      res.status(500).json({ error: "Failed to generate breathing wisdom" });
    }
  });
  app2.get("/api/breathing/favorite", requireAuth, async (req, res) => {
    try {
      const result = await db.select({ favoriteBreathingTechniqueId: users.favoriteBreathingTechniqueId }).from(users).where(eq4(users.id, req.userId));
      res.json({ favoriteId: result[0]?.favoriteBreathingTechniqueId || null });
    } catch (error) {
      console.error("Error fetching favorite breathing technique:", error);
      res.status(500).json({ error: "Failed to fetch favorite" });
    }
  });
  app2.patch("/api/breathing/favorite", requireAuth, async (req, res) => {
    try {
      const { techniqueId } = req.body;
      await db.update(users).set({ favoriteBreathingTechniqueId: techniqueId || null }).where(eq4(users.id, req.userId));
      res.json({ favoriteId: techniqueId || null });
    } catch (error) {
      console.error("Error saving favorite breathing technique:", error);
      res.status(500).json({ error: "Failed to save favorite" });
    }
  });
}

// server/routes/reminder-routes.ts
import { eq as eq5, and as and5 } from "drizzle-orm";
function registerReminderRoutes(app2) {
  async function generateReminderMessage(activityType, time, userName, currentMessage) {
    try {
      const hour = parseInt(time.split(":")[0], 10);
      let timeOfDay = "morning";
      if (hour >= 21) timeOfDay = "night";
      else if (hour >= 17) timeOfDay = "evening";
      else if (hour >= 12) timeOfDay = "afternoon";
      const avoidClause = currentMessage ? `
IMPORTANT: Do NOT repeat or rephrase this previous message: "${currentMessage}". Write something completely different.` : "";
      const techniqueGuidance = activityType === "breathe" ? `
You MUST recommend a specific breathing technique based on time of day:
- Morning: "Energizing Breath" (quick 2-1 rhythm for energy and alertness)
- Afternoon: "Box Breathing" (4-4-4-4 for focus and grounding) or "Coherent Breathing" (5-5 for balance)
- Evening: "Coherent Breathing" (5-5 for heart coherence and winding down)
- Night: "4-7-8 Relaxation" (deep relaxation for sleep)
Include the technique name naturally in your message.` : "";
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You write personalized notification messages for the Retuned mindfulness app. 
Rules: MAX 15 words, one sentence, no quotation marks, no exclamation marks.
Be warm and inviting, not pushy. Focus on the benefit of the activity.
For 'breathe' type: Focus on calm, peace, grounding, stress relief, breathing.
For 'believe' type: Focus on inner strength, positive mindset, self-belief, affirmations.
Match the tone to the time of day (morning=fresh start, afternoon=reset/recharge, evening=wind down/reflect, night=peace/rest).${techniqueGuidance}
Respond with ONLY the notification message text.${avoidClause}`
          },
          {
            role: "user",
            content: `Generate a ${activityType === "breathe" ? "meditation/breathing" : "affirmation listening"} reminder for ${timeOfDay} time.`
          }
        ],
        temperature: 1,
        max_tokens: 40
      });
      const message = response.choices[0]?.message?.content?.trim();
      if (message) return message;
    } catch (error) {
      console.error("Failed to generate reminder message:", error);
    }
    return activityType === "breathe" ? "A few mindful breaths can shift your entire day" : "Your affirmations are ready when you are";
  }
  app2.get("/api/reminders", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      let userReminders = await db.select().from(reminders).where(eq5(reminders.userId, userId)).orderBy(reminders.time);
      if (userReminders.length === 0) {
        const [oldSettings] = await db.select().from(notificationSettings).where(eq5(notificationSettings.userId, userId)).limit(1);
        if (oldSettings) {
          const [user] = await db.select({ name: users.name }).from(users).where(eq5(users.id, userId)).limit(1);
          const userName = user?.name || "Friend";
          const slotsToMigrate = [
            { enabled: oldSettings.morningEnabled, time: oldSettings.morningTime },
            { enabled: oldSettings.afternoonEnabled, time: oldSettings.afternoonTime },
            { enabled: oldSettings.eveningEnabled, time: oldSettings.eveningTime }
          ];
          for (const slot of slotsToMigrate) {
            if (slot.enabled && slot.time) {
              const message = await generateReminderMessage("believe", slot.time, userName);
              await db.insert(reminders).values({
                userId,
                activityType: "believe",
                time: slot.time,
                enabled: true,
                notificationMessage: message
              });
            }
          }
          userReminders = await db.select().from(reminders).where(eq5(reminders.userId, userId)).orderBy(reminders.time);
        }
      }
      res.json(userReminders);
    } catch (error) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });
  app2.post("/api/reminders", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const { activityType, time, enabled } = req.body;
      if (!activityType || !time) {
        return res.status(400).json({ error: "activityType and time are required" });
      }
      const existing = await db.select().from(reminders).where(eq5(reminders.userId, userId));
      if (existing.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 reminders allowed. Please delete one to add a new reminder." });
      }
      const [user] = await db.select({ name: users.name }).from(users).where(eq5(users.id, userId)).limit(1);
      const userName = user?.name || "Friend";
      const notificationMessage = await generateReminderMessage(activityType, time, userName);
      const [reminder] = await db.insert(reminders).values({
        userId,
        activityType,
        time,
        enabled: enabled ?? true,
        notificationMessage
      }).returning();
      res.json(reminder);
    } catch (error) {
      console.error("Error creating reminder:", error);
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });
  app2.put("/api/reminders/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const reminderId = parseInt(req.params.id, 10);
      const { activityType, time, enabled } = req.body;
      const [existing] = await db.select().from(reminders).where(and5(eq5(reminders.id, reminderId), eq5(reminders.userId, userId))).limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      const updates = {};
      if (activityType !== void 0) updates.activityType = activityType;
      if (time !== void 0) updates.time = time;
      if (enabled !== void 0) updates.enabled = enabled;
      const needsNewMessage = activityType !== void 0 && activityType !== existing.activityType || time !== void 0 && time !== existing.time;
      if (needsNewMessage) {
        const [user] = await db.select({ name: users.name }).from(users).where(eq5(users.id, userId)).limit(1);
        const userName = user?.name || "Friend";
        updates.notificationMessage = await generateReminderMessage(
          activityType ?? existing.activityType,
          time ?? existing.time,
          userName
        );
      }
      const [updated] = await db.update(reminders).set(updates).where(and5(eq5(reminders.id, reminderId), eq5(reminders.userId, userId))).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });
  app2.delete("/api/reminders/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const reminderId = parseInt(req.params.id, 10);
      const [existing] = await db.select().from(reminders).where(and5(eq5(reminders.id, reminderId), eq5(reminders.userId, userId))).limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      await db.delete(reminders).where(and5(eq5(reminders.id, reminderId), eq5(reminders.userId, userId)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reminder:", error);
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });
  app2.post("/api/reminders/:id/regenerate-message", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const reminderId = parseInt(req.params.id, 10);
      const [existing] = await db.select().from(reminders).where(and5(eq5(reminders.id, reminderId), eq5(reminders.userId, userId))).limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }
      const [user] = await db.select({ name: users.name }).from(users).where(eq5(users.id, userId)).limit(1);
      const userName = user?.name || "Friend";
      const notificationMessage = await generateReminderMessage(existing.activityType, existing.time, userName, existing.notificationMessage ?? void 0);
      const [updated] = await db.update(reminders).set({ notificationMessage }).where(and5(eq5(reminders.id, reminderId), eq5(reminders.userId, userId))).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error regenerating reminder message:", error);
      res.status(500).json({ error: "Failed to regenerate reminder message" });
    }
  });
  app2.post("/api/support", optionalAuth, async (req, res) => {
    try {
      const { email, subject, message, appVersion } = req.body;
      if (!email || !subject || !message) {
        return res.status(400).json({ error: "Email, subject, and message are required" });
      }
      const userId = req.userId || null;
      const [request] = await db.insert(supportRequests).values({
        userId,
        email,
        subject,
        message,
        appVersion: appVersion || null
      }).returning();
      res.json({ success: true, requestId: request.id });
    } catch (error) {
      console.error("Error submitting support request:", error);
      res.status(500).json({ error: "Failed to submit support request" });
    }
  });
  app2.post("/api/feedback", optionalAuth, async (req, res) => {
    try {
      const { type, title, message, email, appVersion } = req.body;
      if (!title || !message) {
        return res.status(400).json({ error: "Title and message are required" });
      }
      const userId = req.userId || null;
      const subject = `[${type || "feedback"}] ${title}`;
      const [request] = await db.insert(supportRequests).values({
        userId,
        email: email || "not provided",
        subject,
        message,
        appVersion: appVersion || null
      }).returning();
      res.json({ success: true, requestId: request.id });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });
}

// server/routes/admin-routes.ts
import path2 from "path";
import fs2 from "fs";
import { eq as eq6, desc as desc2 } from "drizzle-orm";
var ADMIN_USER_IDS = /* @__PURE__ */ new Set([
  "77adcd55-7d43-48b2-ab2d-32375c4ea4d5"
]);
function registerAdminRoutes(app2, generateAudio2, getPillarVoiceConfig2) {
  app2.post("/api/admin/regenerate-sound/:filename", requireAuth, async (req, res) => {
    try {
      const filename = req.params.filename;
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const audioDir = path2.join(process.cwd(), "assets", "audio");
      const audioBuffer = await generateSoundEffect(prompt, 22, 0.3);
      const filePath = path2.join(audioDir, filename);
      fs2.writeFileSync(filePath, Buffer.from(audioBuffer));
      res.json({ success: true, filename, bytes: audioBuffer.byteLength });
    } catch (error) {
      console.error("Error regenerating sound:", error);
      res.status(500).json({ error: "Failed to regenerate sound", details: error.message });
    }
  });
  app2.post("/api/admin/generate-ambient-sounds", requireAuth, async (req, res) => {
    try {
      const audioDir = path2.join(process.cwd(), "assets", "audio");
      const soundConfigs = [
        { filename: "rain-ambient.mp3", prompt: "Gentle rain falling on leaves and soft ground, peaceful and calming ambient rainfall for meditation and relaxation" },
        { filename: "ocean-waves.mp3", prompt: "Peaceful ocean waves gently lapping on a sandy beach at sunset, calming sea ambience for relaxation and sleep" },
        { filename: "forest-birds.mp3", prompt: "Serene forest ambience with gentle birdsong, rustling leaves, and distant woodland sounds, peaceful nature atmosphere" },
        { filename: "wind-gentle.mp3", prompt: "Steady wind blowing through trees with audible whooshing and rustling sounds, continuous breeze ambience, clear wind noise for relaxation" },
        { filename: "432hz-healing.mp3", prompt: "Deep resonant 432Hz healing frequency tone, pure and sustained, for meditation and spiritual healing" },
        { filename: "528hz-love.mp3", prompt: "Pure 528Hz solfeggio love frequency tone, sustained and harmonious, for transformation and DNA healing" },
        { filename: "theta-waves.mp3", prompt: "Deep theta brainwave binaural beat at 6Hz, layered with soft ambient tones for deep meditation and creativity" },
        { filename: "alpha-waves.mp3", prompt: "Relaxing alpha brainwave binaural beat at 10Hz, with gentle ambient background for relaxation and calm focus" },
        { filename: "delta-waves.mp3", prompt: "Deep delta brainwave binaural beat at 2Hz, with soft dreamy ambient tones for deep sleep and restoration" },
        { filename: "beta-waves.mp3", prompt: "Energizing beta brainwave binaural beat at 18Hz, with subtle ambient background for focus and concentration" }
      ];
      const results = [];
      for (const config of soundConfigs) {
        try {
          const audioBuffer = await generateSoundEffect(config.prompt, 22, 0.3);
          const filePath = path2.join(audioDir, config.filename);
          fs2.writeFileSync(filePath, Buffer.from(audioBuffer));
          results.push({ filename: config.filename, success: true });
        } catch (error) {
          console.error(`Failed to generate ${config.filename}:`, error.message);
          results.push({ filename: config.filename, success: false, error: error.message });
        }
      }
      res.json({
        message: "Ambient sound generation complete",
        results,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length
      });
    } catch (error) {
      console.error("Error generating ambient sounds:", error);
      res.status(500).json({ error: "Failed to generate ambient sounds", details: error.message });
    }
  });
  app2.post("/api/admin/generate-sample-audio", async (req, res) => {
    try {
      const { adminKey } = req.body;
      if (adminKey !== "generate-sample-audio-2024") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sampleAffirmations = await db.select().from(affirmations).where(eq6(affirmations.userId, "apple-review-test-account"));
      const results = [];
      const audioDir = path2.join(process.cwd(), "uploads", "audio");
      if (!fs2.existsSync(audioDir)) {
        fs2.mkdirSync(audioDir, { recursive: true });
      }
      for (const affirmation of sampleAffirmations) {
        try {
          if (affirmation.audioUrl) {
            results.push({ id: affirmation.id, title: affirmation.title, status: "skipped - already has audio" });
            continue;
          }
          const voiceId = affirmation.aiVoiceId || "hume_lotus";
          const audioResult = await generateAudio2(affirmation.script, voiceId, false, getPillarVoiceConfig2(affirmation.pillar));
          const audioFileName = `affirmation-${affirmation.id}-${Date.now()}.mp3`;
          const audioPath = path2.join(audioDir, audioFileName);
          fs2.writeFileSync(audioPath, Buffer.from(audioResult.audio));
          const audioUrl = `/uploads/audio/${audioFileName}`;
          await db.update(affirmations).set({
            audioUrl,
            duration: audioResult.duration,
            wordTimings: JSON.stringify(audioResult.wordTimings),
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq6(affirmations.id, affirmation.id));
          results.push({ id: affirmation.id, title: affirmation.title, status: "success" });
          await new Promise((resolve2) => setTimeout(resolve2, 500));
        } catch (err) {
          console.error(`Failed to generate audio for ${affirmation.title}:`, err);
          results.push({ id: affirmation.id, title: affirmation.title, status: "error", error: err.message });
        }
      }
      res.json({ total: sampleAffirmations.length, results });
    } catch (error) {
      console.error("Error generating sample audio:", error);
      res.status(500).json({ error: "Failed to generate sample audio" });
    }
  });
  app2.get("/api/admin/voice-slots", requireAuth, async (req, res) => {
    if (!ADMIN_USER_IDS.has(req.userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const stats = await getVoiceSlotStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching voice slot stats:", error);
      res.status(500).json({ error: "Failed to fetch voice slot stats" });
    }
  });
  app2.get("/api/admin/voice-rotation/preview", requireAuth, async (req, res) => {
    if (!ADMIN_USER_IDS.has(req.userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const days = parseInt(req.query.days) || 60;
      const inactive = await findInactiveVoices(days);
      res.json({ inactiveDays: days, count: inactive.length, voices: inactive });
    } catch (error) {
      console.error("Error previewing voice rotation:", error);
      res.status(500).json({ error: "Failed to preview voice rotation" });
    }
  });
  app2.post("/api/admin/voice-rotation/run", requireAuth, async (req, res) => {
    if (!ADMIN_USER_IDS.has(req.userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const days = parseInt(req.body.days) || 60;
      const results = await runVoiceRotation(days);
      res.json(results);
    } catch (error) {
      console.error("Error running voice rotation:", error);
      res.status(500).json({ error: "Failed to run voice rotation" });
    }
  });
  app2.patch("/api/admin/users/:userId/tts-provider", requireAuth, async (req, res) => {
    return res.status(410).json({ error: "TTS provider switching is temporarily disabled. All users use ElevenLabs." });
  });
  app2.get("/api/admin/errors", requireAuth, async (req, res) => {
    if (!ADMIN_USER_IDS.has(req.userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 500);
      const errors = await db.select().from(serverErrors).orderBy(desc2(serverErrors.createdAt)).limit(limit);
      res.json({ errors, count: errors.length });
    } catch (error) {
      console.error("Error fetching server errors:", error);
      res.status(500).json({ error: "Failed to fetch server errors" });
    }
  });
  app2.patch("/api/admin/errors/:id/resolve", requireAuth, async (req, res) => {
    if (!ADMIN_USER_IDS.has(req.userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const errorId = parseInt(req.params.id);
      if (isNaN(errorId)) {
        return res.status(400).json({ error: "Invalid error ID" });
      }
      const [updated] = await db.update(serverErrors).set({ resolved: true }).where(eq6(serverErrors.id, errorId)).returning();
      if (!updated) {
        return res.status(404).json({ error: "Error not found" });
      }
      res.json({ success: true, error: updated });
    } catch (error) {
      console.error("Error resolving server error:", error);
      res.status(500).json({ error: "Failed to resolve error" });
    }
  });
  app2.get("/api/admin/backup", requireAuth, async (req, res) => {
    if (!ADMIN_USER_IDS.has(req.userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const usersData = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        authProvider: users.authProvider,
        country: users.country,
        city: users.city,
        createdAt: users.createdAt,
        lastActiveAt: users.lastActiveAt,
        devicePlatform: users.devicePlatform,
        signupSource: users.signupSource,
        hasVoiceSample: users.hasVoiceSample,
        subscriptionTier: users.subscriptionTier,
        role: users.role
      }).from(users);
      const affirmationsData = await db.select().from(affirmations);
      const journeyCompletionsData = await db.select().from(journeyCompletions);
      const listeningSessionsData = await db.select().from(listeningSessions);
      const breathingSessionsData = await db.select().from(breathingSessions);
      const analyticsEventsData = await db.select().from(analyticsEvents);
      res.json({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        users: usersData,
        affirmations: affirmationsData,
        journey_completions: journeyCompletionsData,
        listening_sessions: listeningSessionsData,
        breathing_sessions: breathingSessionsData,
        analytics_events: analyticsEventsData
      });
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });
}

// server/routes/dev-routes.ts
import multer from "multer";
import { writeFile as writeFile2, unlink as unlink2 } from "fs/promises";
import { join as join2 } from "path";
import { tmpdir as tmpdir2 } from "os";
import { randomUUID as randomUUID2 } from "crypto";
var upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
async function generateWithElevenLabs(voiceBuffer, text2) {
  const tempPath = join2(tmpdir2(), `ab-test-${randomUUID2()}.mp3`);
  let voiceId = null;
  try {
    await writeFile2(tempPath, voiceBuffer);
    voiceId = await cloneVoice(tempPath, `AB-Test-${randomUUID2().slice(0, 8)}`);
    const result = await textToSpeech(text2, voiceId);
    const audioBuffer = Buffer.from(result.audio);
    return {
      provider: "elevenlabs",
      audioBase64: audioBuffer.toString("base64"),
      durationMs: result.duration * 1e3,
      error: null
    };
  } finally {
    await unlink2(tempPath).catch(() => {
    });
    if (voiceId) {
      await deleteVoice(voiceId).catch(() => {
      });
    }
  }
}
async function generateWithChatterbox(voiceBuffer, text2) {
  const { Client, handle_file } = await import("@gradio/client");
  const client = await Client.connect("ResembleAI/Chatterbox");
  const audioBlob = new Blob([new Uint8Array(voiceBuffer)], { type: "audio/wav" });
  const result = await client.predict(1, [
    text2,
    handle_file(audioBlob),
    0.5,
    0.8,
    0,
    0.5,
    0.05,
    1,
    1.2
  ]);
  const audioData = result.data[0];
  let base64;
  if (typeof audioData === "string" && audioData.startsWith("http")) {
    const response = await fetch(audioData);
    const arrayBuffer = await response.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else if (audioData instanceof Blob) {
    const arrayBuffer = await audioData.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else if (Buffer.isBuffer(audioData)) {
    base64 = audioData.toString("base64");
  } else if (audioData?.url && typeof audioData.url === "string") {
    const response = await fetch(audioData.url);
    const arrayBuffer = await response.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else {
    throw new Error("Unexpected audio data format from Chatterbox");
  }
  return {
    provider: "chatterbox",
    audioBase64: base64,
    durationMs: 0,
    error: null
  };
}
function registerDevRoutes(app2, requireAuth2) {
  app2.post("/api/dev/ab-test", requireAuth2, upload.single("voiceClip"), async (req, res) => {
    req.setTimeout(3e5);
    res.setTimeout(3e5);
    try {
      const text2 = req.body?.text;
      const voiceFile = req.file;
      console.log(`[AB-TEST] Request received \u2014 text length: ${text2?.length || 0}, file size: ${voiceFile?.size || 0} bytes`);
      if (!text2 || !voiceFile) {
        return res.status(400).json({ error: "Both 'text' and 'voiceClip' are required" });
      }
      const voiceBuffer = voiceFile.buffer;
      const timedCall = async (fn, provider) => {
        const start = Date.now();
        try {
          const result = await fn();
          return { result, timeMs: Date.now() - start };
        } catch (err) {
          return {
            result: { provider, audioBase64: null, durationMs: 0, error: err.message || String(err) },
            timeMs: Date.now() - start
          };
        }
      };
      console.log(`[AB-TEST] Starting both providers in parallel...`);
      const [elevenLabs, chatterbox] = await Promise.all([
        timedCall(() => generateWithElevenLabs(voiceBuffer, text2), "elevenlabs"),
        timedCall(() => generateWithChatterbox(voiceBuffer, text2), "chatterbox")
      ]);
      console.log(`[AB-TEST] Complete \u2014 ElevenLabs: ${elevenLabs.timeMs}ms (${elevenLabs.result.error ? "FAILED" : "OK"}), Chatterbox: ${chatterbox.timeMs}ms (${chatterbox.result.error ? "FAILED" : "OK"})`);
      res.json({
        results: [elevenLabs.result, chatterbox.result],
        generationTimeMs: {
          elevenlabs: elevenLabs.timeMs,
          chatterbox: chatterbox.timeMs
        }
      });
    } catch (error) {
      console.error("AB test error:", error);
      res.status(500).json({ error: "AB test failed", details: error.message });
    }
  });
}

// server/routes/analytics-routes.ts
import { sql as sql6, gte as gte2, eq as eq7, isNotNull as isNotNull3 } from "drizzle-orm";
function registerAnalyticsRoutes(app2) {
  app2.post("/api/analytics/events", optionalAuth, async (req, res) => {
    try {
      const authReq = req;
      const userId = authReq.userId || null;
      const { events } = req.body;
      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "events array is required" });
      }
      if (events.length > 50) {
        return res.status(400).json({ error: "Maximum 50 events per batch" });
      }
      const rows = events.map((event) => ({
        userId: userId || event.userId || null,
        sessionId: event.sessionId || null,
        eventName: event.eventName,
        properties: event.properties || null,
        screenName: event.screenName || null,
        platform: event.platform || null,
        appVersion: event.appVersion || null
      }));
      await db.insert(analyticsEvents).values(rows);
      res.json({ success: true, count: rows.length });
    } catch (error) {
      console.error("[analytics] Failed to record events:", error);
      res.status(500).json({ error: "Failed to record events" });
    }
  });
  app2.get("/api/admin/analytics/summary", async (req, res) => {
    try {
      const authReq = req;
      if (!authReq.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq7(users.id, authReq.userId));
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const days = parseInt(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
      const [eventCounts, uniqueUsers, topEvents] = await Promise.all([
        db.select({ count: sql6`count(*)` }).from(analyticsEvents).where(gte2(analyticsEvents.createdAt, since)),
        db.select({ count: sql6`count(distinct ${analyticsEvents.userId})` }).from(analyticsEvents).where(gte2(analyticsEvents.createdAt, since)),
        db.select({
          eventName: analyticsEvents.eventName,
          count: sql6`count(*)`
        }).from(analyticsEvents).where(gte2(analyticsEvents.createdAt, since)).groupBy(analyticsEvents.eventName).orderBy(sql6`count(*) desc`).limit(20)
      ]);
      res.json({
        period: `${days} days`,
        totalEvents: eventCounts[0]?.count || 0,
        uniqueUsers: uniqueUsers[0]?.count || 0,
        topEvents
      });
    } catch (error) {
      console.error("[analytics] Failed to get summary:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });
  app2.get("/api/admin/dashboard-data", async (req, res) => {
    try {
      const authReq = req;
      if (!authReq.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq7(users.id, authReq.userId));
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const days = parseInt(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
      const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3);
      const [
        totalUsersResult,
        activeUsersResult,
        newSignupsResult,
        geographyResult,
        dailySignupsResult,
        featureUsageResult,
        platformResult
      ] = await Promise.all([
        db.select({ count: sql6`count(*)` }).from(users),
        db.select({ count: sql6`count(*)` }).from(users).where(gte2(users.lastActiveAt, since)),
        db.select({ count: sql6`count(*)` }).from(users).where(gte2(users.createdAt, since)),
        db.select({
          country: users.country,
          count: sql6`count(*)`
        }).from(users).where(isNotNull3(users.country)).groupBy(users.country).orderBy(sql6`count(*) desc`),
        db.select({
          date: sql6`date_trunc('day', ${users.createdAt})::date`,
          count: sql6`count(*)`
        }).from(users).where(gte2(users.createdAt, since14d)).groupBy(sql6`date_trunc('day', ${users.createdAt})::date`).orderBy(sql6`date_trunc('day', ${users.createdAt})::date`),
        db.select({
          prefix: sql6`split_part(${analyticsEvents.eventName}, '_', 1)`,
          count: sql6`count(*)`
        }).from(analyticsEvents).where(gte2(analyticsEvents.createdAt, since)).groupBy(sql6`split_part(${analyticsEvents.eventName}, '_', 1)`).orderBy(sql6`count(*) desc`),
        db.select({
          platform: analyticsEvents.platform,
          count: sql6`count(distinct ${analyticsEvents.userId})`
        }).from(analyticsEvents).where(isNotNull3(analyticsEvents.platform)).groupBy(analyticsEvents.platform)
      ]);
      const featureMap = {
        breathing: "Breathing",
        affirmation: "Affirmations",
        meditation: "Meditation",
        mood: "Mood",
        journey: "Journey"
      };
      const featureUsage = featureUsageResult.map((row) => ({
        feature: featureMap[row.prefix] || row.prefix,
        count: Number(row.count)
      }));
      res.json({
        totalUsers: Number(totalUsersResult[0]?.count || 0),
        activeUsers7d: Number(activeUsersResult[0]?.count || 0),
        newSignups7d: Number(newSignupsResult[0]?.count || 0),
        geography: geographyResult.map((r) => ({ country: r.country, count: Number(r.count) })),
        dailySignups: dailySignupsResult.map((r) => ({ date: r.date, count: Number(r.count) })),
        featureUsage,
        platformBreakdown: platformResult.map((r) => ({ platform: r.platform, count: Number(r.count) }))
      });
    } catch (error) {
      console.error("[analytics] Failed to get dashboard data:", error);
      res.status(500).json({ error: "Failed to get dashboard data" });
    }
  });
}

// server/routes.ts
var aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1e3,
  max: 5,
  message: { error: "Too many requests. Please wait a minute before generating more affirmations." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});
var voiceCloneLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 6,
  message: { error: "Too many voice cloning attempts. Please wait about an hour and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});
var ttsLimiter = rateLimit({
  windowMs: 60 * 1e3,
  max: 10,
  message: { error: "Too many audio generation requests. Please wait before creating more." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});
var dailyGreetingLimiter = rateLimit({
  windowMs: 60 * 1e3,
  max: 10,
  message: { error: "Too many greeting requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req;
    return authReq.userId || req.ip || "unknown";
  }
});
var guidedMomentLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1e3,
  max: 20,
  message: { error: "You've reached today's limit for micro-meditations. Come back tomorrow for a fresh session." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const authReq = req;
    return `guided-${authReq.userId || req.ip || "unknown"}`;
  }
});
var MEDITATION_MOOD_CONFIG = {
  calm: {
    scriptTone: "serene, spacious, and deeply unhurried \u2014 like floating on still water. Use languid, flowing language with long vowel sounds. Invite the listener to sink deeper into stillness.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.25
  },
  stressed: {
    scriptTone: "soothing, reassuring, and safe \u2014 like a warm blanket wrapping around tension. Use short, simple sentences that feel like exhales. Emphasize releasing, letting go, and being held.",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3
  },
  tired: {
    scriptTone: "gentle, nurturing, and restoring \u2014 like soft morning light. Use comforting, cozy language. Acknowledge weariness with compassion before gently inviting renewal.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.25
  },
  anxious: {
    scriptTone: "grounding, steady, and anchoring \u2014 like roots growing deep into earth. Use concrete, physical language (feet on ground, weight of body, solid surfaces). Repeat grounding cues. Prioritize predictability and safety in word choice.",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2
  },
  sad: {
    scriptTone: "warm, tender, and compassionate \u2014 like being gently held by someone who truly understands. Use soft, comforting language that acknowledges pain without rushing past it. Invite the listener to be gentle with themselves.",
    humeSpeed: 0.88,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3
  },
  overwhelmed: {
    scriptTone: "steady, simplifying, and reassuring \u2014 like a calm hand on your shoulder when everything feels too much. Use short, clear sentences. Emphasize one thing at a time, letting go of what can wait, and coming back to this single breath.",
    humeSpeed: 0.88,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2
  },
  energized: {
    scriptTone: "bright, uplifting, and invigorating \u2014 like the first breath of fresh mountain air. Use dynamic, forward-moving language that celebrates vitality and momentum.",
    humeSpeed: 1,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.4
  },
  grateful: {
    scriptTone: "warm, reverent, and heart-centered \u2014 like sunlight pouring through a window onto your chest. Use rich, appreciative language that savors each moment and connection.",
    humeSpeed: 0.9,
    pauseSeconds: 1.6,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.35
  },
  confident: {
    scriptTone: "strong, grounded, and empowering \u2014 like standing tall on solid ground with the wind at your back. Use affirming, bold language that reinforces inner strength and self-trust.",
    humeSpeed: 0.95,
    pauseSeconds: 1.4,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.4
  },
  focused: {
    scriptTone: "clear, precise, and centering \u2014 like a laser beam of gentle attention cutting through noise. Use clean, purposeful language that sharpens awareness and quiets distraction.",
    humeSpeed: 0.92,
    pauseSeconds: 1.5,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3
  },
  joyful: {
    scriptTone: "light, playful, and radiant \u2014 like bubbles of laughter rising through warm water. Use buoyant, celebratory language that invites smiling from the inside out.",
    humeSpeed: 0.95,
    pauseSeconds: 1.4,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45
  }
};
var PILLAR_VOICE_CONFIG = {
  mind: {
    scriptTone: "Clear, steady, and measured. Quiet certainty. Deliver each statement like a calm, focused thought landing with precision.",
    humeSpeed: 0.92,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3
  },
  body: {
    scriptTone: "Warm, grounded, and physical. Connected to sensation. Speak as if you can feel each word in your body \u2014 rooted and present.",
    humeSpeed: 0.95,
    pauseSeconds: 1.1,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.4
  },
  spirit: {
    scriptTone: "Soft, contemplative, and spacious. Gentle and unhurried. Let each phrase breathe, as if the silence between words matters as much as the words themselves.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.25
  },
  connection: {
    scriptTone: "Warm, open, and heartfelt. Inviting and sincere. Speak as if addressing someone you deeply care about \u2014 natural, genuine, emotionally present.",
    humeSpeed: 0.93,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45
  },
  achievement: {
    scriptTone: "Confident, grounded, and forward-moving. Strong without being aggressive. Deliver like a coach who believes in you \u2014 direct, clear, empowering.",
    humeSpeed: 1,
    pauseSeconds: 0.9,
    elevenLabsStability: 0.4,
    elevenLabsStyle: 0.5
  }
};
function getPillarVoiceConfig(pillar) {
  if (!pillar) return void 0;
  const key = pillar.toLowerCase();
  const config = PILLAR_VOICE_CONFIG[key];
  if (!config) return void 0;
  return config;
}
var dailyGreetingCache = /* @__PURE__ */ new Map();
var dailyGreetingFallbacks = {
  morning: "Your brain is most receptive right now \u2014 use that",
  afternoon: "Repetition is not boring, it is how neural pathways get built",
  evening: "Your subconscious processes everything while you wind down",
  night: "Sleep is when your brain consolidates new patterns \u2014 prime it well"
};
var uploadDir = path3.join(process.cwd(), "uploads");
if (!fs3.existsSync(uploadDir)) {
  fs3.mkdirSync(uploadDir, { recursive: true });
}
var MAX_AI_AFFIRMATIONS_PER_MONTH = 20;
var MAX_VOICE_CLONES_LIFETIME = 5;
async function checkAndResetMonthlyLimits(userId) {
  const [user] = await db.select({
    affirmationsThisMonth: users.affirmationsThisMonth,
    monthlyResetDate: users.monthlyResetDate
  }).from(users).where(eq8(users.id, userId)).limit(1);
  if (!user) {
    return { affirmationsThisMonth: 0, affirmationsRemaining: MAX_AI_AFFIRMATIONS_PER_MONTH, needsReset: false };
  }
  const now = /* @__PURE__ */ new Date();
  const resetDate = user.monthlyResetDate ? new Date(user.monthlyResetDate) : now;
  const needsReset = now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();
  if (needsReset) {
    await db.update(users).set({
      affirmationsThisMonth: 0,
      monthlyResetDate: now
    }).where(eq8(users.id, userId));
    return { affirmationsThisMonth: 0, affirmationsRemaining: MAX_AI_AFFIRMATIONS_PER_MONTH, needsReset: true };
  }
  const current = user.affirmationsThisMonth || 0;
  return {
    affirmationsThisMonth: current,
    affirmationsRemaining: Math.max(0, MAX_AI_AFFIRMATIONS_PER_MONTH - current),
    needsReset: false
  };
}
var audioUpload = multer2({
  storage: multer2.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `voice-${uniqueSuffix}${path3.extname(file.originalname) || ".m4a"}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});
async function generateScript(goal, categories2, length, pillar) {
  const lengthConfig = {
    short: { sentences: 2, tokens: 150, description: "exactly 2 sentences" },
    medium: { sentences: 5, tokens: 350, description: "exactly 5 sentences" },
    long: { sentences: 10, tokens: 600, description: "exactly 10 sentences" }
  };
  const categoryTones = {
    Confidence: "bold, assertive, and powerful language with self-assurance",
    Career: "professional, ambitious, and driven language focused on leadership and success",
    Health: "nurturing, calming, and wellness-focused language about vitality and healing",
    Wealth: "abundant, prosperous, and magnetic language about financial freedom",
    Relationships: "warm, soft, loving, and gentle language about connection and harmony",
    Sleep: "peaceful, soothing, dreamy, and tranquil language about rest and relaxation",
    Vision: "inspiring, aspirational, and visionary language about future possibilities and dreams",
    Emotion: "emotionally intelligent, balanced, and self-aware language about emotional mastery",
    Happiness: "joyful, optimistic, and uplifting language about inner peace and contentment",
    Skills: "confident, growth-oriented, and capable language about learning and mastery",
    Habits: "disciplined, consistent, and empowering language about positive routines",
    Motivation: "energizing, driven, and action-oriented language about determination and persistence",
    Gratitude: "appreciative, thankful, and abundant language about blessings and appreciation"
  };
  const pillarThemes = {
    Mind: "Focus on mental clarity, cognitive strength, emotional intelligence, and psychological resilience. Use language that emphasizes sharp thinking, mental fortitude, and inner calm.",
    Body: "Focus on physical vitality, wellness, self-care, and bodily acceptance. Use language that emphasizes health, energy, rest, and loving your physical self.",
    Spirit: "Focus on inner peace, gratitude, joy, and future vision. Use language that emphasizes spiritual connection, thankfulness, happiness, and aspirational dreaming.",
    Connection: "Focus on meaningful relationships and self-compassion. Use language that emphasizes love, empathy, understanding, and kindness toward self and others.",
    Achievement: "Focus on success, ambition, wealth, and personal growth. Use language that emphasizes accomplishment, abundance, skill mastery, and determined action."
  };
  const config = lengthConfig[length] || lengthConfig.medium;
  let toneInstruction = "Use positive, empowering, and uplifting language.";
  if (pillar && pillarThemes[pillar]) {
    toneInstruction = pillarThemes[pillar];
  }
  if (categories2 && categories2.length > 0) {
    const tones = categories2.map((cat) => categoryTones[cat]).filter(Boolean);
    if (tones.length > 0) {
      toneInstruction += ` Additionally, weave in these specific elements: ${tones.join("; ")}.`;
    }
  }
  const systemPrompt = `You are an expert in subconscious reprogramming and neurolinguistic patterning. Write ${config.sentences} affirmation sentences that are psychologically optimized to bypass conscious resistance and embed deeply into the subconscious mind.

SUBCONSCIOUS LANGUAGE RULES (apply ALL of these):

1. PRESENT TENSE ONLY: Always "I am", "I have", "I feel" \u2014 never future tense. The subconscious cannot process "I will" or "someday". Everything must feel true NOW.

2. POSITIVE FRAMING: Never use negatives (not, don't, won't, no longer, without, free from). The subconscious ignores negation and absorbs the negative concept. Say "I am calm" not "I am not anxious". Say "I welcome abundance" not "I am free from scarcity".

3. SENSORY-RICH LANGUAGE: Include felt sensations \u2014 what the person feels in their body, sees in their mind, or hears internally. Examples: "I feel the steady warmth of confidence radiating through my chest", "I sense my own quiet power". This activates the subconscious through embodiment.

4. IDENTITY-LEVEL STATEMENTS: Frame as identity ("I am someone who..."), not behavior ("I try to..."). Identity statements reshape self-concept at the deepest level. Mix "I am" with "I naturally...", "I effortlessly...", "It is in my nature to...".

5. PROGRESSIVE BELIEVABILITY: Start with grounded, easily believable statements and gradually build to more aspirational ones. This prevents conscious rejection. First sentence should feel undeniably true, last sentence should feel like an exciting stretch.

6. EMBEDDED COMMANDS: Weave in subtle permission-giving phrases: "I allow myself to...", "I give myself permission to...", "I am ready to...", "I am open to receiving...". These dissolve inner resistance.

7. RHYTHM AND FLOW: Create a natural, almost poetic cadence. Use parallel structure and gentle repetition of key power words. The rhythm makes phrases easier for the subconscious to absorb during repetitive listening.

8. EMOTIONAL ANCHORING: Each sentence should evoke a specific positive emotion (safety, pride, gratitude, excitement, peace, love). Name the emotion when possible: "I feel deeply proud of who I am becoming."

9. WORD VARIETY: Avoid overusing any single verb or adjective. Specifically, do NOT overuse these words: embrace, unlock, harness, ignite, unleash, manifest, radiate, transcend, awaken, abundant, limitless, boundless, infinite. Use each at most ONCE across the entire script, and prefer simpler, more natural alternatives like "welcome", "hold", "carry", "choose", "build", "step into", "notice", "trust".

10. HUMAN VOICE: Write the way a real person talks to themselves \u2014 not like a motivational poster. Use contractions (I'm, it's, I've, that's). Vary sentence length \u2014 mix short punchy statements with longer flowing ones. Avoid stacking grandiose adjectives (never "immense, limitless, boundless power"). Include moments of gentle self-acknowledgment: "I've been working on this, and it's showing" or "something in me is shifting." Occasional dashes and commas create natural breathing pauses. The listener should feel like these are their own private thoughts, not a script being read to them.

11. AVOID AI-ISMS: Never sound like a corporate affirmation card or self-help book cover. Avoid clich\xE9s like "I am a beacon of light", "I radiate pure energy", "I command the room", "my potential is limitless." Instead, choose language that feels intimate and specific \u2014 "there's a quiet confidence building in me" rather than "I radiate unshakeable confidence." If a sentence could appear on a motivational Instagram post, rewrite it to sound more like a private journal entry.

FORMAT: No titles, no instructions, no numbering, no quotes. Just ${config.sentences} flowing sentences, each on its own line. Write as if speaking directly to the deepest part of someone's mind.

TONE AND STYLE: ${toneInstruction}`;
  const pillarContext = pillar ? ` Life pillar: ${pillar}.` : "";
  const categoryContext = categories2 && categories2.length > 0 ? ` Focus areas: ${categories2.join(", ")}.` : "";
  const userPrompt = `${config.sentences} affirmations for: ${goal}.${pillarContext}${categoryContext} Only ${config.sentences} sentences total.`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: config.tokens
  });
  let script = response.choices[0]?.message?.content || "";
  script = script.replace(/^\*\*.*?\*\*\s*/gm, "").replace(/^#+\s*.*?\n/gm, "").replace(/\*?\([^)]*\)\*?\s*/g, "").replace(/\[[^\]]*\]\s*/g, "").replace(/^\d+\.\s*/gm, "").replace(/^\s*\n/gm, "").trim();
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > config.sentences) {
    script = sentences.slice(0, config.sentences).join(" ").trim();
  }
  script = await humanizeScript(script, config.sentences);
  return script;
}
async function humanizeScript(script, sentenceCount) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a humanizer for affirmation scripts. Your ONLY job is to rewrite stiff, AI-sounding affirmations so they sound like a real person's private inner thoughts.

RULES:
- Exactly ${sentenceCount} sentences. Each on its own line. No titles, numbering, or quotes.
- Preserve the psychological structure: present tense, positive framing, identity statements, embedded commands, progressive believability.
- Do NOT add new concepts. Only rephrase what's there.

VOICE \u2014 This is the most important part:
- Use contractions ALWAYS: I'm, I've, it's, that's, there's, I'd, who's. Never "I am" when "I'm" works. Never "it is" when "it's" sounds more natural.
- Mix sentence lengths dramatically. Some sentences should be 5-8 words. Others can flow longer. Never let all sentences be the same length.
- Add dashes and commas for breathing rhythm: "I'm building something real \u2014 and I can feel it."
- Include self-acknowledgment: "I've been working at this, and it's showing." "Something in me is different now."
- Write like a private journal entry, not a speech. "There's a steadiness in me that wasn't there before" instead of "I am filled with unwavering steadiness."

KILL THESE AI PATTERNS:
- "I naturally bring [grandiose noun] to every [context]" \u2192 too formulaic
- "I am someone who carries/radiates/embodies [abstract quality]" \u2192 too stiff
- Stacking multiple abstract nouns: "clarity, purpose, and determination" \u2192 pick ONE and make it specific
- "It is in my nature to..." \u2192 sounds robotic, rephrase conversationally
- Any phrase that could appear on a motivational poster or Instagram caption \u2192 rewrite intimately`
        },
        {
          role: "user",
          content: script
        }
      ],
      temperature: 0.8,
      max_tokens: 600
    });
    const humanized = response.choices[0]?.message?.content?.trim();
    if (!humanized) return script;
    let result = humanized.replace(/^\*\*.*?\*\*\s*/gm, "").replace(/^#+\s*.*?\n/gm, "").replace(/^\d+\.\s*/gm, "").replace(/^["']/gm, "").replace(/["']$/gm, "").replace(/^\s*\n/gm, "").trim();
    const humanizedSentences = result.match(/[^.!?]+[.!?]+/g) || [];
    if (humanizedSentences.length > sentenceCount) {
      result = humanizedSentences.slice(0, sentenceCount).join(" ").trim();
    }
    return result;
  } catch (error) {
    console.error("Humanizer pass failed, using original script:", error);
    return script;
  }
}
async function autoGenerateTitle(script) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a title generator for personalized affirmations. Create a short, inspiring title (3-6 words) that captures the core theme of the affirmation.

CRITICAL RULES:
- Be specific and vivid \u2014 reflect the unique theme, not generic motivation
- Use fresh, varied language \u2014 never default to the same patterns
- Do NOT include quotation marks
- NEVER start the title with any word from the banned list below

BANNED WORDS (NEVER use these in titles):
Embrace, Unlock, Harness, Ignite, Unleash, Empower, Elevate, Manifest, Radiate, Cultivate, Transcend, Awaken, Thrive, Navigate, Journey, Transform, Limitless, Boundless, Infinite, Unstoppable, Abundant, Sacred, Divine, Vibrant, Magnetic, Unleashing, Embracing, Unlocking, Harnessing, Igniting

GOOD TITLE EXAMPLES:
- Steady Mind, Open Heart
- Strength in Every Step
- Rest That Restores
- Roots of Real Confidence
- Sleep Like Still Water
- Bright Focus, Clear Path
- Calm in the Storm
- My Voice, My Power
- Growing Stronger Each Day
- Peaceful and Present

BAD TITLE EXAMPLES (REJECTED \u2014 uses banned words):
- Embrace Your Inner Power
- Unlock Your True Potential
- Radiate Boundless Energy
- Manifest Infinite Abundance
- Embracing Growth and Confidence
- Embrace the Abundance Within

Respond with ONLY the title, nothing else.`
        },
        {
          role: "user",
          content: script
        }
      ],
      temperature: 0.9,
      max_tokens: 30
    });
    let title = response.choices[0]?.message?.content?.trim() || "My Affirmation";
    title = title.replace(/^["']|["']$/g, "");
    return title;
  } catch (error) {
    console.error("Auto-title generation failed:", error);
    return "My Affirmation";
  }
}
async function autoGenerateDescription(script, goal) {
  try {
    const userContext = goal ? `
USER'S ORIGINAL GOAL: "${goal}"
Use this goal to ground the description in what the user actually wants to achieve.` : "";
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You write short, clear descriptions for affirmation cards in a mindfulness app. Write one sentence (8-15 words) that explains what this affirmation is about \u2014 its purpose and theme.

RULES:
- Be clear and grounded \u2014 describe what the affirmation helps with, not how it makes you feel
- Start with "For" or a clear action-oriented phrase
- No quotation marks, no period at the end
- Do NOT repeat the affirmation title
- Avoid flowery or overly poetic language

BANNED OPENING WORDS (NEVER start with these):
Fosters, Cultivates, Nurtures, Promotes, Encourages, Supports, Enhances, Develops, Strengthens, Builds, Empowers, Inspires

GOOD EXAMPLES:
- For building confidence in public speaking and presentations
- For letting go of perfectionism and embracing progress
- For staying calm and grounded during stressful moments
- For deepening self-trust when making big life decisions
- For improving sleep by quieting a busy mind
- For finding motivation to stay consistent with your goals
- For healing from past experiences and moving forward
- For embracing change with courage and openness
${userContext}
Respond with ONLY the description, nothing else.`
        },
        { role: "user", content: script }
      ],
      temperature: 0.7,
      max_tokens: 40
    });
    return response.choices[0]?.message?.content?.trim().replace(/['"]/g, "").replace(/\.$/, "") || "";
  } catch (error) {
    console.error("Error generating description:", error);
    return "";
  }
}
async function autoCategoriz\u0435(text2) {
  const validCategories = ["Career", "Health", "Confidence", "Wealth", "Relationships", "Sleep"];
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a categorization assistant. Analyze the given text and categorize it into exactly one of these categories: ${validCategories.join(", ")}. 
Respond with ONLY the category name, nothing else.`
        },
        {
          role: "user",
          content: text2
        }
      ],
      temperature: 0.3,
      max_tokens: 20
    });
    const category = response.choices[0]?.message?.content?.trim() || "Confidence";
    if (validCategories.includes(category)) {
      return category;
    }
    const lowerCategory = category.toLowerCase();
    for (const valid of validCategories) {
      if (valid.toLowerCase().includes(lowerCategory) || lowerCategory.includes(valid.toLowerCase())) {
        return valid;
      }
    }
    return "Confidence";
  } catch (error) {
    console.error("Auto-categorization failed:", error);
    return "Confidence";
  }
}
var directOpenAI2 = process.env.OPENAI_API_KEY ? new OpenAI3({ apiKey: process.env.OPENAI_API_KEY }) : null;
var HUME_TO_OPENAI_VOICE_MAP = {
  "hume_seraphina": "nova",
  "hume_lotus": "shimmer",
  "hume_amber": "alloy",
  "hume_nova": "nova",
  "hume_willow": "shimmer",
  "hume_orion": "onyx",
  "hume_atlas": "echo",
  "hume_sage": "fable",
  "hume_summit": "onyx",
  "hume_bodhi": "echo"
};
var HUME_VOICE_ID_MAP = {
  "hume_seraphina": "Serene Assistant",
  "hume_lotus": "Female Meditation Guide",
  "hume_amber": "Warm American Female",
  "hume_nova": "Warm Female Assistant Voice",
  "hume_willow": "Demure Conversationalist",
  "hume_orion": "Inspiring Man",
  "hume_atlas": "Deep Male Conversational Voice",
  "hume_sage": "Soft Male Conversationalist",
  "hume_summit": "Nature Documentary Narrator",
  "hume_bodhi": "Wise Wizard"
};
function getHumeVoiceNameForId(voiceId) {
  if (!voiceId) return null;
  return HUME_VOICE_ID_MAP[voiceId] || null;
}
function isHumeVoice(voiceId) {
  return !!voiceId && voiceId.startsWith("hume_");
}
function getOpenAIFallbackVoice(voiceId) {
  if (!voiceId) return "nova";
  const mapped = HUME_TO_OPENAI_VOICE_MAP[voiceId];
  return mapped || "nova";
}
async function generateAudioOpenAI(script, voice = "nova") {
  if (!directOpenAI2) {
    throw new Error("TTS_UNAVAILABLE: No OpenAI API key configured");
  }
  const response = await directOpenAI2.audio.speech.create({
    model: "tts-1",
    voice,
    input: script
  });
  const audioBuffer = await response.arrayBuffer();
  const words = script.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const estimatedDuration = Math.ceil(wordCount / 150 * 60);
  const avgWordDurationMs = estimatedDuration * 1e3 / wordCount;
  const wordTimings = words.map((word, index) => ({
    word,
    startMs: Math.round(index * avgWordDurationMs),
    endMs: Math.round((index + 1) * avgWordDurationMs)
  }));
  return {
    audio: audioBuffer,
    duration: estimatedDuration,
    wordTimings
  };
}
async function generateAudioSimpleOpenAI(text2, voice = "nova") {
  if (!directOpenAI2) {
    throw new Error("TTS_UNAVAILABLE: No OpenAI API key configured");
  }
  const response = await directOpenAI2.audio.speech.create({
    model: "tts-1",
    voice,
    input: text2
  });
  return await response.arrayBuffer();
}
function resolvePersonalVoiceId(ttsProvider, voiceId, elevenLabsVoiceId, cartesiaVoiceId) {
  if (elevenLabsVoiceId) return elevenLabsVoiceId;
  return voiceId || void 0;
}
async function generateAudioSimple(text2, voiceId, isPersonalVoice = false, ttsProvider) {
  if (isPersonalVoice) {
    try {
      const client = await getElevenLabsClient();
      const audio = await client.textToSpeech.convert(voiceId, {
        text: text2,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      });
      const chunks = [];
      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).buffer;
    } catch (error) {
      const errMsg = error?.message || String(error);
      const isQuota = errMsg.includes("quota_exceeded") || errMsg.includes("Unauthorized");
      const isVoiceNotFound = errMsg.includes("voice_not_found") || errMsg.includes("Not Found") || String(error).includes("voice_not_found");
      if (isQuota) {
        throw new Error("QUOTA_EXCEEDED: Your voice cloning credits have been used up for this period. Please switch to an AI voice or wait for your credits to reset.");
      }
      if (isVoiceNotFound) {
        throw new Error("VOICE_EXPIRED: Your voice clone has expired or is no longer available. Please re-record your voice sample.");
      }
      throw new Error("PERSONAL_VOICE_FAILED: Could not generate audio with your Inner Voice. Please try again or re-record your voice.");
    }
  }
  const humeName = getHumeVoiceNameForId(voiceId);
  if (humeName) {
    try {
      return await humeSimpleTTS(text2, humeName);
    } catch (humeError) {
      console.error("Hume AI simple TTS failed, trying OpenAI fallback:", humeError?.message || humeError);
    }
  }
  if (directOpenAI2) {
    try {
      const openaiVoice = getOpenAIFallbackVoice(voiceId);
      return await generateAudioSimpleOpenAI(text2, openaiVoice);
    } catch (openaiError) {
      console.error("OpenAI simple TTS fallback also failed:", openaiError?.message || openaiError);
    }
  }
  throw new Error("TTS_UNAVAILABLE: All TTS services are unavailable");
}
async function generateAudio(script, voiceId, isPersonalVoice = false, moodConfig, ttsProvider, isMeditation = false) {
  if (isPersonalVoice) {
    const personalVoiceSettings = isMeditation ? { stability: 0.7, style: 0.25, pauseSeconds: 2.5 } : { stability: 0.78, style: 0.15, pauseSeconds: 2 };
    try {
      const result = await textToSpeech(script, voiceId, personalVoiceSettings);
      return result;
    } catch (elevenLabsError) {
      const isQuotaExhausted = elevenLabsError?.message?.includes("quota_exceeded") || elevenLabsError?.message?.includes("Unauthorized") || String(elevenLabsError).includes("quota_exceeded");
      const isVoiceNotFound = elevenLabsError?.message?.includes("voice_not_found") || elevenLabsError?.message?.includes("Not Found") || String(elevenLabsError).includes("voice_not_found");
      console.error(
        `ElevenLabs TTS failed for PERSONAL voice (${voiceId})${isQuotaExhausted ? " (quota exhausted)" : ""}${isVoiceNotFound ? " (voice not found)" : ""}:`,
        elevenLabsError?.message || elevenLabsError
      );
      if (isQuotaExhausted) {
        throw new Error("QUOTA_EXCEEDED: Your voice cloning credits have been used up for this period. Please switch to an AI voice or wait for your credits to reset.");
      }
      if (isVoiceNotFound) {
        throw new Error("VOICE_EXPIRED: Your voice clone has expired or is no longer available. Please re-record your voice sample.");
      }
      throw new Error("PERSONAL_VOICE_FAILED: Could not generate audio with your Inner Voice. Please try again or re-record your voice.");
    }
  }
  const humeName = getHumeVoiceNameForId(voiceId);
  if (humeName) {
    try {
      const result = await humeTextToSpeech(script, humeName, moodConfig?.humeSpeed, moodConfig?.pauseSeconds);
      return result;
    } catch (humeError) {
      console.error("Hume AI TTS failed, trying OpenAI fallback:", humeError?.message || humeError);
    }
  }
  if (directOpenAI2) {
    try {
      const openaiVoice = getOpenAIFallbackVoice(voiceId);
      return await generateAudioOpenAI(script, openaiVoice);
    } catch (openaiError) {
      console.error("OpenAI TTS fallback also failed:", openaiError?.message || openaiError);
    }
  }
  throw new Error("TTS_UNAVAILABLE: All TTS services (Hume AI, OpenAI) are unavailable");
}
async function registerRoutes(app2) {
  setupAuth(app2);
  app2.options("/uploads/audio/:filename", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Accept-Encoding");
    res.status(204).end();
  });
  app2.get("/uploads/audio/:filename", async (req, res) => {
    try {
      const rawFilename = req.params.filename;
      const filename = path3.basename(rawFilename);
      if (!/^(affirmation|voice)[-\w]+\.(mp3|m4a|wav|webm)$/.test(filename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }
      const audioDir = path3.join(uploadDir, "audio");
      const filePath = path3.join(audioDir, filename);
      const resolvedPath = path3.resolve(filePath);
      const resolvedUploadDir = path3.resolve(uploadDir);
      if (!resolvedPath.startsWith(resolvedUploadDir + path3.sep)) {
        console.log(JSON.stringify({ level: "WARN", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "security", message: `Path traversal attempt blocked: ${rawFilename}` }));
        return res.status(403).json({ error: "Access denied" });
      }
      if (!fs3.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Accept-Encoding");
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
      res.setHeader("Accept-Ranges", "bytes");
      const ext = path3.extname(filename).toLowerCase();
      const contentTypes = {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".webm": "audio/webm"
      };
      if (contentTypes[ext]) {
        res.setHeader("Content-Type", contentTypes[ext]);
      }
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });
  app2.get("/api/categories", async (req, res) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });
  app2.get("/api/affirmations", requireAuth, async (req, res) => {
    try {
      const allAffirmations = await db.select().from(affirmations).where(eq8(affirmations.userId, req.userId)).orderBy(asc(affirmations.displayOrder), desc3(affirmations.createdAt));
      res.json(allAffirmations);
    } catch (error) {
      console.error("Error fetching affirmations:", error);
      res.status(500).json({ error: "Failed to fetch affirmations" });
    }
  });
  app2.get("/api/affirmations/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const [affirmation] = await db.select().from(affirmations).where(and6(
        eq8(affirmations.id, parseInt(id)),
        eq8(affirmations.userId, req.userId)
      ));
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      res.json(affirmation);
    } catch (error) {
      console.error("Error fetching affirmation:", error);
      res.status(500).json({ error: "Failed to fetch affirmation" });
    }
  });
  app2.post("/api/moderate-content", requireAuth, async (req, res) => {
    try {
      const { text: text2 } = req.body;
      if (!text2 || typeof text2 !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }
      const result = await moderateContent(text2);
      res.json(result);
    } catch (error) {
      console.error("Moderation check error:", error);
      res.json({ flagged: false, categories: [], message: "" });
    }
  });
  app2.post("/api/affirmations/generate-script", requireAuth, aiGenerationLimiter, async (req, res) => {
    try {
      const { goal, pillar, categories: categories2, category, length } = req.body;
      if (!goal) {
        return res.status(400).json({ error: "Goal is required" });
      }
      const goalModResult = await validateAffirmationContent(goal);
      if (goalModResult.flagged) {
        return res.status(422).json({
          error: "content_flagged",
          message: goalModResult.message,
          categories: goalModResult.categories
        });
      }
      const isAdmin = ADMIN_USER_IDS.has(req.userId);
      const limits = await checkAndResetMonthlyLimits(req.userId);
      if (!isAdmin && limits.affirmationsRemaining <= 0) {
        return res.status(429).json({
          error: `Monthly AI affirmation limit reached. Maximum ${MAX_AI_AFFIRMATIONS_PER_MONTH} AI-generated affirmations per month.`,
          limit: MAX_AI_AFFIRMATIONS_PER_MONTH,
          used: limits.affirmationsThisMonth,
          remaining: 0,
          message: "You can still create manual affirmations or wait until next month."
        });
      }
      const categoryList = categories2 || (category ? [category] : []);
      const script = await generateScript(goal, categoryList, length, pillar);
      const [title, description] = await Promise.all([
        autoGenerateTitle(script),
        autoGenerateDescription(script, goal)
      ]);
      await db.update(users).set({
        affirmationsThisMonth: limits.affirmationsThisMonth + 1
      }).where(eq8(users.id, req.userId));
      res.json({
        script,
        title,
        description,
        usage: {
          used: limits.affirmationsThisMonth + 1,
          remaining: limits.affirmationsRemaining - 1,
          limit: MAX_AI_AFFIRMATIONS_PER_MONTH
        }
      });
    } catch (error) {
      console.error("Error generating script:", error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });
  app2.post("/api/affirmations/create-with-voice", requireAuth, ttsLimiter, async (req, res) => {
    try {
      const { title, script, pillar, categories: categories2, category, isManual, forceAiVoice, description } = req.body;
      if (!script) {
        return res.status(400).json({ error: "Script is required" });
      }
      const textsToCheck = [script, title].filter(Boolean);
      if (categories2 && Array.isArray(categories2)) {
        textsToCheck.push(...categories2);
      }
      const modResult = await validateAffirmationContent(textsToCheck.join(" "));
      if (modResult.flagged) {
        return res.status(422).json({
          error: "content_flagged",
          message: modResult.message,
          categories: modResult.categories
        });
      }
      let finalDescription = description || null;
      if (!finalDescription && script) {
        try {
          finalDescription = await autoGenerateDescription(script);
        } catch (e) {
          console.error("Failed to auto-generate description:", e);
        }
      }
      let categoryName = null;
      if (categories2 && Array.isArray(categories2) && categories2.length > 0) {
        categoryName = categories2.join(",");
      } else if (category) {
        categoryName = category;
      }
      const [userWithPrefs] = await db.select({
        voiceId: users.voiceId,
        hasVoiceSample: users.hasVoiceSample,
        preferredVoiceType: users.preferredVoiceType,
        preferredAiGender: users.preferredAiGender,
        preferredMaleVoiceId: users.preferredMaleVoiceId,
        preferredFemaleVoiceId: users.preferredFemaleVoiceId,
        ttsProvider: users.ttsProvider,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId
      }).from(users).where(eq8(users.id, req.userId));
      let voiceIdToUse;
      let usedPersonalVoice = false;
      let usedGender = userWithPrefs?.preferredAiGender || "female";
      if (!forceAiVoice && userWithPrefs?.preferredVoiceType === "personal" && userWithPrefs?.hasVoiceSample) {
        voiceIdToUse = resolvePersonalVoiceId(userWithPrefs.ttsProvider, userWithPrefs.voiceId, userWithPrefs.elevenLabsVoiceId, userWithPrefs.cartesiaVoiceId);
        usedPersonalVoice = true;
      } else {
        if (usedGender === "male") {
          voiceIdToUse = userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id;
        } else {
          voiceIdToUse = userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
        }
      }
      let audioResult;
      try {
        audioResult = await generateAudio(
          script,
          voiceIdToUse,
          usedPersonalVoice,
          getPillarVoiceConfig(pillar),
          userWithPrefs?.ttsProvider || void 0
        );
      } catch (genError) {
        if (usedPersonalVoice && genError?.message?.includes("QUOTA_EXCEEDED")) {
          const fallbackGender = usedGender || "female";
          const fallbackVoiceId = fallbackGender === "male" ? userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id : userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
          usedPersonalVoice = false;
          voiceIdToUse = fallbackVoiceId;
          audioResult = await generateAudio(script, fallbackVoiceId, false, getPillarVoiceConfig(pillar));
        } else if (usedPersonalVoice && (genError?.message?.includes("PERSONAL_VOICE_FAILED") || genError?.message?.includes("VOICE_EXPIRED"))) {
          const fallbackGender = usedGender || "female";
          const fallbackVoiceId = fallbackGender === "male" ? userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id : userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
          usedPersonalVoice = false;
          voiceIdToUse = fallbackVoiceId;
          audioResult = await generateAudio(script, fallbackVoiceId, false, getPillarVoiceConfig(pillar));
        } else {
          throw genError;
        }
      }
      if (usedPersonalVoice) {
        await db.update(users).set({ voiceLastUsedAt: /* @__PURE__ */ new Date() }).where(eq8(users.id, req.userId));
      }
      const audioDir = path3.join(uploadDir, "audio");
      if (!fs3.existsSync(audioDir)) {
        fs3.mkdirSync(audioDir, { recursive: true });
      }
      const audioFilename = `affirmation-${Date.now()}.mp3`;
      const audioPath = path3.join(audioDir, audioFilename);
      fs3.writeFileSync(audioPath, Buffer.from(audioResult.audio));
      const [newAffirmation] = await db.insert(affirmations).values({
        userId: req.userId,
        title: title || "My Affirmation",
        script,
        pillar: pillar || null,
        categoryName: categoryName || null,
        description: finalDescription || null,
        audioUrl: `/uploads/audio/${audioFilename}`,
        duration: audioResult.duration,
        wordTimings: JSON.stringify(audioResult.wordTimings),
        isManual: isManual || false,
        voiceType: usedPersonalVoice ? "personal" : "ai",
        voiceGender: usedPersonalVoice ? null : usedGender,
        aiVoiceId: usedPersonalVoice ? null : voiceIdToUse
      }).returning();
      res.json(newAffirmation);
    } catch (error) {
      console.error("Error creating affirmation:", error);
      if (error?.message?.includes("QUOTA_EXCEEDED")) {
        res.status(429).json({ error: "QUOTA_EXCEEDED", message: "Your voice credits have been used up for this period. The affirmation will be created with an AI voice instead." });
      } else if (error?.message?.includes("PERSONAL_VOICE_FAILED")) {
        res.status(422).json({ error: "PERSONAL_VOICE_FAILED", message: "Could not generate audio with your Inner Voice. You can try again or switch to an AI voice." });
      } else if (error?.message?.includes("TTS_UNAVAILABLE")) {
        res.status(503).json({ error: "Voice services are temporarily unavailable. Please try again later." });
      } else {
        res.status(500).json({ error: "Failed to create affirmation. Please try again." });
      }
    }
  });
  app2.delete("/api/affirmations/:id", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const [affirmation] = await db.select().from(affirmations).where(and6(
        eq8(affirmations.id, parseInt(id)),
        eq8(affirmations.userId, req.userId)
      ));
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      if (affirmation.audioUrl) {
        const filename = path3.basename(affirmation.audioUrl);
        if (/^(affirmation|voice)-\d+(-\d+)?\.(mp3|m4a|wav|webm)$/.test(filename)) {
          const audioPath = path3.join(uploadDir, filename);
          const resolvedPath = path3.resolve(audioPath);
          const resolvedUploadDir = path3.resolve(uploadDir);
          if (resolvedPath.startsWith(resolvedUploadDir + path3.sep) && fs3.existsSync(audioPath)) {
            fs3.unlinkSync(audioPath);
            console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "security", message: `SECURE DELETE: Removed audio file ${filename}` }));
          }
        } else {
          console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "security", message: `SECURITY: Skipped deletion of invalid filename pattern: ${affirmation.audioUrl}` }));
        }
      }
      await db.delete(affirmations).where(eq8(affirmations.id, parseInt(id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting affirmation:", error);
      res.status(500).json({ error: "Failed to delete affirmation" });
    }
  });
  app2.patch("/api/affirmations/:id/favorite", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const { isFavorite } = req.body;
      const [updated] = await db.update(affirmations).set({ isFavorite, updatedAt: /* @__PURE__ */ new Date() }).where(and6(
        eq8(affirmations.id, parseInt(id)),
        eq8(affirmations.userId, req.userId)
      )).returning();
      if (!updated) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating favorite:", error);
      res.status(500).json({ error: "Failed to update favorite" });
    }
  });
  app2.patch("/api/affirmations/:id/rename", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const { title } = req.body;
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }
      const [updated] = await db.update(affirmations).set({ title: title.trim(), updatedAt: /* @__PURE__ */ new Date() }).where(and6(
        eq8(affirmations.id, parseInt(id)),
        eq8(affirmations.userId, req.userId)
      )).returning();
      if (!updated) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error renaming affirmation:", error);
      res.status(500).json({ error: "Failed to rename affirmation" });
    }
  });
  app2.post("/api/affirmations/:id/auto-save", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const [affirmation] = await db.select().from(affirmations).where(and6(
        eq8(affirmations.id, parseInt(id)),
        eq8(affirmations.userId, req.userId)
      ));
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      const script = affirmation.script || affirmation.title || "";
      const autoSaveModResult = await moderateContent(script);
      if (autoSaveModResult.flagged) {
        return res.status(422).json({
          error: "content_flagged",
          message: autoSaveModResult.message,
          categories: autoSaveModResult.categories
        });
      }
      const hasCategory = affirmation.categoryName;
      const [generatedTitle, generatedDescription, newCategoryName] = await Promise.all([
        autoGenerateTitle(script),
        autoGenerateDescription(script),
        hasCategory ? Promise.resolve(null) : autoCategoriz\u0435(script)
      ]);
      const [updated] = await db.update(affirmations).set({
        title: generatedTitle,
        description: generatedDescription || void 0,
        ...hasCategory ? {} : { categoryName: newCategoryName },
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq8(affirmations.id, parseInt(id))).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error auto-saving affirmation:", error);
      res.status(500).json({ error: "Failed to auto-save affirmation" });
    }
  });
  app2.post("/api/affirmations/backfill-descriptions", requireAuth, async (req, res) => {
    try {
      const userAffirmations = await db.select({ id: affirmations.id, script: affirmations.script }).from(affirmations).where(and6(
        eq8(affirmations.userId, req.userId),
        isNull(affirmations.description)
      ));
      if (userAffirmations.length === 0) {
        return res.json({ updated: 0, message: "All affirmations already have descriptions" });
      }
      let updated = 0;
      for (const aff of userAffirmations) {
        try {
          const description = await autoGenerateDescription(aff.script);
          if (description) {
            await db.update(affirmations).set({ description, updatedAt: /* @__PURE__ */ new Date() }).where(eq8(affirmations.id, aff.id));
            updated++;
          }
        } catch (e) {
          console.error(`Failed to generate description for affirmation ${aff.id}:`, e);
        }
      }
      res.json({ updated, total: userAffirmations.length });
    } catch (error) {
      console.error("Error backfilling descriptions:", error);
      res.status(500).json({ error: "Failed to backfill descriptions" });
    }
  });
  app2.post("/api/affirmations/:id/play", requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const { durationSeconds } = req.body || {};
      const [affirmation] = await db.select().from(affirmations).where(and6(
        eq8(affirmations.id, parseInt(id)),
        eq8(affirmations.userId, req.userId)
      ));
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      const [updated] = await db.update(affirmations).set({
        playCount: (affirmation.playCount || 0) + 1,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq8(affirmations.id, parseInt(id))).returning();
      const now = /* @__PURE__ */ new Date();
      const dateKey = now.toISOString().split("T")[0];
      await db.insert(listeningSessions).values({
        userId: req.userId,
        affirmationId: parseInt(id),
        durationSeconds: durationSeconds || Math.round((affirmation.duration || 0) / 1e3),
        dateKey
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating play count:", error);
      res.status(500).json({ error: "Failed to update play count" });
    }
  });
  const MAX_VOICE_CLONES = 5;
  app2.post(
    "/api/voice-samples",
    requireAuth,
    voiceCloneLimiter,
    audioUpload.single("audio"),
    async (req, res) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No audio file provided" });
        }
        const [user] = await db.select({ voiceClonesUsed: users.voiceClonesUsed, hasConsentedToVoiceCloning: users.hasConsentedToVoiceCloning, ttsProvider: users.ttsProvider }).from(users).where(eq8(users.id, req.userId)).limit(1);
        if (!user) {
          fs3.unlink(file.path, () => {
          });
          return res.status(404).json({ error: "User not found" });
        }
        if (!user.hasConsentedToVoiceCloning) {
          fs3.unlink(file.path, () => {
          });
          return res.status(403).json({ error: "Voice cloning consent required. Please accept the voice cloning terms first." });
        }
        const clonesUsed = user.voiceClonesUsed || 0;
        if (clonesUsed >= MAX_VOICE_CLONES) {
          fs3.unlink(file.path, () => {
          });
          return res.status(429).json({
            error: `Voice clone limit reached. Maximum ${MAX_VOICE_CLONES} voice clones allowed.`,
            limit: MAX_VOICE_CLONES,
            used: clonesUsed
          });
        }
        const [sample] = await db.insert(voiceSamples).values({
          userId: req.userId,
          audioUrl: "processing",
          // Don't store actual path for privacy
          status: "processing"
        }).returning();
        try {
          let voiceId;
          const providerVoiceUpdate = {
            hasVoiceSample: true,
            preferredVoiceType: "personal",
            voiceClonesUsed: clonesUsed + 1
          };
          voiceId = await cloneVoice(file.path, "My Affirmation Voice");
          providerVoiceUpdate.elevenLabsVoiceId = voiceId;
          providerVoiceUpdate.voiceId = voiceId;
          fs3.unlink(file.path, (err) => {
            if (err) console.error("Failed to delete voice sample file:", err);
            else console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceClone", message: `Voice sample file deleted for privacy: ${file.filename}` }));
          });
          const [updatedSample] = await db.update(voiceSamples).set({ voiceId, status: "ready", audioUrl: null }).where(eq8(voiceSamples.id, sample.id)).returning();
          await db.update(users).set(providerVoiceUpdate).where(eq8(users.id, req.userId));
          res.json({
            ...updatedSample,
            clonesRemaining: MAX_VOICE_CLONES - (clonesUsed + 1)
          });
        } catch (cloneError) {
          console.error("Voice cloning error:", cloneError);
          fs3.unlink(file.path, () => {
          });
          await db.update(voiceSamples).set({ status: "failed", audioUrl: null }).where(eq8(voiceSamples.id, sample.id));
          const errorDetail = cloneError?.elevenLabsDetail || cloneError?.message || "";
          const statusCode = cloneError?.statusCode || 500;
          let userMessage = "Voice cloning failed. Please try again.";
          if (errorDetail.toLowerCase().includes("maximum") || errorDetail.toLowerCase().includes("custom voices") || errorDetail.toLowerCase().includes("voice limit")) {
            console.warn("[Voice Slots] ElevenLabs quota hit. Attempting queue-based slot recovery...");
            try {
              const slotResult = await freeVoiceSlotForNewClone(req.userId);
              if (slotResult.freed) {
                console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceSlots", message: `[Voice Slots] Freed slot (rotated user=${slotResult.rotatedUserId}). Retrying clone...` }));
                const retryVoiceId = await cloneVoice(file.path, "My Affirmation Voice");
                fs3.unlink(file.path, () => {
                });
                const [retryUpdatedSample] = await db.update(voiceSamples).set({ voiceId: retryVoiceId, status: "ready", audioUrl: null }).where(eq8(voiceSamples.id, sample.id)).returning();
                await db.update(users).set({
                  voiceId: retryVoiceId,
                  hasVoiceSample: true,
                  preferredVoiceType: "personal",
                  voiceClonesUsed: clonesUsed + 1
                }).where(eq8(users.id, req.userId));
                return res.json({
                  ...retryUpdatedSample,
                  clonesRemaining: MAX_VOICE_CLONES - (clonesUsed + 1)
                });
              }
            } catch (retryError) {
              console.error("[Voice Slots] Retry after slot recovery failed:", retryError?.message);
            }
            userMessage = "Voice cloning is temporarily unavailable. Please try again in a few minutes.";
          } else if (statusCode === 401 || statusCode === 403) {
            userMessage = "Voice cloning service is temporarily unavailable. Please try again later.";
          } else if (statusCode === 429) {
            userMessage = "Voice cloning service is busy. Please wait a few minutes and try again.";
          } else if (errorDetail.toLowerCase().includes("too short") || errorDetail.toLowerCase().includes("duration")) {
            const minDuration = "20";
            userMessage = `Your recording was too short. Please record at least ${minDuration} seconds of clear speech.`;
          } else if (errorDetail.toLowerCase().includes("audio") || errorDetail.toLowerCase().includes("format") || errorDetail.toLowerCase().includes("processed")) {
            userMessage = "There was a problem with the audio format. Please try recording again.";
          } else {
            userMessage = "Voice cloning failed. Please try again later.";
          }
          res.status(statusCode === 429 ? 429 : 500).json({ error: userMessage });
        }
      } catch (error) {
        console.error("Error uploading voice sample:", error);
        res.status(500).json({ error: "Failed to upload voice sample" });
      }
    }
  );
  app2.get("/api/voice-samples/status", requireAuth, async (req, res) => {
    try {
      const [sample] = await db.select().from(voiceSamples).where(eq8(voiceSamples.userId, req.userId)).orderBy(desc3(voiceSamples.createdAt)).limit(1);
      const [user] = await db.select({ voiceId: users.voiceId }).from(users).where(eq8(users.id, req.userId)).limit(1);
      const hasClonedVoice = !!(sample?.status === "ready" && sample?.voiceId) || !!user?.voiceId;
      res.json({
        hasVoiceSample: !!sample && sample.status === "ready",
        hasClonedVoice,
        hasPersonalVoice: hasClonedVoice,
        status: sample?.status || null
      });
    } catch (error) {
      console.error("Error fetching voice sample status:", error);
      res.status(500).json({ error: "Failed to fetch voice sample status" });
    }
  });
  const VOICE_OPTIONS = {
    female: [
      { id: "hume_lotus", name: "Lotus", description: "Peaceful, guiding presence", provider: "HUME_AI", humeName: "Female Meditation Guide" },
      { id: "hume_seraphina", name: "Seraphina", description: "Tranquil, radiant calm", provider: "HUME_AI", humeName: "Serene Assistant" },
      { id: "hume_amber", name: "Amber", description: "Warm, grounding energy", provider: "HUME_AI", humeName: "Warm American Female" },
      { id: "hume_nova", name: "Nova", description: "Gentle, luminous clarity", provider: "HUME_AI", humeName: "Warm Female Assistant Voice" },
      { id: "hume_willow", name: "Willow", description: "Soft, graceful wisdom", provider: "HUME_AI", humeName: "Demure Conversationalist" }
    ],
    male: [
      { id: "hume_orion", name: "Orion", description: "Bold, uplifting strength", provider: "HUME_AI", humeName: "Inspiring Man" },
      { id: "hume_atlas", name: "Atlas", description: "Deep, grounded resonance", provider: "HUME_AI", humeName: "Deep Male Conversational Voice" },
      { id: "hume_sage", name: "Sage", description: "Calm, centering stillness", provider: "HUME_AI", humeName: "Soft Male Conversationalist" },
      { id: "hume_summit", name: "Summit", description: "Steady, expansive clarity", provider: "HUME_AI", humeName: "Nature Documentary Narrator" },
      { id: "hume_bodhi", name: "Bodhi", description: "Ancient, soulful wisdom", provider: "HUME_AI", humeName: "Wise Wizard" }
    ]
  };
  app2.get("/api/voices", async (req, res) => {
    res.json(VOICE_OPTIONS);
  });
  const PREVIEW_PHRASE = "I am strong, capable, and worthy of success.";
  app2.post("/api/voices/preview", async (req, res) => {
    try {
      const { voiceId } = req.body;
      if (!voiceId) {
        return res.status(400).json({ error: "Voice ID is required" });
      }
      const allVoices = [...VOICE_OPTIONS.female, ...VOICE_OPTIONS.male];
      const validVoice = allVoices.find((v) => v.id === voiceId);
      if (!validVoice) {
        return res.status(400).json({ error: "Invalid voice ID" });
      }
      const audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, voiceId);
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({
        audio: base64Audio,
        voiceName: validVoice.name
      });
    } catch (error) {
      console.error("Error generating voice preview:", error?.message || error);
      res.status(500).json({ error: "Failed to generate voice preview. Please try again." });
    }
  });
  app2.post("/api/voices/preview-personal", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select({
        voiceId: users.voiceId,
        hasVoiceSample: users.hasVoiceSample,
        name: users.name,
        ttsProvider: users.ttsProvider,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId
      }).from(users).where(eq8(users.id, req.userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const resolvedVoiceId = resolvePersonalVoiceId(user.ttsProvider, user.voiceId, user.elevenLabsVoiceId, user.cartesiaVoiceId);
      if (!resolvedVoiceId || !user.hasVoiceSample) {
        return res.status(400).json({ error: "No Inner Voice recorded. Please record your voice first." });
      }
      let audioBuffer;
      try {
        audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, resolvedVoiceId, true);
      } catch (ttsError) {
        const msg = ttsError?.message || "";
        if (msg.includes("PERSONAL_VOICE_FAILED") || msg.includes("voice_not_found") || msg.includes("404")) {
          return res.status(422).json({
            error: "VOICE_EXPIRED",
            message: "Your voice clone may have expired. Please re-record your voice to continue using Inner Voice features."
          });
        }
        throw ttsError;
      }
      await db.update(users).set({ voiceLastUsedAt: /* @__PURE__ */ new Date() }).where(eq8(users.id, req.userId));
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({
        audio: base64Audio,
        voiceName: "Inner Voice"
      });
    } catch (error) {
      console.error("Error generating Inner Voice preview:", error);
      res.status(500).json({ error: "Failed to generate Inner Voice preview. Please try again." });
    }
  });
  app2.post("/api/tts/compare", requireAuth, async (req, res) => {
    return res.status(410).json({ error: "TTS comparison is temporarily disabled" });
  });
  app2.get("/api/voice-preferences", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select({
        preferredVoiceType: users.preferredVoiceType,
        preferredAiGender: users.preferredAiGender,
        preferredMaleVoiceId: users.preferredMaleVoiceId,
        preferredFemaleVoiceId: users.preferredFemaleVoiceId,
        hasVoiceSample: users.hasVoiceSample,
        voiceId: users.voiceId,
        ttsProvider: users.ttsProvider,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId
      }).from(users).where(eq8(users.id, req.userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        preferredVoiceType: user.preferredVoiceType || "ai",
        preferredAiGender: user.preferredAiGender || "female",
        preferredMaleVoiceId: user.preferredMaleVoiceId || "hume_orion",
        preferredFemaleVoiceId: user.preferredFemaleVoiceId || "hume_lotus",
        hasPersonalVoice: !!user.hasVoiceSample && !!(user.elevenLabsVoiceId || user.cartesiaVoiceId || user.voiceId),
        ttsProvider: "elevenlabs",
        hasElevenLabsVoice: !!user.elevenLabsVoiceId,
        hasCartesiaVoice: false
      });
    } catch (error) {
      console.error("Error fetching voice preferences:", error);
      res.status(500).json({ error: "Failed to fetch voice preferences" });
    }
  });
  app2.put("/api/voice-preferences", requireAuth, async (req, res) => {
    try {
      const { preferredVoiceType, preferredAiGender, preferredMaleVoiceId, preferredFemaleVoiceId, ttsProvider } = req.body;
      const updates = {};
      if (preferredVoiceType && ["personal", "ai"].includes(preferredVoiceType)) {
        updates.preferredVoiceType = preferredVoiceType;
      }
      if (preferredAiGender && ["male", "female"].includes(preferredAiGender)) {
        updates.preferredAiGender = preferredAiGender;
      }
      if (preferredMaleVoiceId) {
        const validMaleVoice = VOICE_OPTIONS.male.find((v) => v.id === preferredMaleVoiceId);
        if (validMaleVoice) {
          updates.preferredMaleVoiceId = preferredMaleVoiceId;
        }
      }
      if (preferredFemaleVoiceId) {
        const validFemaleVoice = VOICE_OPTIONS.female.find((v) => v.id === preferredFemaleVoiceId);
        if (validFemaleVoice) {
          updates.preferredFemaleVoiceId = preferredFemaleVoiceId;
        }
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid preferences provided" });
      }
      await db.update(users).set(updates).where(eq8(users.id, req.userId));
      res.json({ success: true, ...updates });
    } catch (error) {
      console.error("Error updating voice preferences:", error);
      res.status(500).json({ error: "Failed to update voice preferences" });
    }
  });
  app2.post("/api/affirmations/:id/regenerate-voice", requireAuth, async (req, res) => {
    try {
      const affirmationId = parseInt(req.params.id, 10);
      const { voiceType, voiceGender } = req.body;
      if (!voiceType || !["personal", "ai"].includes(voiceType)) {
        return res.status(400).json({ error: "Invalid voice type. Must be 'personal' or 'ai'" });
      }
      if (voiceType === "ai" && voiceGender && !["male", "female"].includes(voiceGender)) {
        return res.status(400).json({ error: "Invalid voice gender. Must be 'male' or 'female'" });
      }
      const [affirmation] = await db.select().from(affirmations).where(and6(eq8(affirmations.id, affirmationId), eq8(affirmations.userId, req.userId)));
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      const [userTtsInfo] = await db.select({ ttsProvider: users.ttsProvider }).from(users).where(eq8(users.id, req.userId));
      let voiceIdToUse;
      if (voiceType === "personal") {
        const [user] = await db.select({ voiceId: users.voiceId, hasVoiceSample: users.hasVoiceSample, elevenLabsVoiceId: users.elevenLabsVoiceId, cartesiaVoiceId: users.cartesiaVoiceId, ttsProvider: users.ttsProvider }).from(users).where(eq8(users.id, req.userId));
        const resolvedVoiceId = resolvePersonalVoiceId(user?.ttsProvider, user?.voiceId, user?.elevenLabsVoiceId, user?.cartesiaVoiceId);
        if (!resolvedVoiceId || !user?.hasVoiceSample) {
          return res.status(400).json({
            error: "VOICE_ROTATED",
            message: "Your personal voice has expired. Please re-record your voice sample to continue using your Inner Voice, or switch to an AI voice."
          });
        }
        voiceIdToUse = resolvedVoiceId;
      } else {
        const gender = voiceGender || "female";
        const [userPrefs] = await db.select({
          preferredMaleVoiceId: users.preferredMaleVoiceId,
          preferredFemaleVoiceId: users.preferredFemaleVoiceId
        }).from(users).where(eq8(users.id, req.userId));
        if (gender === "male") {
          voiceIdToUse = userPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id;
        } else {
          voiceIdToUse = userPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
        }
      }
      const isPersonalVoice = voiceType === "personal";
      const audioResult = await generateAudio(affirmation.script, voiceIdToUse, isPersonalVoice, getPillarVoiceConfig(affirmation.pillar));
      if (isPersonalVoice) {
        await db.update(users).set({ voiceLastUsedAt: /* @__PURE__ */ new Date() }).where(eq8(users.id, req.userId));
      }
      const audioDir = path3.join(process.cwd(), "uploads", "audio");
      if (!fs3.existsSync(audioDir)) {
        fs3.mkdirSync(audioDir, { recursive: true });
      }
      const audioFileName = `affirmation-${affirmationId}-${Date.now()}.mp3`;
      const audioPath = path3.join(audioDir, audioFileName);
      fs3.writeFileSync(audioPath, Buffer.from(audioResult.audio));
      const audioUrl = `/uploads/audio/${audioFileName}`;
      await db.update(affirmations).set({
        audioUrl,
        duration: audioResult.duration,
        wordTimings: JSON.stringify(audioResult.wordTimings),
        voiceType,
        voiceGender: voiceType === "ai" ? voiceGender || "female" : null,
        aiVoiceId: voiceType === "ai" ? voiceIdToUse : null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq8(affirmations.id, affirmationId));
      const [updated] = await db.select().from(affirmations).where(eq8(affirmations.id, affirmationId));
      res.json(updated);
    } catch (error) {
      console.error("Error regenerating voice:", error);
      const errorMsg = error?.message || "";
      if (errorMsg.includes("QUOTA_EXCEEDED")) {
        return res.status(422).json({
          error: "QUOTA_EXCEEDED",
          message: "Your voice cloning credits have been used up for this period. Please switch to an AI voice or wait for your credits to reset."
        });
      }
      if (errorMsg.includes("PERSONAL_VOICE_FAILED")) {
        return res.status(422).json({
          error: "PERSONAL_VOICE_FAILED",
          message: "Could not generate audio with your Inner Voice. Please try again or switch to an AI voice."
        });
      }
      res.status(500).json({ error: "Failed to regenerate voice" });
    }
  });
  app2.get("/api/custom-categories", requireAuth, async (req, res) => {
    try {
      const userCustomCategories = await db.select().from(customCategories).where(eq8(customCategories.userId, req.userId)).orderBy(asc(customCategories.createdAt));
      res.json(userCustomCategories);
    } catch (error) {
      console.error("Error fetching custom categories:", error);
      res.status(500).json({ error: "Failed to fetch custom categories" });
    }
  });
  app2.post("/api/custom-categories", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Category name is required" });
      }
      const trimmedName = name.trim();
      if (trimmedName.length > 30) {
        return res.status(400).json({ error: "Category name must be 30 characters or less" });
      }
      const existingCategories = await db.select().from(customCategories).where(eq8(customCategories.userId, req.userId));
      if (existingCategories.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 custom categories allowed" });
      }
      const duplicateName = existingCategories.find(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        return res.status(400).json({ error: "A category with this name already exists" });
      }
      const defaultCategories = await db.select().from(categories);
      const duplicateDefault = defaultCategories.find(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateDefault) {
        return res.status(400).json({ error: "This category already exists as a default category" });
      }
      const [newCategory] = await db.insert(customCategories).values({
        userId: req.userId,
        name: trimmedName
      }).returning();
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating custom category:", error);
      res.status(500).json({ error: "Failed to create custom category" });
    }
  });
  app2.delete("/api/custom-categories/:id", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
      const [category] = await db.select().from(customCategories).where(and6(
        eq8(customCategories.id, categoryId),
        eq8(customCategories.userId, req.userId)
      ));
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      await db.delete(customCategories).where(eq8(customCategories.id, categoryId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom category:", error);
      res.status(500).json({ error: "Failed to delete custom category" });
    }
  });
  app2.get("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const allAffirmations = await db.select().from(affirmations).where(eq8(affirmations.userId, req.userId));
      const totalListens = allAffirmations.reduce(
        (sum2, a) => sum2 + (a.playCount || 0),
        0
      );
      const sessions = await db.select().from(listeningSessions).where(eq8(listeningSessions.userId, req.userId)).orderBy(desc3(listeningSessions.completedAt));
      const uniqueDates = [...new Set(sessions.map((s) => s.dateKey))].sort().reverse();
      let streak = 0;
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 864e5).toISOString().split("T")[0];
      if (uniqueDates.length > 0 && (uniqueDates[0] === today || uniqueDates[0] === yesterday)) {
        streak = 1;
        let checkDate = new Date(uniqueDates[0]);
        for (let i = 1; i < uniqueDates.length; i++) {
          const prevDay = new Date(checkDate.getTime() - 864e5).toISOString().split("T")[0];
          if (uniqueDates[i] === prevDay) {
            streak++;
            checkDate = new Date(uniqueDates[i]);
          } else {
            break;
          }
        }
      }
      let bestStreak = 0;
      if (uniqueDates.length > 0) {
        let currentRun = 1;
        const sortedDates = [...uniqueDates].sort();
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 864e5);
          if (diffDays === 1) {
            currentRun++;
          } else {
            bestStreak = Math.max(bestStreak, currentRun);
            currentRun = 1;
          }
        }
        bestStreak = Math.max(bestStreak, currentRun);
      }
      const weeklyData = [];
      const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 864e5);
        const dateKey = date.toISOString().split("T")[0];
        const dayName = dayNames[date.getDay()];
        const daySessions = sessions.filter((s) => s.dateKey === dateKey);
        const totalSeconds = daySessions.reduce((sum2, s) => sum2 + (s.durationSeconds || 0), 0);
        weeklyData.push({
          day: dayName,
          minutes: Math.round(totalSeconds / 60),
          date: dateKey
        });
      }
      const totalMinutesThisWeek = weeklyData.reduce((sum2, d) => sum2 + d.minutes, 0);
      const todaySessions = sessions.filter((s) => s.dateKey === today);
      const minutesToday = Math.round(todaySessions.reduce((sum2, s) => sum2 + (s.durationSeconds || 0), 0) / 60);
      const lifetimeMinutes = Math.round(sessions.reduce((sum2, s) => sum2 + (s.durationSeconds || 0), 0) / 60);
      const categoryBreakdown = [];
      const categoryMap = /* @__PURE__ */ new Map();
      for (const aff of allAffirmations) {
        const cat = aff.categoryName || "Uncategorized";
        const existing = categoryMap.get(cat) || { listens: 0, minutes: 0 };
        existing.listens += aff.playCount || 0;
        existing.minutes += Math.round((aff.duration || 0) / 1e3 / 60 * (aff.playCount || 0));
        categoryMap.set(cat, existing);
      }
      categoryMap.forEach((value, key) => {
        categoryBreakdown.push({ category: key, ...value });
      });
      categoryBreakdown.sort((a, b) => b.listens - a.listens);
      const breathingSessionsData = await db.select().from(breathingSessions).where(eq8(breathingSessions.userId, req.userId)).orderBy(desc3(breathingSessions.completedAt));
      const breathingUniqueDates = [...new Set(breathingSessionsData.map((s) => s.dateKey))].sort().reverse();
      let breathingStreak = 0;
      if (breathingUniqueDates.length > 0 && (breathingUniqueDates[0] === today || breathingUniqueDates[0] === yesterday)) {
        breathingStreak = 1;
        let checkDate = new Date(breathingUniqueDates[0]);
        for (let i = 1; i < breathingUniqueDates.length; i++) {
          const prevDay = new Date(checkDate.getTime() - 864e5).toISOString().split("T")[0];
          if (breathingUniqueDates[i] === prevDay) {
            breathingStreak++;
            checkDate = new Date(breathingUniqueDates[i]);
          } else {
            break;
          }
        }
      }
      let bestBreathingStreak = 0;
      if (breathingUniqueDates.length > 0) {
        let currentRun = 1;
        const sortedBreathingDates = [...breathingUniqueDates].sort();
        for (let i = 1; i < sortedBreathingDates.length; i++) {
          const prevDate = new Date(sortedBreathingDates[i - 1]);
          const currDate = new Date(sortedBreathingDates[i]);
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 864e5);
          if (diffDays === 1) {
            currentRun++;
          } else {
            bestBreathingStreak = Math.max(bestBreathingStreak, currentRun);
            currentRun = 1;
          }
        }
        bestBreathingStreak = Math.max(bestBreathingStreak, currentRun);
      }
      const breathingWeeklyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 864e5);
        const dateKey = date.toISOString().split("T")[0];
        const dayName = dayNames[date.getDay()];
        const daySessions = breathingSessionsData.filter((s) => s.dateKey === dateKey);
        const totalSeconds = daySessions.reduce((sum2, s) => sum2 + (s.durationSeconds || 0), 0);
        breathingWeeklyData.push({
          day: dayName,
          minutes: Math.round(totalSeconds / 60),
          date: dateKey
        });
      }
      const breathingMinutesThisWeek = breathingWeeklyData.reduce((sum2, d) => sum2 + d.minutes, 0);
      const todayBreathingSessions = breathingSessionsData.filter((s) => s.dateKey === today);
      const breathingMinutesToday = Math.round(todayBreathingSessions.reduce((sum2, s) => sum2 + (s.durationSeconds || 0), 0) / 60);
      const lifetimeBreathingMinutes = Math.round(breathingSessionsData.reduce((sum2, s) => sum2 + (s.durationSeconds || 0), 0) / 60);
      const totalMindfulMinutesToday = minutesToday + breathingMinutesToday;
      const totalMindfulMinutesWeek = totalMinutesThisWeek + breathingMinutesThisWeek;
      const totalMindfulMinutesLifetime = lifetimeMinutes + lifetimeBreathingMinutes;
      const techniqueBreakdown = [];
      const techniqueMap = /* @__PURE__ */ new Map();
      for (const session2 of breathingSessionsData) {
        const tech = session2.techniqueId || "unknown";
        const existing = techniqueMap.get(tech) || { sessions: 0, minutes: 0 };
        existing.sessions += 1;
        existing.minutes += Math.round(session2.durationSeconds / 60);
        techniqueMap.set(tech, existing);
      }
      techniqueMap.forEach((value, key) => {
        techniqueBreakdown.push({ technique: key, ...value });
      });
      techniqueBreakdown.sort((a, b) => b.sessions - a.sessions);
      res.json({
        totalListens,
        streak,
        bestStreak,
        affirmationsCount: allAffirmations.length,
        weeklyData,
        totalMinutesThisWeek,
        minutesToday,
        lifetimeMinutes,
        categoryBreakdown,
        totalDaysActive: uniqueDates.length,
        // Meditation/Breathing KPIs
        meditation: {
          streak: breathingStreak,
          bestStreak: bestBreathingStreak,
          minutesToday: breathingMinutesToday,
          minutesThisWeek: breathingMinutesThisWeek,
          lifetimeMinutes: lifetimeBreathingMinutes,
          totalSessions: breathingSessionsData.length,
          daysActive: breathingUniqueDates.length,
          weeklyData: breathingWeeklyData,
          techniqueBreakdown
        },
        // Combined mindful stats
        mindfulMinutes: {
          today: totalMindfulMinutesToday,
          thisWeek: totalMindfulMinutesWeek,
          lifetime: totalMindfulMinutesLifetime
        }
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });
  app2.get("/api/categories", async (req, res) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });
  app2.post("/api/affirmations/samples", requireAuth, async (req, res) => {
    try {
      const existingAffirmations = await db.select().from(affirmations).where(eq8(affirmations.userId, req.userId)).limit(1);
      if (existingAffirmations.length > 0) {
        return res.json({ message: "User already has affirmations", created: 0 });
      }
      const sampleAffirmations = [
        {
          title: "Calm Mind",
          pillar: "Mind",
          categoryName: "Focus,Resilience",
          script: "My mind is still and clear. In this moment of quiet, I find my center. I breathe deeply and let every thought settle like water becoming glass. I choose calm over chaos."
        },
        {
          title: "Body at Rest",
          pillar: "Body",
          categoryName: "Health,Sleep",
          script: "I honor my body by giving it rest. With every slow breath, tension melts from my shoulders, my jaw, my hands. I feel my heartbeat steady and strong. My body knows how to heal when I create space for stillness. Tonight, I will sleep deeply and wake restored."
        },
        {
          title: "Grateful Spirit",
          pillar: "Spirit",
          categoryName: "Gratitude,Joy",
          script: "I am grateful for this quiet moment. Gratitude fills me like warm sunlight. I appreciate the small blessings that surround me today. In stillness, I discover that everything I need is already within me."
        },
        {
          title: "Present with Others",
          pillar: "Connection",
          categoryName: "Love,Self-Compassion",
          script: "I am fully present when I am with the people I love. I listen with patience and speak with kindness. By nurturing my own inner peace through meditation, I bring a calmer, more compassionate version of myself to every conversation. I attract meaningful connections because I first connect deeply with myself. The love I cultivate in stillness radiates outward and touches everyone around me."
        },
        {
          title: "Focused Achievement",
          pillar: "Achievement",
          categoryName: "Career,Drive",
          script: "I accomplish my goals with steady focus. Each morning I take a moment to breathe, set my intention, and move forward with clarity. Success flows naturally when my mind is calm."
        },
        {
          title: "Peaceful Home",
          pillar: "Home",
          categoryName: "Family,Comfort",
          script: "My home is a sanctuary of peace and warmth. I create calm in my living space by first cultivating calm within myself. When I pause to breathe and center my thoughts, that serenity flows into every room. My family feels safe and loved because I choose presence over distraction. I tend to my home with the same gentle attention I give to my meditation practice. Order, beauty, and tranquility are not things I chase. They are things I create, one mindful moment at a time. My home reflects the peace I carry inside."
        }
      ];
      const voiceRotation = [
        { id: "hume_lotus", gender: "female" },
        { id: "hume_orion", gender: "male" },
        { id: "hume_amber", gender: "female" },
        { id: "hume_sage", gender: "male" },
        { id: "hume_nova", gender: "female" },
        { id: "hume_atlas", gender: "male" }
      ];
      const createdAffirmations = [];
      const audioDir = path3.join(uploadDir, "audio");
      if (!fs3.existsSync(audioDir)) {
        fs3.mkdirSync(audioDir, { recursive: true });
      }
      for (let idx = 0; idx < sampleAffirmations.length; idx++) {
        const sample = sampleAffirmations[idx];
        const voice = voiceRotation[idx % voiceRotation.length];
        try {
          const audioResult = await generateAudio(sample.script, voice.id);
          const audioFilename = `affirmation-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
          const audioPath = path3.join(audioDir, audioFilename);
          fs3.writeFileSync(audioPath, Buffer.from(audioResult.audio));
          const [newAffirmation] = await db.insert(affirmations).values({
            userId: req.userId,
            title: sample.title,
            script: sample.script,
            pillar: sample.pillar,
            categoryName: sample.categoryName,
            audioUrl: `/uploads/audio/${audioFilename}`,
            duration: audioResult.duration,
            wordTimings: JSON.stringify(audioResult.wordTimings),
            isManual: false,
            voiceType: "ai",
            voiceGender: voice.gender,
            aiVoiceId: voice.id
          }).returning();
          createdAffirmations.push(newAffirmation);
        } catch (error) {
          console.error(`Error creating sample affirmation "${sample.title}":`, error);
        }
      }
      res.json({
        message: "Sample affirmations created",
        created: createdAffirmations.length,
        affirmations: createdAffirmations
      });
    } catch (error) {
      console.error("Error creating sample affirmations:", error);
      res.status(500).json({ error: "Failed to create sample affirmations" });
    }
  });
  app2.put("/api/affirmations/reorder", requireAuth, async (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!orderedIds || !Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds array is required" });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(affirmations).set({ displayOrder: i }).where(and6(
          eq8(affirmations.id, orderedIds[i]),
          eq8(affirmations.userId, req.userId)
        ));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering affirmations:", error);
      res.status(500).json({ error: "Failed to reorder affirmations" });
    }
  });
  app2.post("/api/categories/init", async (req, res) => {
    try {
      const defaultCategories = [
        { name: "Career", icon: "briefcase", color: "#4A90E2" },
        { name: "Health", icon: "heart", color: "#50E3C2" },
        { name: "Confidence", icon: "star", color: "#7B61FF" },
        { name: "Wealth", icon: "dollar-sign", color: "#F5A623" },
        { name: "Relationships", icon: "users", color: "#E91E63" },
        { name: "Sleep", icon: "moon", color: "#9C27B0" }
      ];
      for (const cat of defaultCategories) {
        await db.insert(categories).values(cat).onConflictDoNothing();
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error initializing categories:", error);
      res.status(500).json({ error: "Failed to initialize categories" });
    }
  });
  app2.put("/api/user/name", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      const trimmedName = name.trim().substring(0, 50);
      await db.update(users).set({ name: trimmedName }).where(eq8(users.id, req.userId));
      res.json({ success: true, name: trimmedName });
    } catch (error) {
      console.error("Error updating name:", error);
      res.status(500).json({ error: "Failed to update name" });
    }
  });
  app2.post("/api/affirmations/clear-all", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const deletedAffirmations = await db.delete(affirmations).where(eq8(affirmations.userId, userId)).returning();
      res.json({
        success: true,
        deletedCount: deletedAffirmations.length
      });
    } catch (error) {
      console.error("Error clearing affirmations:", error);
      res.status(500).json({ error: "Failed to clear affirmations" });
    }
  });
  app2.post("/api/user/reset", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const deletedAffirmations = await db.delete(affirmations).where(eq8(affirmations.userId, userId)).returning();
      const deletedSamples = await db.delete(voiceSamples).where(eq8(voiceSamples.userId, userId)).returning();
      await db.update(users).set({
        hasVoiceSample: false,
        voiceId: null
      }).where(eq8(users.id, userId));
      res.json({
        success: true,
        deletedAffirmations: deletedAffirmations.length,
        deletedVoiceSamples: deletedSamples.length
      });
    } catch (error) {
      console.error("Error resetting user data:", error);
      res.status(500).json({ error: "Failed to reset user data" });
    }
  });
  app2.post("/api/user/account/delete", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      await db.delete(affirmations).where(eq8(affirmations.userId, userId));
      await db.delete(voiceSamples).where(eq8(voiceSamples.userId, userId));
      await db.delete(collections).where(eq8(collections.userId, userId));
      await db.delete(users).where(eq8(users.id, userId));
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });
  app2.get("/api/notifications/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const [settings] = await db.select().from(notificationSettings).where(eq8(notificationSettings.userId, userId)).limit(1);
      if (!settings) {
        return res.json({
          morningEnabled: false,
          morningTime: "08:00",
          afternoonEnabled: false,
          afternoonTime: "13:00",
          eveningEnabled: false,
          eveningTime: "20:00"
        });
      }
      res.json({
        morningEnabled: settings.morningEnabled,
        morningTime: settings.morningTime,
        afternoonEnabled: settings.afternoonEnabled,
        afternoonTime: settings.afternoonTime,
        eveningEnabled: settings.eveningEnabled,
        eveningTime: settings.eveningTime
      });
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });
  app2.put("/api/notifications/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const {
        morningEnabled,
        morningTime,
        afternoonEnabled,
        afternoonTime,
        eveningEnabled,
        eveningTime
      } = req.body;
      const [existing] = await db.select().from(notificationSettings).where(eq8(notificationSettings.userId, userId)).limit(1);
      if (existing) {
        const [updated] = await db.update(notificationSettings).set({
          morningEnabled: morningEnabled ?? existing.morningEnabled,
          morningTime: morningTime ?? existing.morningTime,
          afternoonEnabled: afternoonEnabled ?? existing.afternoonEnabled,
          afternoonTime: afternoonTime ?? existing.afternoonTime,
          eveningEnabled: eveningEnabled ?? existing.eveningEnabled,
          eveningTime: eveningTime ?? existing.eveningTime,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq8(notificationSettings.userId, userId)).returning();
        return res.json({
          morningEnabled: updated.morningEnabled,
          morningTime: updated.morningTime,
          afternoonEnabled: updated.afternoonEnabled,
          afternoonTime: updated.afternoonTime,
          eveningEnabled: updated.eveningEnabled,
          eveningTime: updated.eveningTime
        });
      } else {
        const [created] = await db.insert(notificationSettings).values({
          userId,
          morningEnabled: morningEnabled ?? false,
          morningTime: morningTime ?? "08:00",
          afternoonEnabled: afternoonEnabled ?? false,
          afternoonTime: afternoonTime ?? "13:00",
          eveningEnabled: eveningEnabled ?? false,
          eveningTime: eveningTime ?? "20:00"
        }).returning();
        return res.json({
          morningEnabled: created.morningEnabled,
          morningTime: created.morningTime,
          afternoonEnabled: created.afternoonEnabled,
          afternoonTime: created.afternoonTime,
          eveningEnabled: created.eveningEnabled,
          eveningTime: created.eveningTime
        });
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ error: "Failed to update notification settings" });
    }
  });
  app2.post("/api/push-token", requireAuth, async (req, res) => {
    try {
      const { token, platform } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Push token is required" });
      }
      const existing = await db.select().from(pushTokens).where(eq8(pushTokens.token, token)).limit(1);
      if (existing.length > 0) {
        await db.update(pushTokens).set({ userId: req.userId, platform: platform || "unknown", updatedAt: /* @__PURE__ */ new Date() }).where(eq8(pushTokens.token, token));
      } else {
        await db.insert(pushTokens).values({ userId: req.userId, token, platform: platform || "unknown" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error registering push token:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });
  app2.post("/api/voice/keep-active", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select({ voiceId: users.voiceId, hasVoiceSample: users.hasVoiceSample }).from(users).where(eq8(users.id, req.userId));
      if (!user?.voiceId || !user?.hasVoiceSample) {
        return res.status(400).json({ error: "No active voice clone found" });
      }
      await db.update(users).set({ voiceLastUsedAt: /* @__PURE__ */ new Date(), voiceExpiryWarningAt: null }).where(eq8(users.id, req.userId));
      res.json({ success: true, message: "Voice clone marked as active" });
    } catch (error) {
      console.error("Error keeping voice active:", error);
      res.status(500).json({ error: "Failed to update voice status" });
    }
  });
  app2.post("/api/mood-prompt", requireAuth, async (req, res) => {
    try {
      const { currentMood, timeOfDay } = req.body;
      if (!currentMood || !timeOfDay) {
        return res.status(400).json({ error: "currentMood and timeOfDay are required" });
      }
      const userId = req.userId;
      const userData = await db.select({ name: users.name }).from(users).where(eq8(users.id, userId)).limit(1);
      const userName = userData[0]?.name?.split(" ")[0] || "Friend";
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are the voice of Retuned, a personal wellness app. The user just told you they feel "${currentMood}" and it's ${timeOfDay}. Generate a compassionate, creative title and subtitle for the next screen where they'll choose where they want to be emotionally.

Respond as JSON:
{
  "title": "A short, warm 3-6 word title that acknowledges their ${currentMood} feeling and hints at transformation. Use ${userName}'s name sometimes but not always. Examples for stressed: 'Let's lighten that load, ${userName}', 'You deserve some ease'. Examples for tired: 'Rest is calling you', 'Time to recharge, ${userName}'. Examples for anxious: 'Let's find your ground'. Examples for sad: 'Sunshine is on its way'. Examples for overwhelmed: 'One breath at a time'. Examples for calm: 'Beautiful \u2014 let's build on this'. Never use emojis.",
  "subtitle": "A short 5-10 word sentence about choosing their destination mood. Creative and warm, not clinical. Examples: 'Pick the feeling you want to carry', 'Where shall we take you?', 'Choose the version of you that's waiting'. Never use emojis."
}

Rules:
- Be specific to the ${currentMood} mood, not generic
- Sound like a wise, warm friend
- Vary language dramatically each time
- No exclamation marks, no emojis
- Keep it concise and punchy`
            },
            {
              role: "user",
              content: `I'm feeling ${currentMood} right now. It's ${timeOfDay}.`
            }
          ],
          temperature: 0.95,
          max_tokens: 100,
          response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        res.json({
          title: parsed.title || "Where would you like to be?",
          subtitle: parsed.subtitle || "Choose your destination"
        });
      } catch (aiError) {
        res.json({
          title: "Where would you like to be?",
          subtitle: "Choose your destination"
        });
      }
    } catch (error) {
      console.error("Error generating mood prompt:", error);
      res.status(500).json({ error: "Failed to generate prompt" });
    }
  });
  app2.post("/api/mood-checkin", requireAuth, async (req, res) => {
    try {
      const { mood, targetMood, timeOfDay } = req.body;
      if (!mood || !targetMood || !timeOfDay) {
        return res.status(400).json({ error: "mood, targetMood, and timeOfDay are required" });
      }
      const validStartingMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed", "wired", "frustrated", "scattered", "good"];
      const validTargetMoods = ["calm", "energized", "grateful", "confident", "focused", "joyful", "determined", "grounded", "lit_up"];
      const validTimes = ["morning", "afternoon", "evening", "night"];
      if (!validStartingMoods.includes(mood)) {
        return res.status(400).json({ error: "Invalid mood value" });
      }
      if (!validTargetMoods.includes(targetMood)) {
        return res.status(400).json({ error: "Invalid targetMood value" });
      }
      if (!validTimes.includes(timeOfDay)) {
        return res.status(400).json({ error: "Invalid timeOfDay value" });
      }
      const userId = req.userId;
      const [userData, userAffirmationsList, latestVoiceSample] = await Promise.all([
        db.select({ name: users.name, voiceId: users.voiceId, preferredVoiceType: users.preferredVoiceType }).from(users).where(eq8(users.id, userId)).limit(1),
        db.select({
          id: affirmations.id,
          title: affirmations.title,
          description: affirmations.description,
          pillar: affirmations.pillar,
          categoryName: affirmations.categoryName,
          voiceType: affirmations.voiceType,
          audioUrl: affirmations.audioUrl,
          playCount: affirmations.playCount,
          isFavorite: affirmations.isFavorite
        }).from(affirmations).where(eq8(affirmations.userId, userId)),
        db.select({ status: voiceSamples.status, voiceId: voiceSamples.voiceId }).from(voiceSamples).where(eq8(voiceSamples.userId, userId)).orderBy(desc3(voiceSamples.createdAt)).limit(1)
      ]);
      const user = userData[0];
      const userName = user?.name?.split(" ")[0] || "Friend";
      const hasClonedVoice = !!(latestVoiceSample[0]?.status === "ready" && latestVoiceSample[0]?.voiceId) || !!user?.voiceId;
      const hasAffirmations = userAffirmationsList.length > 0;
      const hasAffirmationsWithAudio = userAffirmationsList.filter((a) => a.audioUrl).length > 0;
      const userPreferredVoiceType = user?.preferredVoiceType || "ai";
      const resolvedVibeId = resolveVibeFromMoodPair(mood, targetMood);
      const resolvedVibe = getVibeConfig(resolvedVibeId);
      const vibeRouting = routeVibe(resolvedVibeId);
      let matchedAffirmation = null;
      let matchReason = null;
      if (vibeRouting) {
        const result = pickBestAffirmation(userAffirmationsList, vibeRouting.matching, userPreferredVoiceType);
        if (result) {
          matchedAffirmation = result.affirmation;
          matchReason = result.matchReason;
        }
      } else {
        const withAudio = userAffirmationsList.filter((a) => a.audioUrl);
        if (withAudio.length > 0) {
          matchedAffirmation = withAudio[Math.floor(Math.random() * withAudio.length)];
          matchReason = "any";
        }
      }
      const suggestedCreationTheme = !matchedAffirmation ? getSuggestedCreationTheme(resolvedVibeId, timeOfDay) : null;
      const breathing = vibeRouting ? { name: vibeRouting.breathingTechniqueName, id: vibeRouting.breathingTechniqueId } : { name: "Box Breathing", id: "box" };
      let listenContext = "";
      if (matchedAffirmation) {
        const isInnerVoice = matchedAffirmation.voiceType === "personal";
        const matchQuality = matchReason === "tag" ? "closely matches their mood and time of day" : matchReason === "pillar" ? "aligns with their current emotional needs" : "is available to listen to";
        const descriptionContext = matchedAffirmation.description ? ` This affirmation is "${matchedAffirmation.description}".` : "";
        listenContext = `The user has an affirmation called "${matchedAffirmation.title}"${isInnerVoice ? " recorded in their own cloned voice (Inner Voice)" : ""} that ${matchQuality}.${descriptionContext} It is ${timeOfDay} \u2014 tailor your note accordingly.`;
      } else if (hasAffirmations) {
        listenContext = `The user has affirmations but none with audio yet. It is ${timeOfDay} \u2014 suggest bringing one to life.`;
      } else {
        listenContext = `The user hasn't created any affirmations yet. Suggest creating one about ${suggestedCreationTheme}.`;
      }
      const voiceContext = hasClonedVoice ? "The user has set up their Inner Voice (personal cloned voice)." : "The user hasn't set up their Inner Voice yet \u2014 hearing affirmations in your own voice deepens subconscious impact.";
      let journeyHistoryContext = "";
      try {
        const [journeyTotal, lastJourney, frequentPath] = await Promise.all([
          db.select({ total: sql7`count(*)::int` }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).then((r) => r[0]),
          db.select().from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).orderBy(desc3(journeyCompletions.completedAt)).limit(1).then((r) => r[0]),
          db.select({
            currentMood: journeyCompletions.currentMood,
            targetMood: journeyCompletions.targetMood,
            count: sql7`count(*)::int`
          }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).groupBy(journeyCompletions.currentMood, journeyCompletions.targetMood).orderBy(sql7`count(*) desc`).limit(1).then((r) => r[0])
        ]);
        const totalJourneys = journeyTotal?.total || 0;
        if (totalJourneys > 0) {
          const parts = [`${totalJourneys} mood journey(s) completed`];
          if (lastJourney) {
            parts.push(`last journey was ${lastJourney.currentMood}\u2192${lastJourney.targetMood}`);
            if (lastJourney.completedFully) parts.push("(completed fully)");
          }
          if (frequentPath) {
            parts.push(`most common path: ${frequentPath.currentMood}\u2192${frequentPath.targetMood} (${frequentPath.count} times)`);
          }
          journeyHistoryContext = `
Journey history: ${parts.join(", ")}.`;
          if (lastJourney?.currentMood === mood && lastJourney?.targetMood === targetMood) {
            journeyHistoryContext += " Note: this is the SAME mood path as their last journey \u2014 acknowledge the pattern subtly.";
          }
        }
      } catch (e) {
      }
      let journeyTitle = "Your Journey";
      let acknowledgment = `${userName}, let's take you from ${mood} to ${targetMood}.`;
      let stepTypes = ["breathe", "meditate"];
      let breatheNote = `Two minutes of ${breathing.name} can help settle your nervous system.`;
      let meditateNote = "A 2-minute guided moment to reconnect with yourself.";
      let listenNote = matchedAffirmation ? `Your affirmation "${matchedAffirmation.title}" is waiting for you.` : suggestedCreationTheme ? `Create an affirmation about ${suggestedCreationTheme}.` : "Create an affirmation that speaks to how you feel.";
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are the voice of Retuned, a personal wellness app backed by neuroscience and mindfulness traditions. The user wants to journey from feeling ${mood} to feeling ${targetMood}. Design a personalized wellness journey with 2-3 steps (minimum 2, maximum 3) from these tools: breathe, meditate, listen.

Choose steps wisely \u2014 not every journey needs all three. Consider:
- If user is already calm or good, they probably don't need breathing
- If they want energy or to feel lit up, meditation alone won't cut it
- If they're anxious, wired, or scattered, breathing should almost always be first
- If they're frustrated, breathing helps channel that energy constructively
- If they're already in a good state (good, calm), focus on amplifying rather than fixing
- Order matters: breathing first to settle the body, meditation to shift the mind, listening to reinforce

KNOWLEDGE BASE \u2014 draw from these naturally (pick 1-2 per response, never lecture):
Neuroscience: vagus nerve stimulation, amygdala downregulation, prefrontal cortex activation, parasympathetic nervous system, neuroplasticity, default mode network quieting, theta/alpha brainwave states, cortisol reduction, HRV (heart rate variability), mirror neuron activation, dopamine and serotonin pathways, polyvagal theory (ventral vagal = safe/social state)
Spirituality & mindfulness: present-moment awareness, non-attachment to emotional states, the observer self, pranayama traditions, loving-kindness practice roots, body scan origins in Vipassana, the concept of "witness consciousness," energy shifting through intention, the Buddhist concept that feelings are visitors not residents, somatic awareness, the yogic idea that breath is the bridge between body and mind

User context:
- Name: ${userName}
- Current mood: ${mood}
- Target mood: ${targetMood}
- Time: ${timeOfDay}
- Vibe: "${resolvedVibe?.label || "Reset"}" \u2014 ${vibeRouting ? getVibeJourneyPromptContext(resolvedVibeId) : ""}
- ${listenContext}
- ${voiceContext}
- Total affirmations: ${userAffirmationsList.length}
- Best breathing match for this transition: ${breathing.name}
- ${journeyHistoryContext || "First mood journey"}

Respond as JSON with exactly these fields:
{
  "journeyTitle": "A creative 2-5 word title for this journey. Should capture the mood transition. No emojis. Can reference a neuroscience or mindfulness concept when it fits naturally (e.g., 'Vagal Reset', 'Rewiring the Signal', 'Back to Center', 'Finding Ventral'). Keep it punchy.",
  "acknowledgment": "1-2 sentences, max 30 words total. Use ${userName}'s name. Validate their ${mood} state with a real insight, then pivot to ${targetMood} with confidence. Never use emojis. Never use metaphors.

VARIETY IS CRITICAL. Randomly choose ONE of these angles \u2014 and within that angle, pick a DIFFERENT mechanism each time:
A) Neuroscience angle \u2014 pick ONE mechanism you haven't used recently: amygdala hijack, cortisol flooding, prefrontal cortex going offline, sympathetic overdrive, depleted serotonin, overactive default mode network, disrupted HRV, dopamine seeking loops, adrenaline surplus, or polyvagal dorsal shutdown. DO NOT default to 'fight-or-flight' or 'vagus nerve' \u2014 those are overused.
B) Mindfulness angle \u2014 pick from: feelings as visitors, observer self, non-attachment, witness consciousness, present-moment anchoring, the space between stimulus and response, beginner's mind, radical acceptance, pranayama traditions, or the Buddhist concept of impermanence. Vary which tradition or concept you reference.
C) Body-first angle \u2014 name where ${mood} shows up physically: jaw tension, shallow breathing, chest tightness, shoulder knots, stomach churning, heavy limbs, restless hands, constricted throat, tight forehead, or numb extremities. Be specific to ${mood}, not generic.
D) Direct/confident angle \u2014 no science, just a grounded observation about what ${userName} needs right now. Vary your sentence structure \u2014 sometimes start with their name, sometimes end with it.

CRITICAL: Do NOT copy or closely paraphrase any example text. Generate completely original phrasing every time. Vary sentence structure, word choice, and rhythm.

BANNED PHRASES (never write these exact words):
- 'stuck in fight-or-flight'
- 'activate your vagus nerve'
- 'bring you back to baseline'
- 'doesn't have to stay'
- 'let's move you toward'
- 'totally doable'
- 'your brain already knows how'
- 'open the door to'
- 'studies show' / 'research suggests' / 'research shows'
- 'proven to' / 'has been proven' / 'science proves'
- 'according to' / 'experts say' / 'scientists found'
- 'can help' / 'may reduce' / any hedging language

If the user has journey history, reference it naturally with fresh phrasing each time.",
  "stepTypes": ["breathe", "meditate", "listen"],
  "breatheNote": "One punchy sentence (max 20 words) or null if breathe is not in stepTypes. Mention this is a 2-minute exercise. Pick a DIFFERENT mechanism each time from: vagus nerve stimulation, CO2 tolerance building, HRV improvement, parasympathetic activation, baroreceptor reset, diaphragm engagement, or a pranayama principle. State it as fact, not textbook. Do NOT reuse previous phrasing \u2014 generate fresh wording.",
  "meditateNote": "One punchy sentence (max 20 words) or null if meditate is not in stepTypes. Mention this is a 2-minute guided meditation. Pick a DIFFERENT mechanism each time from: default mode network quieting, theta state access, amygdala cooling, witness consciousness, present-moment anchoring, prefrontal re-engagement, or interoceptive awareness. Connect it to ${timeOfDay}. Do NOT reuse previous phrasing \u2014 generate fresh wording.",
  "listenNote": "One or two sentences (max 30 words) or null if listen is not in stepTypes. ${matchedAffirmation ? `Reference '${matchedAffirmation.title}' specifically.${matchedAffirmation.description ? ` Use the affirmation's description \u2014 "${matchedAffirmation.description}" \u2014 to explain WHY this particular affirmation is the perfect fit for the ${mood}\u2192${targetMood} transition right now. Reference neuroplasticity or subconscious reprogramming.` : ` Explain why hearing it NOW after breathing/meditation lands differently \u2014 reference neuroplasticity, subconscious receptivity, or how the brain is more open to new patterns after a nervous system reset.`}` : hasAffirmations ? `Connect one of their existing affirmations to the ${mood}\u2192${targetMood} shift. Reference how repetition rewires neural pathways or how the subconscious is most receptive after breathwork/meditation.` : `Inspire them to create their first affirmation about ${suggestedCreationTheme}${!hasClonedVoice ? " \u2014 mention how hearing your own voice activates mirror neurons differently than any other voice" : ""}. Reference neuroplasticity or subconscious programming.`}"
}

Rules for stepTypes:
- Must be an array of 2-3 strings from: "breathe", "meditate", "listen"
- Order them in the sequence the user should do them
- Be smart about which steps to include for this specific ${mood}\u2192${targetMood} transition

Rules for tone:
- Sound like a confident coach who knows the science cold \u2014 not a textbook, not a greeting card
- No metaphors, no flowery imagery, no poetic language
- State neuroscience and spiritual concepts as direct facts \u2014 never hedge with "studies show" or "research suggests"
- No "you should" \u2014 use "let's" or direct suggestions
- No exclamation marks
- Each note must teach them something specific or create genuine curiosity
- NEVER repeat the same phrasing across responses \u2014 vary structure, angle, and vocabulary dramatically
- Treat the user as intelligent \u2014 they can handle real concepts like "vagus nerve" or "amygdala" without dumbing down
- Keep language accessible \u2014 explain the science in everyday words, not academic jargon`
            },
            {
              role: "user",
              content: `I'm feeling ${mood} and I want to feel ${targetMood}. It's ${timeOfDay}.`
            }
          ],
          temperature: 0.95,
          max_tokens: 450,
          response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        if (parsed.journeyTitle) journeyTitle = parsed.journeyTitle;
        if (parsed.acknowledgment) acknowledgment = parsed.acknowledgment;
        if (Array.isArray(parsed.stepTypes) && parsed.stepTypes.length >= 2 && parsed.stepTypes.length <= 3) {
          const validStepTypes = parsed.stepTypes.filter((s) => ["breathe", "meditate", "listen"].includes(s));
          if (validStepTypes.length >= 2) {
            stepTypes = validStepTypes;
          }
        }
        if (parsed.breatheNote) breatheNote = parsed.breatheNote;
        if (parsed.meditateNote) meditateNote = parsed.meditateNote;
        if (parsed.listenNote) listenNote = parsed.listenNote;
      } catch (e) {
      }
      if (!stepTypes.includes("listen")) {
        stepTypes.push("listen");
      }
      const reordered = stepTypes.filter((s) => s !== "listen");
      reordered.push("listen");
      const steps = [];
      for (const stepType of reordered) {
        if (stepType === "breathe") {
          steps.push({
            type: "breathe",
            techniqueId: breathing.id,
            techniqueName: breathing.name,
            duration: 3,
            note: breatheNote || `${breathing.name} can help settle your nervous system.`
          });
        } else if (stepType === "meditate") {
          steps.push({
            type: "meditate",
            note: meditateNote || "A guided moment to reconnect with yourself.",
            mood: targetMood,
            timeOfDay,
            meditationStyle: vibeRouting?.meditationStyle,
            meditationFocus: vibeRouting?.meditationFocus,
            meditationTTS: vibeRouting?.meditationTTS
          });
        } else if (stepType === "listen") {
          steps.push({
            type: "listen",
            affirmationId: matchedAffirmation?.id || null,
            affirmationTitle: matchedAffirmation?.title || null,
            isInnerVoice: matchedAffirmation?.voiceType === "personal" || false,
            hasClonedVoice,
            hasAnyAffirmations: hasAffirmations,
            note: listenNote || "Create an affirmation that speaks to how you feel.",
            suggestedTheme: suggestedCreationTheme
          });
        }
      }
      for (const step of steps) {
        step.vibeId = resolvedVibeId;
      }
      res.json({
        journeyTitle,
        acknowledgment,
        currentMood: mood,
        targetMood,
        vibeId: resolvedVibeId,
        vibeLabel: resolvedVibe?.label,
        vibeAccentColor: resolvedVibe?.ui.accentColor,
        vibeIcon: resolvedVibe?.ui.icon,
        steps
      });
    } catch (error) {
      console.error("Error in mood check-in:", error);
      res.status(500).json({ error: "Failed to process mood check-in" });
    }
  });
  app2.post("/api/vibe-checkin", requireAuth, async (req, res) => {
    try {
      const { vibeId, timeOfDay } = req.body;
      if (!vibeId || !timeOfDay) {
        return res.status(400).json({ error: "vibeId and timeOfDay are required" });
      }
      if (!VIBE_LIST.includes(vibeId)) {
        return res.status(400).json({ error: "Invalid vibeId" });
      }
      const validTimes = ["morning", "afternoon", "evening", "night"];
      if (!validTimes.includes(timeOfDay)) {
        return res.status(400).json({ error: "Invalid timeOfDay" });
      }
      const routing = routeVibe(vibeId);
      if (!routing) {
        return res.status(400).json({ error: "Could not route vibe" });
      }
      const userId = req.userId;
      const { vibe, startingMood: mood, targetMood, matching } = routing;
      const [userData, userAffirmationsList, latestVoiceSample] = await Promise.all([
        db.select({ name: users.name, voiceId: users.voiceId, preferredVoiceType: users.preferredVoiceType }).from(users).where(eq8(users.id, userId)).limit(1),
        db.select({
          id: affirmations.id,
          title: affirmations.title,
          description: affirmations.description,
          pillar: affirmations.pillar,
          categoryName: affirmations.categoryName,
          voiceType: affirmations.voiceType,
          audioUrl: affirmations.audioUrl,
          playCount: affirmations.playCount,
          isFavorite: affirmations.isFavorite
        }).from(affirmations).where(eq8(affirmations.userId, userId)),
        db.select({ status: voiceSamples.status, voiceId: voiceSamples.voiceId }).from(voiceSamples).where(eq8(voiceSamples.userId, userId)).orderBy(desc3(voiceSamples.createdAt)).limit(1)
      ]);
      const user = userData[0];
      const userName = user?.name?.split(" ")[0] || "Friend";
      const hasClonedVoice = !!(latestVoiceSample[0]?.status === "ready" && latestVoiceSample[0]?.voiceId) || !!user?.voiceId;
      const hasAffirmations = userAffirmationsList.length > 0;
      const userPreferredVoiceType = user?.preferredVoiceType || "ai";
      const matchResult = pickBestAffirmation(userAffirmationsList, matching, userPreferredVoiceType);
      const matchedAffirmation = matchResult?.affirmation || null;
      const matchReason = matchResult?.matchReason || null;
      const suggestedCreationTheme = !matchedAffirmation ? getSuggestedCreationTheme(vibeId, timeOfDay) : null;
      const breathing = { name: routing.breathingTechniqueName, id: routing.breathingTechniqueId };
      let listenContext = "";
      if (matchedAffirmation) {
        const isInnerVoice = matchedAffirmation.voiceType === "personal";
        const matchQuality = matchReason === "tag" ? "closely matches their vibe" : matchReason === "pillar" ? "aligns with their current emotional needs" : "is available to listen to";
        const descriptionContext = matchedAffirmation.description ? ` This affirmation is "${matchedAffirmation.description}".` : "";
        listenContext = `The user has an affirmation called "${matchedAffirmation.title}"${isInnerVoice ? " recorded in their own cloned voice (Inner Voice)" : ""} that ${matchQuality}.${descriptionContext} It is ${timeOfDay} \u2014 tailor your note accordingly.`;
      } else if (hasAffirmations) {
        listenContext = `The user has affirmations but none with audio yet. It is ${timeOfDay} \u2014 suggest bringing one to life.`;
      } else {
        listenContext = `The user hasn't created any affirmations yet. Suggest creating one about ${suggestedCreationTheme}.`;
      }
      const voiceContext = hasClonedVoice ? "The user has set up their Inner Voice (personal cloned voice)." : "The user hasn't set up their Inner Voice yet \u2014 hearing affirmations in your own voice deepens subconscious impact.";
      let journeyHistoryContext = "";
      try {
        const [journeyTotal, lastJourney] = await Promise.all([
          db.select({ total: sql7`count(*)::int` }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).then((r) => r[0]),
          db.select().from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).orderBy(desc3(journeyCompletions.completedAt)).limit(1).then((r) => r[0])
        ]);
        if (journeyTotal && journeyTotal.total > 0) {
          journeyHistoryContext = `This user has completed ${journeyTotal.total} vibe sessions. ${lastJourney ? `Last session: "${lastJourney.currentMood}\u2192${lastJourney.targetMood}"${lastJourney.vibeId ? ` (${lastJourney.vibeId} vibe)` : ""}.` : ""}`;
        }
      } catch (e) {
      }
      const vibeContext = getVibeJourneyPromptContext(vibeId);
      let journeyTitle = `${vibe.label} Session`;
      let acknowledgment = `Let's ${vibe.subtitle.toLowerCase()}.`;
      let stepTypes = ["breathe", "meditate", "listen"];
      let breatheNote = null;
      let meditateNote = null;
      let listenNote = null;
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a wellness guide for the Retuned app. The user picked a "vibe" \u2014 a casual word for how they're feeling. Your job is to acknowledge their state and design a personalized micro-journey.

${vibeContext}

Vibe: "${vibe.label}" \u2014 ${vibe.description}
From: ${mood} \u2192 To: ${targetMood}

Knowledge domains to draw from:
Neuroscience: amygdala regulation, prefrontal cortex engagement, vagal tone, HRV, default mode network, cortisol/dopamine/serotonin systems, neuroplasticity, polyvagal theory, mirror neurons, interoception
Mindfulness: present-moment awareness, observer self, non-attachment, pranayama, loving-kindness, body scan, witness consciousness, somatic awareness

User context:
- Name: ${userName}
- Vibe: ${vibe.label} ("${vibe.subtitle}")
- Time: ${timeOfDay}
- ${listenContext}
- ${voiceContext}
- Total affirmations: ${userAffirmationsList.length}
- Best breathing match: ${breathing.name}
- ${journeyHistoryContext || "First vibe session"}

Respond as JSON with exactly these fields:
{
  "journeyTitle": "A creative 2-5 word title for this session. Should capture the vibe. No emojis. Can reference neuroscience or mindfulness concepts when natural. Keep it punchy.",
  "acknowledgment": "1-2 sentences, max 30 words. Use ${userName}'s name. Validate their '${vibe.label}' state with a real insight, then pivot toward ${targetMood}. Never use emojis or metaphors.

VARIETY IS CRITICAL. Randomly choose ONE angle:
A) Neuroscience \u2014 pick ONE mechanism: amygdala hijack, cortisol flooding, prefrontal cortex offline, sympathetic overdrive, depleted serotonin, overactive default mode network, disrupted HRV, dopamine loops, polyvagal dorsal shutdown
B) Mindfulness \u2014 pick from: feelings as visitors, observer self, non-attachment, witness consciousness, present-moment anchoring, beginner's mind, radical acceptance, impermanence
C) Body-first \u2014 name where this vibe shows up physically: jaw tension, shallow breathing, chest tightness, shoulder knots, restless hands, tight forehead
D) Direct/confident \u2014 no science, just a grounded observation

BANNED PHRASES: 'stuck in fight-or-flight', 'activate your vagus nerve', 'bring you back to baseline', 'studies show', 'research suggests', 'proven to', 'can help'",
  "stepTypes": ["breathe", "meditate", "listen"],
  "breatheNote": "One punchy sentence (max 20 words) or null. Mention 2-minute exercise. Pick a different mechanism each time. State as fact.",
  "meditateNote": "One punchy sentence (max 20 words) or null. Mention 2-minute guided meditation. Connect to ${timeOfDay}. Fresh wording.",
  "listenNote": "One or two sentences (max 30 words) or null. ${matchedAffirmation ? `Reference '${matchedAffirmation.title}' specifically.${matchedAffirmation.description ? ` Use "${matchedAffirmation.description}" to explain why this affirmation fits the ${vibe.label} vibe.` : ` Explain why hearing it after breathing/meditation lands differently.`}` : hasAffirmations ? `Connect one of their affirmations to the ${vibe.label} vibe.` : `Inspire creating a first affirmation about ${suggestedCreationTheme}${!hasClonedVoice ? " \u2014 mention Inner Voice" : ""}.`}"
}

Rules for stepTypes:
- Array of 2-3 strings from: "breathe", "meditate", "listen"
- Order them in the best sequence for this vibe
- Be smart about which steps to include

Rules for tone:
- Sound like a confident coach who knows the science \u2014 not a textbook, not a greeting card
- No metaphors, no flowery imagery
- State concepts as direct facts \u2014 never hedge
- No "you should" \u2014 use "let's" or direct suggestions
- No exclamation marks
- NEVER repeat the same phrasing across responses`
            },
            {
              role: "user",
              content: `I'm vibing "${vibe.label}" right now. It's ${timeOfDay}.`
            }
          ],
          temperature: 0.95,
          max_tokens: 450,
          response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        if (parsed.journeyTitle) journeyTitle = parsed.journeyTitle;
        if (parsed.acknowledgment) acknowledgment = parsed.acknowledgment;
        if (Array.isArray(parsed.stepTypes) && parsed.stepTypes.length >= 2 && parsed.stepTypes.length <= 3) {
          const validStepTypes = parsed.stepTypes.filter((s) => ["breathe", "meditate", "listen"].includes(s));
          if (validStepTypes.length >= 2) {
            stepTypes = validStepTypes;
          }
        }
        if (parsed.breatheNote) breatheNote = parsed.breatheNote;
        if (parsed.meditateNote) meditateNote = parsed.meditateNote;
        if (parsed.listenNote) listenNote = parsed.listenNote;
      } catch (e) {
      }
      if (!stepTypes.includes("listen")) {
        stepTypes.push("listen");
      }
      const reordered = stepTypes.filter((s) => s !== "listen");
      reordered.push("listen");
      const steps = [];
      for (const stepType of reordered) {
        if (stepType === "breathe") {
          steps.push({
            type: "breathe",
            techniqueId: breathing.id,
            techniqueName: breathing.name,
            duration: 3,
            note: breatheNote || `${breathing.name} can help settle your nervous system.`
          });
        } else if (stepType === "meditate") {
          steps.push({
            type: "meditate",
            note: meditateNote || "A guided moment to reconnect with yourself.",
            mood: targetMood,
            timeOfDay,
            vibeId
          });
        } else if (stepType === "listen") {
          steps.push({
            type: "listen",
            affirmationId: matchedAffirmation?.id || null,
            affirmationTitle: matchedAffirmation?.title || null,
            isInnerVoice: matchedAffirmation?.voiceType === "personal" || false,
            hasClonedVoice,
            hasAnyAffirmations: hasAffirmations,
            note: listenNote || "Create an affirmation that speaks to how you feel.",
            suggestedTheme: suggestedCreationTheme
          });
        }
      }
      res.json({
        journeyTitle,
        acknowledgment,
        vibeId,
        vibeLabel: vibe.label,
        vibeAccentColor: routing.accentColor,
        vibeIcon: routing.icon,
        currentMood: mood,
        targetMood,
        steps
      });
    } catch (error) {
      console.error("Error in vibe check-in:", error);
      res.status(500).json({ error: "Failed to process vibe check-in" });
    }
  });
  app2.post("/api/journey-completions", requireAuth, async (req, res) => {
    try {
      const { currentMood, targetMood, vibeId, stepsPlanned, stepsCompleted, stepsSkipped, stepTypes, completedFully, timeOfDay, durationSeconds } = req.body;
      const userId = req.userId;
      if (!currentMood || !targetMood || !stepTypes) {
        return res.status(400).json({ error: "currentMood, targetMood, and stepTypes are required" });
      }
      const dateKey = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const [completion] = await db.insert(journeyCompletions).values({
        userId,
        currentMood,
        targetMood,
        vibeId: vibeId || null,
        stepsPlanned: stepsPlanned || 0,
        stepsCompleted: stepsCompleted || 0,
        stepsSkipped: stepsSkipped || 0,
        stepTypes: Array.isArray(stepTypes) ? stepTypes.join(",") : stepTypes,
        completedFully: completedFully || false,
        timeOfDay: timeOfDay || null,
        durationSeconds: durationSeconds || null,
        dateKey
      }).returning();
      res.json(completion);
    } catch (error) {
      console.error("Error recording journey completion:", error);
      res.status(500).json({ error: "Failed to record journey completion" });
    }
  });
  app2.get("/api/journey-stats", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const [totalCount, completedCount, recentJourneys, moodFrequency, topTargetMood] = await Promise.all([
        db.select({ total: sql7`count(*)::int` }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).then((r) => r[0]),
        db.select({ total: sql7`count(*)::int` }).from(journeyCompletions).where(and6(eq8(journeyCompletions.userId, userId), eq8(journeyCompletions.completedFully, true))).then((r) => r[0]),
        db.select().from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).orderBy(desc3(journeyCompletions.completedAt)).limit(5),
        db.select({
          currentMood: journeyCompletions.currentMood,
          targetMood: journeyCompletions.targetMood,
          count: sql7`count(*)::int`
        }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).groupBy(journeyCompletions.currentMood, journeyCompletions.targetMood).orderBy(sql7`count(*) desc`).limit(3),
        db.select({
          targetMood: journeyCompletions.targetMood,
          count: sql7`count(*)::int`
        }).from(journeyCompletions).where(and6(eq8(journeyCompletions.userId, userId), eq8(journeyCompletions.completedFully, true))).groupBy(journeyCompletions.targetMood).orderBy(sql7`count(*) desc`).limit(1)
      ]);
      let journeyStreak = 0;
      if (recentJourneys.length > 0) {
        let checkDate = /* @__PURE__ */ new Date();
        checkDate.setHours(0, 0, 0, 0);
        const todayKey = checkDate.toISOString().slice(0, 10);
        const yesterdayDate = new Date(checkDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);
        const allDates = await db.select({ dateKey: journeyCompletions.dateKey }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).orderBy(desc3(journeyCompletions.dateKey));
        const uniqueDates = [...new Set(allDates.map((d) => d.dateKey))];
        if (uniqueDates.length > 0 && (uniqueDates[0] === todayKey || uniqueDates[0] === yesterdayKey)) {
          let current = new Date(uniqueDates[0]);
          for (const d of uniqueDates) {
            const expected = current.toISOString().slice(0, 10);
            if (d === expected) {
              journeyStreak++;
              current.setDate(current.getDate() - 1);
            } else {
              break;
            }
          }
        }
      }
      res.json({
        totalJourneys: totalCount?.total || 0,
        completedJourneys: completedCount?.total || 0,
        journeyStreak,
        frequentMoodPaths: moodFrequency,
        topTargetMood: topTargetMood[0] || null,
        lastJourney: recentJourneys[0] || null
      });
    } catch (error) {
      console.error("Error fetching journey stats:", error);
      res.status(500).json({ error: "Failed to fetch journey stats" });
    }
  });
  app2.post("/api/guided-moments/script", requireAuth, guidedMomentLimiter, async (req, res) => {
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });
    try {
      const { mood, timeOfDay, duration: rawDuration, vibeId: reqVibeId } = req.body;
      if (!mood || !timeOfDay) {
        return res.status(400).json({ error: "mood and timeOfDay are required" });
      }
      const validMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed", "energized", "grateful", "confident", "focused", "joyful", "wired", "frustrated", "scattered", "good", "determined", "grounded", "lit_up"];
      const validTimes = ["morning", "afternoon", "evening", "night"];
      const validDurations = [1, 2, 3];
      if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: "Invalid mood value" });
      }
      if (!validTimes.includes(timeOfDay)) {
        return res.status(400).json({ error: "Invalid timeOfDay value" });
      }
      const duration = validDurations.includes(Number(rawDuration)) ? Number(rawDuration) : 1;
      const wordCountMap = {
        1: { min: 50, max: 75 },
        2: { min: 100, max: 145 },
        3: { min: 150, max: 210 }
      };
      const maxTokensMap = { 1: 250, 2: 450, 3: 600 };
      const wordCount = wordCountMap[duration] || wordCountMap[1];
      const maxTokens = maxTokensMap[duration] || 350;
      const durationLabel = duration === 1 ? "60-90 seconds" : `${duration} minutes`;
      const userId = req.userId;
      const [userResult] = await Promise.all([
        db.select({ name: users.name }).from(users).where(eq8(users.id, userId)).limit(1)
      ]);
      const userName = userResult[0]?.name?.split(" ")[0] || "Friend";
      const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const clientDayOfWeek = req.body.dayOfWeek;
      const dayOfWeek = clientDayOfWeek && validDays.includes(clientDayOfWeek) ? clientDayOfWeek : validDays[(/* @__PURE__ */ new Date()).getDay()];
      if (clientDisconnected) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "guidedMoment", message: `Client disconnected before script generation (${duration}min), aborting` }));
        return;
      }
      let moodConfig = MEDITATION_MOOD_CONFIG[mood] || MEDITATION_MOOD_CONFIG.calm;
      let vibeContextLine = "";
      if (reqVibeId && VIBE_LIST.includes(reqVibeId)) {
        const vibeRouting = routeVibe(reqVibeId);
        if (vibeRouting) {
          moodConfig = {
            scriptTone: vibeRouting.vibe.meditation.ttsConfig.scriptTone,
            humeSpeed: vibeRouting.vibe.meditation.ttsConfig.humeSpeed,
            pauseSeconds: vibeRouting.vibe.meditation.ttsConfig.pauseSeconds,
            elevenLabsStability: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStability,
            elevenLabsStyle: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStyle
          };
          vibeContextLine = `
The user's vibe is "${vibeRouting.vibe.label}" \u2014 ${vibeRouting.vibe.description}. Meditation style: ${vibeRouting.vibe.meditation.style}. Focus: ${vibeRouting.vibe.meditation.focusArea}.`;
        }
      }
      const paceDescription = "at a calm pace";
      const scriptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              `You are an expert mindfulness meditation guide creating a personalized micro-meditation. This is a mindfulness exercise (${durationLabel} when read aloud ${paceDescription}).`,
              ``,
              `CONTEXT: It is ${dayOfWeek} ${timeOfDay}. The person is feeling ${mood}. Use this context naturally.${vibeContextLine}`,
              ``,
              `STRUCTURE (follow this order):`,
              `1. OPENING (1-2 sentences): Begin with a brief, natural acknowledgment of where they are in their week and day \u2014 weave the day and time of day into a warm, conversational greeting before the grounding cue. Examples: "It's ${dayOfWeek} ${timeOfDay} \u2014 let this be your moment of calm..." or "The middle of the week can feel long... right here, right now, you're choosing stillness." Keep it effortless, never forced. Then invite them to close their eyes, notice their breath, or feel their body.`,
              `2. BREATHING GUIDANCE (2-3 sentences): Lead a brief breathing cycle tailored to their mood. For stressed/anxious/overwhelmed: slow exhales for vagus nerve activation. For tired: energizing breath with counts. For sad: gentle, warming breaths. For calm: simple awareness breath.`,
              `3. VISUALIZATION (3-4 sentences): Paint a vivid, sensory-rich scene using present tense. Include at least 2 senses (sight + touch, or sound + warmth, etc.). Match the imagery to their mood \u2014 calming scenes for stress/overwhelm, gentle uplifting scenes for sadness, expansive scenes for energy, warm scenes for gratitude.`,
              `4. AFFIRMATION ANCHORING (2-3 sentences): Weave in identity-level affirmations using "I am" or "I choose" language. Use embedded commands naturally. Connect the affirmation to the visualization scene.`,
              `5. GENTLE RETURN (2-3 sentences): Slowly guide them back to their surroundings. Include a physical cue like "wiggle your fingers" or "notice the sounds around you." Then invite them to open their eyes when ready \u2014 never rush this transition. Add a pause ("...") before the final line.`,
              `6. WARM SEND-OFF (1-2 complete sentences): This is the most important part to get right. Always end with a complete, warm farewell that matches the time of day. Use phrases like: morning\u2192"Have a wonderful morning" or "Carry this light into your day," afternoon\u2192"Have a beautiful afternoon" or "Let this fuel the rest of your day," evening\u2192"Have a peaceful evening" or "Take this warmth into your night," night\u2192"Have a restful night" or "Sleep well tonight." The send-off MUST be a fully finished sentence \u2014 never trail off or leave a thought incomplete. This is the last thing the listener hears, so it must land with warmth and finality.`,
              ``,
              `RULES:`,
              `- Total length: ${wordCount.min}-${wordCount.max} words (${durationLabel} ${paceDescription})`,
              `- Use the person's name once, naturally, about three-quarters of the way through \u2014 in the visualization or early affirmation anchoring section. Never at the very beginning, middle, or very end.`,
              `- Include natural pauses marked with "..." (3-4 throughout, including one before the final sign-off)`,
              `- Write in second person ("you") for guidance, first person ("I am") for affirmations`,
              `- Tone: ${moodConfig.scriptTone}`,
              `- No exclamation marks, no questions, no medical claims`,
              `- The day/time reference should feel organic and conversational \u2014 never robotic or templated. Vary your approach each time.`,
              `- The ending must never feel rushed or cut short. The last 2-3 sentences should slow down in pacing and feel like a soft exhale.`,
              `- CRITICAL: The very last sentence must always be a complete send-off wish (e.g., "Have a peaceful evening" or "Enjoy the rest of your day"). Never end mid-thought or with an ellipsis.`,
              `- Reference accessible neuroscience concepts naturally (e.g., "your nervous system settles," "each breath sends a signal of safety")`,
              `- Mood-specific emphasis: stressed\u2192release/safety, anxious\u2192grounding/presence, tired\u2192vitality/awakening, sad\u2192warmth/comfort, overwhelmed\u2192simplicity/clarity, calm\u2192deepening/peace, energized\u2192momentum/vitality, grateful\u2192appreciation/connection, confident\u2192strength/self-trust, focused\u2192clarity/precision, joyful\u2192celebration/lightness`,
              `- This is a mindfulness exercise, not medical advice`,
              ``,
              `Return ONLY the script text, no formatting or labels.`
            ].join("\n")
          },
          {
            role: "user",
            content: `Create a ${duration}-minute micro-meditation for someone named ${userName} feeling ${mood} on ${dayOfWeek} ${timeOfDay}.`
          }
        ],
        temperature: 0.85,
        max_tokens: maxTokens
      });
      const script = scriptResponse.choices[0]?.message?.content?.trim();
      if (!script) {
        return res.status(500).json({ error: "Failed to generate meditation script" });
      }
      res.json({
        script,
        mood,
        disclaimer: "This is a mindfulness exercise for relaxation purposes. It is not a substitute for professional mental health care."
      });
    } catch (error) {
      console.error("Error generating micro-meditation script:", error);
      res.status(500).json({ error: "Failed to generate micro-meditation script. Please try again." });
    }
  });
  app2.post("/api/guided-moments/audio", requireAuth, async (req, res) => {
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });
    try {
      const { script, usePersonalVoice, voiceId: rawVoiceId, mood, vibeId: audioVibeId } = req.body;
      let moodConfig = mood ? MEDITATION_MOOD_CONFIG[mood] || MEDITATION_MOOD_CONFIG.calm : MEDITATION_MOOD_CONFIG.calm;
      if (audioVibeId && VIBE_LIST.includes(audioVibeId)) {
        const vibeRouting = routeVibe(audioVibeId);
        if (vibeRouting) {
          moodConfig = {
            scriptTone: vibeRouting.vibe.meditation.ttsConfig.scriptTone,
            humeSpeed: vibeRouting.vibe.meditation.ttsConfig.humeSpeed,
            pauseSeconds: vibeRouting.vibe.meditation.ttsConfig.pauseSeconds,
            elevenLabsStability: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStability,
            elevenLabsStyle: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStyle
          };
        }
      }
      if (!script || typeof script !== "string" || script.trim().length === 0) {
        return res.status(400).json({ error: "script is required and must be a non-empty string" });
      }
      const userId = req.userId;
      const [userTtsSettings] = await db.select({
        ttsProvider: users.ttsProvider,
        voiceId: users.voiceId,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId
      }).from(users).where(eq8(users.id, userId));
      let voiceId = rawVoiceId;
      if (usePersonalVoice && !voiceId) {
        const resolved = resolvePersonalVoiceId(
          userTtsSettings?.ttsProvider,
          userTtsSettings?.voiceId,
          userTtsSettings?.elevenLabsVoiceId,
          userTtsSettings?.cartesiaVoiceId
        );
        if (resolved) {
          voiceId = resolved;
        } else {
          console.warn(`User ${userId} requested personal voice but no voice clone found`);
        }
      }
      if (clientDisconnected) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "guidedMoment", message: "Client disconnected before TTS, aborting" }));
        return;
      }
      let audioBuffer;
      let wordTimings = [];
      let audioDuration = 0;
      try {
        if (usePersonalVoice && voiceId) {
          const result = await generateAudio(script, voiceId, true, moodConfig, void 0, true);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        } else {
          const stockVoiceId = voiceId && isHumeVoice(voiceId) ? voiceId : "hume_lotus";
          const result = await generateAudio(script, stockVoiceId, false, moodConfig, void 0, true);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        }
      } catch (ttsError) {
        console.error("Guided moment TTS failed:", ttsError?.message || ttsError);
        return res.status(500).json({
          error: "Could not generate audio for your micro-meditation. Please try again.",
          code: ttsError?.message?.includes("QUOTA_EXCEEDED") ? "QUOTA_EXCEEDED" : ttsError?.message?.includes("VOICE_EXPIRED") ? "VOICE_EXPIRED" : "TTS_FAILED"
        });
      }
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");
      res.json({
        audioBase64,
        duration: audioDuration,
        wordTimings
      });
    } catch (error) {
      console.error("Error generating micro-meditation audio:", error);
      res.status(500).json({ error: "Failed to generate micro-meditation audio. Please try again." });
    }
  });
  app2.post("/api/guided-moments/generate", requireAuth, guidedMomentLimiter, async (req, res) => {
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });
    try {
      const { mood, timeOfDay, usePersonalVoice, voiceId: rawVoiceId, duration: rawDuration } = req.body;
      if (!mood || !timeOfDay) {
        return res.status(400).json({ error: "mood and timeOfDay are required" });
      }
      const validMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed", "energized", "grateful", "confident", "focused", "joyful", "wired", "frustrated", "scattered", "good", "determined", "grounded", "lit_up"];
      const validTimes = ["morning", "afternoon", "evening", "night"];
      const validDurations = [1, 2, 3];
      if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: "Invalid mood value" });
      }
      if (!validTimes.includes(timeOfDay)) {
        return res.status(400).json({ error: "Invalid timeOfDay value" });
      }
      const duration = validDurations.includes(Number(rawDuration)) ? Number(rawDuration) : 1;
      const wordCountMap = {
        1: { min: 50, max: 75 },
        2: { min: 100, max: 145 },
        3: { min: 150, max: 210 }
      };
      const maxTokensMap = { 1: 250, 2: 450, 3: 600 };
      const wordCount = wordCountMap[duration] || wordCountMap[1];
      const maxTokens = maxTokensMap[duration] || 350;
      const durationLabel = duration === 1 ? "60-90 seconds" : `${duration} minutes`;
      const userId = req.userId;
      const [userTtsSettings2] = await db.select({
        ttsProvider: users.ttsProvider,
        voiceId: users.voiceId,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId
      }).from(users).where(eq8(users.id, userId));
      const [userResult] = await db.select({ name: users.name }).from(users).where(eq8(users.id, userId)).limit(1);
      const userName = userResult?.name?.split(" ")[0] || "Friend";
      let voiceId = rawVoiceId;
      if (usePersonalVoice && !voiceId) {
        const resolved = resolvePersonalVoiceId(
          userTtsSettings2?.ttsProvider,
          userTtsSettings2?.voiceId,
          userTtsSettings2?.elevenLabsVoiceId,
          userTtsSettings2?.cartesiaVoiceId
        );
        if (resolved) {
          voiceId = resolved;
        } else {
          console.warn(`User ${userId} requested personal voice but no voice clone found`);
        }
      }
      const validDaysLegacy = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const clientDayOfWeekLegacy = req.body.dayOfWeek;
      const dayOfWeek = clientDayOfWeekLegacy && validDaysLegacy.includes(clientDayOfWeekLegacy) ? clientDayOfWeekLegacy : validDaysLegacy[(/* @__PURE__ */ new Date()).getDay()];
      if (clientDisconnected) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "meditation", message: `Client disconnected before script generation (${duration}min), aborting` }));
        return;
      }
      const moodConfig = MEDITATION_MOOD_CONFIG[mood] || MEDITATION_MOOD_CONFIG.calm;
      const paceDescription = "at a calm pace";
      const scriptPromise = openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              `You are an expert mindfulness meditation guide creating a personalized micro-meditation. This is a mindfulness exercise (${durationLabel} when read aloud ${paceDescription}).`,
              ``,
              `CONTEXT: It is ${dayOfWeek} ${timeOfDay}. The person is feeling ${mood}. Use this context naturally.`,
              ``,
              `STRUCTURE (follow this order):`,
              `1. OPENING (1-2 sentences): Begin with a brief, natural acknowledgment of where they are in their week and day \u2014 weave the day and time of day into a warm, conversational greeting before the grounding cue. Keep it effortless, never forced. Then invite them to close their eyes, notice their breath, or feel their body.`,
              `2. BREATHING GUIDANCE (2-3 sentences): Lead a brief breathing cycle tailored to their mood. For stressed/anxious/overwhelmed: slow exhales for vagus nerve activation. For tired: energizing breath with counts. For sad: gentle, warming breaths. For calm: simple awareness breath.`,
              `3. VISUALIZATION (3-4 sentences): Paint a vivid, sensory-rich scene using present tense. Include at least 2 senses (sight + touch, or sound + warmth, etc.). Match the imagery to their mood \u2014 calming scenes for stress/overwhelm, gentle uplifting scenes for sadness, expansive scenes for energy, warm scenes for gratitude.`,
              `4. AFFIRMATION ANCHORING (2-3 sentences): Weave in identity-level affirmations using "I am" or "I choose" language. Use embedded commands naturally. Connect the affirmation to the visualization scene.`,
              `5. GENTLE RETURN (2-3 sentences): Slowly guide them back to their surroundings. Include a physical cue like "wiggle your fingers" or "notice the sounds around you." Then invite them to open their eyes when ready \u2014 never rush this transition. Add a pause ("...") before the final line.`,
              `6. WARM SEND-OFF (1-2 complete sentences): This is the most important part to get right. Always end with a complete, warm farewell that matches the time of day. Use phrases like: morning\u2192"Have a wonderful morning" or "Carry this light into your day," afternoon\u2192"Have a beautiful afternoon" or "Let this fuel the rest of your day," evening\u2192"Have a peaceful evening" or "Take this warmth into your night," night\u2192"Have a restful night" or "Sleep well tonight." The send-off MUST be a fully finished sentence \u2014 never trail off or leave a thought incomplete. This is the last thing the listener hears, so it must land with warmth and finality.`,
              ``,
              `RULES:`,
              `- Total length: ${wordCount.min}-${wordCount.max} words (${durationLabel} ${paceDescription})`,
              `- Use the person's name once, naturally, about three-quarters of the way through \u2014 in the visualization or early affirmation anchoring section. Never at the very beginning, middle, or very end.`,
              `- Include natural pauses marked with "..." (3-4 throughout, including one before the final sign-off)`,
              `- Write in second person ("you") for guidance, first person ("I am") for affirmations`,
              `- Tone: ${moodConfig.scriptTone}`,
              `- No exclamation marks, no questions, no medical claims`,
              `- The day/time reference should feel organic and conversational \u2014 never robotic or templated. Vary your approach each time.`,
              `- The ending must never feel rushed or cut short. The last 2-3 sentences should slow down in pacing and feel like a soft exhale.`,
              `- CRITICAL: The very last sentence must always be a complete send-off wish (e.g., "Have a peaceful evening" or "Enjoy the rest of your day"). Never end mid-thought or with an ellipsis.`,
              `- Reference accessible neuroscience concepts naturally (e.g., "your nervous system settles," "each breath sends a signal of safety")`,
              `- Mood-specific emphasis: stressed\u2192release/safety, anxious\u2192grounding/presence, tired\u2192vitality/awakening, sad\u2192warmth/comfort, overwhelmed\u2192simplicity/clarity, calm\u2192deepening/peace, energized\u2192momentum/vitality, grateful\u2192appreciation/connection, confident\u2192strength/self-trust, focused\u2192clarity/precision, joyful\u2192celebration/lightness`,
              `- This is a mindfulness exercise, not medical advice`,
              ``,
              `Return ONLY the script text, no formatting or labels.`
            ].join("\n")
          },
          {
            role: "user",
            content: `Create a ${duration}-minute micro-meditation for someone named ${userName} feeling ${mood} on ${dayOfWeek} ${timeOfDay}.`
          }
        ],
        temperature: 0.85,
        max_tokens: maxTokens
      });
      const scriptResponse = await scriptPromise;
      const script = scriptResponse.choices[0]?.message?.content?.trim();
      if (!script) {
        return res.status(500).json({ error: "Failed to generate meditation script" });
      }
      if (clientDisconnected) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "meditation", message: `Client disconnected after script generation (${duration}min), skipping TTS` }));
        return;
      }
      let audioBuffer;
      let wordTimings = [];
      let audioDuration = 0;
      try {
        if (usePersonalVoice && voiceId) {
          const result = await generateAudio(script, voiceId, true, moodConfig, void 0, true);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        } else {
          const stockVoiceId = voiceId && isHumeVoice(voiceId) ? voiceId : "hume_lotus";
          const result = await generateAudio(script, stockVoiceId, false, moodConfig, void 0, true);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        }
      } catch (ttsError) {
        console.error("Guided moment TTS failed:", ttsError?.message || ttsError);
        return res.status(500).json({
          error: "Could not generate audio for your micro-meditation. Please try again.",
          code: ttsError?.message?.includes("QUOTA_EXCEEDED") ? "QUOTA_EXCEEDED" : ttsError?.message?.includes("VOICE_EXPIRED") ? "VOICE_EXPIRED" : "TTS_FAILED"
        });
      }
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");
      res.json({
        script,
        audioBase64,
        duration: audioDuration,
        wordTimings,
        mood,
        disclaimer: "This is a mindfulness exercise for relaxation purposes. It is not a substitute for professional mental health care."
      });
    } catch (error) {
      console.error("Error generating micro-meditation:", error);
      res.status(500).json({ error: "Failed to generate micro-meditation. Please try again." });
    }
  });
  registerReminderRoutes(app2);
  registerBreathingRoutes(app2);
  registerAdminRoutes(app2, generateAudio, getPillarVoiceConfig);
  registerDevRoutes(app2, requireAuth);
  registerAnalyticsRoutes(app2);
  app2.post("/api/user/voice-consent", requireAuth, async (req, res) => {
    try {
      const { consent } = req.body;
      if (typeof consent !== "boolean") {
        return res.status(400).json({ error: "Consent must be a boolean value" });
      }
      await db.update(users).set({ hasConsentedToVoiceCloning: consent }).where(eq8(users.id, req.userId));
      res.json({ success: true, hasConsentedToVoiceCloning: consent });
    } catch (error) {
      console.error("Error updating voice consent:", error);
      res.status(500).json({ error: "Failed to update consent" });
    }
  });
  app2.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      const [user] = await db.select({ subscriptionTier: users.subscriptionTier }).from(users).where(eq8(users.id, req.userId)).limit(1);
      const tier = user?.subscriptionTier || "free";
      res.json({
        tier,
        isPremium: isPremiumUser({ subscriptionTier: tier }),
        betaMode: BETA_MODE,
        freeFeatures: FREE_FEATURES,
        premiumFeatures: PREMIUM_FEATURES_LIST
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription info" });
    }
  });
  app2.get("/api/user/limits", requireAuth, async (req, res) => {
    try {
      const limits = await checkAndResetMonthlyLimits(req.userId);
      const [user] = await db.select({
        voiceClonesUsed: users.voiceClonesUsed,
        hasConsentedToVoiceCloning: users.hasConsentedToVoiceCloning
      }).from(users).where(eq8(users.id, req.userId)).limit(1);
      const isAdmin = ADMIN_USER_IDS.has(req.userId);
      res.json({
        voiceClones: {
          used: user?.voiceClonesUsed || 0,
          limit: isAdmin ? 999 : MAX_VOICE_CLONES_LIFETIME,
          remaining: isAdmin ? 999 : Math.max(0, MAX_VOICE_CLONES_LIFETIME - (user?.voiceClonesUsed || 0))
        },
        aiAffirmations: {
          used: limits.affirmationsThisMonth,
          limit: isAdmin ? 999 : MAX_AI_AFFIRMATIONS_PER_MONTH,
          remaining: isAdmin ? 999 : limits.affirmationsRemaining
        },
        hasConsentedToVoiceCloning: user?.hasConsentedToVoiceCloning || false
      });
    } catch (error) {
      console.error("Error fetching user limits:", error);
      res.status(500).json({ error: "Failed to fetch limits" });
    }
  });
  app2.delete("/api/user/data", requireAuth, async (req, res) => {
    try {
      const userId = req.userId;
      const userAffirmations = await db.select({ audioUrl: affirmations.audioUrl }).from(affirmations).where(eq8(affirmations.userId, userId));
      for (const aff of userAffirmations) {
        if (aff.audioUrl) {
          const filePath = path3.join(uploadDir, aff.audioUrl.replace("/uploads/", ""));
          fs3.unlink(filePath, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error("Failed to delete audio file:", err);
            }
          });
        }
      }
      const userVoiceSamples = await db.select({ audioUrl: voiceSamples.audioUrl }).from(voiceSamples).where(eq8(voiceSamples.userId, userId));
      for (const sample of userVoiceSamples) {
        if (sample.audioUrl && sample.audioUrl !== "processing") {
          const filePath = path3.join(uploadDir, sample.audioUrl.replace("/uploads/", ""));
          fs3.unlink(filePath, () => {
          });
        }
      }
      await db.delete(listeningSessions).where(eq8(listeningSessions.userId, userId));
      await db.delete(breathingSessions).where(eq8(breathingSessions.userId, userId));
      await db.delete(notificationSettings).where(eq8(notificationSettings.userId, userId));
      await db.delete(pushTokens).where(eq8(pushTokens.userId, userId));
      await db.delete(reminders).where(eq8(reminders.userId, userId));
      await db.delete(affirmations).where(eq8(affirmations.userId, userId));
      await db.delete(voiceSamples).where(eq8(voiceSamples.userId, userId));
      await db.delete(customCategories).where(eq8(customCategories.userId, userId));
      await db.delete(collections).where(eq8(collections.userId, userId));
      await db.delete(users).where(eq8(users.id, userId));
      res.json({
        success: true,
        message: "All your data has been permanently deleted."
      });
    } catch (error) {
      console.error("Error deleting user data:", error);
      res.status(500).json({ error: "Failed to delete user data. Please contact support." });
    }
  });
  registerGithubRoutes(app2);
  app2.get("/api/daily-greeting", requireAuth, dailyGreetingLimiter, async (req, res) => {
    const userId = req.userId;
    const timeOfDay = req.query.timeOfDay || "morning";
    const validTimes = ["morning", "afternoon", "evening", "night"];
    const normalizedTime = validTimes.includes(timeOfDay) ? timeOfDay : "morning";
    const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const clientDayOfWeek = req.query.dayOfWeek;
    const dayOfWeek = clientDayOfWeek && validDays.includes(clientDayOfWeek) ? clientDayOfWeek : validDays[(/* @__PURE__ */ new Date()).getDay()];
    const hoursAway = req.query.hoursAway ? parseInt(req.query.hoursAway, 10) : null;
    const isWelcomeBack = hoursAway !== null && hoursAway >= 4;
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const cacheKey = isWelcomeBack ? `${userId}-${today}-${dayOfWeek}-wb` : `${userId}-${today}-${dayOfWeek}`;
    const cached = dailyGreetingCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
    try {
      const [user] = await db.select({ name: users.name }).from(users).where(eq8(users.id, userId));
      const firstName = user?.name?.split(" ")[0] || "";
      const [sessionStats, affirmationCount, voiceCloneStatus, listeningCount, journeyCount, topJourneyMood, lastVibe] = await Promise.all([
        db.select({ total: sql7`count(*)::int` }).from(breathingSessions).where(eq8(breathingSessions.userId, userId)).then((r) => r[0]),
        db.select({ total: sql7`count(*)::int` }).from(affirmations).where(eq8(affirmations.userId, userId)).then((r) => r[0]),
        db.select({ voiceId: voiceSamples.voiceId, status: voiceSamples.status }).from(voiceSamples).where(and6(eq8(voiceSamples.userId, userId), eq8(voiceSamples.status, "ready"))).limit(1).then((r) => r[0]),
        db.select({ total: sql7`count(*)::int` }).from(listeningSessions).where(eq8(listeningSessions.userId, userId)).then((r) => r[0]),
        db.select({ total: sql7`count(*)::int` }).from(journeyCompletions).where(eq8(journeyCompletions.userId, userId)).then((r) => r[0]),
        db.select({
          targetMood: journeyCompletions.targetMood,
          count: sql7`count(*)::int`
        }).from(journeyCompletions).where(and6(eq8(journeyCompletions.userId, userId), eq8(journeyCompletions.completedFully, true))).groupBy(journeyCompletions.targetMood).orderBy(sql7`count(*) desc`).limit(1).then((r) => r[0]),
        db.select({ vibeId: journeyCompletions.vibeId }).from(journeyCompletions).where(and6(eq8(journeyCompletions.userId, userId), isNotNull4(journeyCompletions.vibeId))).orderBy(desc3(journeyCompletions.completedAt)).limit(1).then((r) => r[0])
      ]);
      const totalBreathingSessions = sessionStats?.total || 0;
      const totalAffirmations = affirmationCount?.total || 0;
      const hasVoiceClone = !!voiceCloneStatus;
      const totalListens = listeningCount?.total || 0;
      const totalJourneys = journeyCount?.total || 0;
      const [streakResult] = await db.select({ dateKey: breathingSessions.dateKey }).from(breathingSessions).where(eq8(breathingSessions.userId, userId)).orderBy(desc3(breathingSessions.completedAt)).limit(1);
      let streak = 0;
      if (streakResult) {
        let checkDate = /* @__PURE__ */ new Date();
        checkDate.setHours(0, 0, 0, 0);
        const todayKey = checkDate.toISOString().slice(0, 10);
        const yesterdayDate = new Date(checkDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);
        if (streakResult.dateKey === todayKey || streakResult.dateKey === yesterdayKey) {
          const allDates = await db.select({ dateKey: breathingSessions.dateKey }).from(breathingSessions).where(eq8(breathingSessions.userId, userId)).orderBy(desc3(breathingSessions.dateKey));
          const uniqueDates = [...new Set(allDates.map((d) => d.dateKey))];
          let current = streakResult.dateKey === todayKey ? new Date(todayKey) : new Date(yesterdayKey);
          for (const d of uniqueDates) {
            const expected = current.toISOString().slice(0, 10);
            if (d === expected) {
              streak++;
              current.setDate(current.getDate() - 1);
            } else {
              break;
            }
          }
        }
      }
      const [topTechnique] = await db.select({
        techniqueId: breathingSessions.techniqueId,
        count: sql7`count(*)::int`
      }).from(breathingSessions).where(eq8(breathingSessions.userId, userId)).groupBy(breathingSessions.techniqueId).orderBy(sql7`count(*) desc`).limit(1);
      let statsContext = "";
      if (totalBreathingSessions > 0 || totalAffirmations > 0 || totalJourneys > 0) {
        const parts = [];
        if (streak > 1) parts.push(`${streak}-day breathing streak`);
        if (totalBreathingSessions > 0) parts.push(`${totalBreathingSessions} breathing sessions`);
        if (totalAffirmations > 0) parts.push(`${totalAffirmations} affirmation(s) created`);
        if (totalListens > 0) parts.push(`${totalListens} listening sessions`);
        if (hasVoiceClone) parts.push("has cloned voice (Inner Voice)");
        if (topTechnique) parts.push(`favorite technique: ${topTechnique.techniqueId}`);
        if (totalJourneys > 0) parts.push(`${totalJourneys} mood journey(s) completed`);
        if (topJourneyMood) parts.push(`most-sought mood: ${topJourneyMood.targetMood}`);
        if (lastVibe?.vibeId) {
          const vibeConfig = getVibeConfig(lastVibe.vibeId);
          if (vibeConfig) parts.push(`last vibe: "${vibeConfig.label}" (${vibeConfig.description})`);
        }
        statsContext = `
User activity: ${parts.join(", ")}.`;
      }
      let welcomeBackContext = "";
      if (isWelcomeBack && hoursAway) {
        const awayLabel = hoursAway >= 24 ? `${Math.round(hoursAway / 24)} day(s)` : `${hoursAway} hour(s)`;
        welcomeBackContext = `
WELCOME BACK: The user is returning after being away for ${awayLabel}. Acknowledge their return warmly but subtly \u2014 don't say "welcome back" literally. Instead, reference the time away naturally: "Your ${normalizedTime} reset awaits" or "picking up right where you left off" or weave their streak/stats into a return-flavored message. Make it feel like the app noticed them and is glad they're here.`;
      }
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              `You write ultra-short sub-messages for the Retuned wellness app. The greeting line ("Good ${normalizedTime}, ${firstName}") is already shown above your message \u2014 you only write the sub-message below it.`,
              ``,
              `CONTEXT: It is ${dayOfWeek} ${normalizedTime}. Weave the day or time naturally into the message when it feels right \u2014 don't force it. Sometimes skip the day entirely.`,
              ``,
              `TONE: Direct, grounded, real. Like a sharp mentor who drops knowledge \u2014 not a cheerleader. Think neuroscience meets street wisdom. Confident, matter-of-fact, occasionally provocative. No fluff, no soft affirmation language. No quotation marks, no exclamation marks.`,
              ``,
              `THEMES for ${normalizedTime.toUpperCase()} (pick one, use plain language \u2014 no jargon):`,
              ...normalizedTime === "morning" ? [
                `- Your prefrontal cortex is sharpest in the first 2 hours \u2014 prime it before the world gets loud`,
                `- Cortisol peaks naturally each morning \u2014 channel it into focus, not anxiety`,
                `- The first thoughts you run today become the default program for the rest of it`,
                `- Your brain consolidated overnight \u2014 this morning version of you is already upgraded`,
                `- 90% of your decisions today will come from your subconscious \u2014 might want to program it right`,
                `- Mental rehearsal in the morning activates the same neural circuits as the real thing`,
                `- Morning breathwork resets your CO2 tolerance \u2014 that is why calm feels effortless after`,
                `- Hearing your own voice speak your goals activates identity-level belief circuits`,
                `- 5 minutes of box breathing now gives you more mental clarity than a second coffee`,
                `- Affirmations work because your brain cannot distinguish internal narrative from external truth`,
                `- A 3-minute meditation right now raises your baseline focus for the next 4 hours`,
                `- Your reticular activating system filters reality by what you tell it matters \u2014 tell it something good`
              ] : normalizedTime === "afternoon" ? [
                `- Your willpower is a depletable resource \u2014 afternoon is when trained habits take over`,
                `- Repetition is not boring, it is how synaptic connections strengthen`,
                `- The gap between who you are and who you want to be closes with each rep`,
                `- Elite performers do not rely on motivation \u2014 they rely on conditioned responses`,
                `- Your subconscious does not rest \u2014 it is running the pattern you last gave it`,
                `- Focus is not willpower \u2014 it is trained attention, and it compounds`,
                `- A 90-second breathing reset now prevents the afternoon cortisol crash`,
                `- Listening to your affirmation mid-day reinforces the morning prime \u2014 that is how stacking works`,
                `- Your vagus nerve responds to slow exhales \u2014 2 minutes recalibrates your entire nervous system`,
                `- Meditation is not about emptying your mind \u2014 it is training your attention like a muscle`,
                `- The words you repeat to yourself become automatic thoughts within 21 days of consistency`,
                `- A brief body scan right now drops your stress hormones faster than any break`
              ] : normalizedTime === "evening" ? [
                `- Your nervous system shifts into parasympathetic mode now \u2014 let it do its work`,
                `- Stress literally shrinks your prefrontal cortex \u2014 controlled breathing reverses it`,
                `- The voice in your head runs 24/7 \u2014 you either program it or it programs you`,
                `- Evening reflection is not optional \u2014 your brain is already scoring today's performance`,
                `- What you feed your mind in the last 2 hours shapes tomorrow's baseline state`,
                `- Your default thoughts are just old code \u2014 tonight is a good time to rewrite them`,
                `- Extended exhale breathing triggers your rest-and-digest system \u2014 your evening reset button`,
                `- Hearing affirmations in your own voice at night bypasses the critical filter entirely`,
                `- A 5-minute meditation now clears the mental cache from today so tomorrow boots clean`,
                `- Your amygdala calms 40% faster with guided breathing than with willpower alone`,
                `- The self-talk you run before bed becomes the lens you see tomorrow through`,
                `- Breathwork is the only autonomic function you can consciously control \u2014 use it`
              ] : [
                `- Your brain does its deepest rewiring during sleep \u2014 what you prime it with matters`,
                `- Sleep spindles consolidate new neural patterns \u2014 give them something worth keeping`,
                `- The subconscious mind processes 20,000 times more data than your conscious mind \u2014 it is working right now`,
                `- Your nervous system cannot tell the difference between real and vividly imagined`,
                `- The last mental pattern before sleep becomes the first one loaded tomorrow`,
                `- Slow breathing before bed increases heart rate variability \u2014 your body's resilience score`,
                `- Listening to affirmations as you drift off plants them directly in your subconscious`,
                `- 4-7-8 breathing was designed specifically for the transition to sleep \u2014 your nervous system knows`,
                `- A brief meditation now shifts your brain from beta to alpha waves \u2014 the gateway to deep rest`,
                `- Your brain replays and strengthens the neural patterns you activated today while you sleep`,
                `- The identity you narrate to yourself at night is the one your subconscious builds toward`,
                `- Diaphragmatic breathing lowers your heart rate within 30 seconds \u2014 try it right now`
              ],
              `${statsContext}`,
              `${welcomeBackContext}`,
              ``,
              `RESPONSE FORMAT: Return valid JSON only. No markdown, no code fences.`,
              `{ "message": "your message here" }`,
              ``,
              `RULES:`,
              `- Max 14 words. Aim for 8-12.`,
              `- Drop knowledge, state a fact, or provoke thought. No calls to action, no nudges, no suggestions to do anything.`,
              `- Sound like someone who has read the research and is giving you the real version.`,
              `- NEVER use first-person "I". Always address the user with "you/your" or use universal statements.`,
              `- Vary structure: sometimes a hard fact, sometimes a question, sometimes a punchy fragment.`,
              `- Never sound like a motivational poster. Sound like a smart friend who actually knows things.`
            ].join("\n")
          },
          {
            role: "user",
            content: isWelcomeBack ? `Generate a ${dayOfWeek} ${normalizedTime} welcome-back sub-message for a user returning after ${hoursAway} hours.` : `Generate a ${dayOfWeek} ${normalizedTime} sub-message.`
          }
        ],
        temperature: 0.85,
        max_tokens: 80
      });
      const raw = response.choices[0]?.message?.content?.trim() || "";
      let parsed;
      try {
        const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(cleaned);
        parsed.message = (parsed.message || "").replace(/["""''!]/g, "");
      } catch {
        parsed = { message: raw.replace(/["""''!]/g, "").substring(0, 80) || dailyGreetingFallbacks[normalizedTime] };
      }
      dailyGreetingCache.set(cacheKey, parsed);
      res.json({ ...parsed, cached: false });
    } catch (error) {
      console.error("Daily greeting generation failed:", error);
      res.json({ message: dailyGreetingFallbacks[normalizedTime], cached: false });
    }
  });
  setInterval(async () => {
    try {
      const expiryResult = await sendVoiceExpiryWarnings();
      if (expiryResult.warned > 0) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceExpiry", message: `[Voice Expiry] Sent ${expiryResult.warned} expiry warnings` }));
      }
    } catch (expiryError) {
      console.error("[Voice Expiry] Warning check failed:", expiryError);
    }
    try {
      console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceRotation", message: "[Voice Rotation] Running scheduled voice cleanup..." }));
      const results = await runVoiceRotation(60);
      if (results.rotated > 0) {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceRotation", message: `[Voice Rotation] Rotated ${results.rotated} inactive voices` }));
      } else {
        console.log(JSON.stringify({ level: "INFO", ts: (/* @__PURE__ */ new Date()).toISOString(), component: "voiceRotation", message: "[Voice Rotation] No inactive voices to rotate" }));
      }
      const warning = await checkVoiceSlotWarning();
      if (warning) {
        console.warn(warning);
      }
    } catch (error) {
      console.error("[Voice Rotation] Scheduled cleanup failed:", error);
    }
  }, 24 * 60 * 60 * 1e3);
}

// server/index.ts
import * as fs4 from "fs";
import * as path4 from "path";

// server/error-tracker.ts
async function trackError(component, message, error, metadata) {
  try {
    await db.insert(serverErrors).values({
      level: "error",
      component,
      message,
      stack: error?.stack || null,
      metadata: metadata || null
    });
  } catch (e) {
    console.error("[error-tracker] Failed to log error:", e);
  }
}

// server/index.ts
var app = express();
var SERVER_VERSION = "1.7.4";
var healthCheckReady = false;
var cachedHealthResponse = null;
var server = createServer((req, res) => {
  if (healthCheckReady && cachedHealthResponse) {
    if (req.url === "/__health") {
      res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-cache" });
      res.end("ok");
      return;
    }
    if (req.url === "/" && !(req.headers.accept || "").includes("text/html")) {
      res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-cache" });
      res.end("ok");
      return;
    }
  }
  app(req, res);
});
function timestamp2() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function logInfo(component, message, data) {
  const entry = {
    level: "INFO",
    ts: timestamp2(),
    component,
    message,
    ...data
  };
  console.log(JSON.stringify(entry));
}
function logWarn(component, message, data) {
  const entry = {
    level: "WARN",
    ts: timestamp2(),
    component,
    message,
    ...data
  };
  console.warn(JSON.stringify(entry));
}
function logError(component, message, data) {
  const entry = {
    level: "ERROR",
    ts: timestamp2(),
    component,
    message,
    ...data
  };
  console.error(JSON.stringify(entry));
}
function setupProcessHandlers() {
  process.on("uncaughtException", (err) => {
    logError("process", "Uncaught exception \u2014 server staying alive", {
      error: err.message,
      stack: err.stack
    });
    trackError("process", `Uncaught exception: ${err.message}`, err);
  });
  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : void 0;
    logError("process", "Unhandled promise rejection \u2014 server staying alive", {
      error: message,
      stack
    });
    trackError("process", `Unhandled rejection: ${message}`, reason instanceof Error ? reason : void 0);
  });
  logInfo("process", "Process-level error handlers installed");
}
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}:5000`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
        origins.add(`https://${d.trim()}:5000`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    const isMobileApp = !origin && req.path.startsWith("/api/");
    if (isMobileApp || origin && (origins.has(origin) || isLocalhost)) {
      if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
      } else {
        res.header("Access-Control-Allow-Origin", "*");
      }
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS, PATCH"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupSecurityHeaders(app2) {
  app2.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(self), camera=()");
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https:",
      "media-src 'self' blob: data:",
      "frame-ancestors 'self'"
    ].join("; ");
    res.setHeader("Content-Security-Policy", csp);
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    const originalResJson = res.json;
    let capturedStatus;
    res.json = function(bodyJson, ...args) {
      capturedStatus = res.statusCode;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!reqPath.startsWith("/api")) return;
      const duration = Date.now() - start;
      const status = capturedStatus || res.statusCode;
      const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
      const entry = {
        level,
        ts: timestamp2(),
        component: "http",
        method: req.method,
        path: reqPath,
        status,
        duration_ms: duration
      };
      if (status >= 400) {
        entry.ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
        entry.user_agent = req.headers["user-agent"]?.substring(0, 120) || "unknown";
      }
      if (status >= 500) {
        console.error(JSON.stringify(entry));
      } else if (status >= 400) {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path4.resolve(process.cwd(), "app.json");
    const appJsonContent = fs4.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, req, res) {
  const manifestPath = path4.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs4.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const forwardedProto = req.header("x-forwarded-proto") || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host") || req.get("host");
  const currentBaseUrl = `${forwardedProto}://${forwardedHost}`;
  let manifest = fs4.readFileSync(manifestPath, "utf-8");
  manifest = manifest.replace(
    /https?:\/\/[^"]+?(?=\/\d+-\d+\/_expo)/g,
    currentBaseUrl
  );
  const hostWithoutProtocol = forwardedHost || "";
  manifest = manifest.replace(
    /"hostUri"\s*:\s*"[^"]+"/g,
    `"hostUri": "${hostWithoutProtocol}/${platform}"`
  );
  manifest = manifest.replace(
    /"debuggerHost"\s*:\s*"[^"]+"/g,
    `"debuggerHost": "${hostWithoutProtocol}/${platform}"`
  );
  res.send(manifest);
}
function configureExpoAndLanding(app2) {
  const templatePath = path4.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const appName = getAppName();
  let cachedTemplate = "";
  try {
    cachedTemplate = fs4.readFileSync(templatePath, "utf-8");
  } catch {
  }
  logInfo("startup", "Serving static Expo files with dynamic manifest routing");
  app2.get("/privacy-policy", (_req, res) => {
    const privacyPath = path4.resolve(process.cwd(), "server", "templates", "privacy-policy.html");
    if (fs4.existsSync(privacyPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(privacyPath);
    } else {
      res.status(404).send("Privacy Policy not found");
    }
  });
  app2.get("/terms-of-service", (_req, res) => {
    const termsPath = path4.resolve(process.cwd(), "server", "templates", "terms-of-service.html");
    if (fs4.existsSync(termsPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(termsPath);
    } else {
      res.status(404).send("Terms of Service not found");
    }
  });
  app2.get("/science", (_req, res) => {
    const sciencePath = path4.resolve(process.cwd(), "server", "templates", "science.html");
    if (fs4.existsSync(sciencePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(sciencePath);
    } else {
      res.status(404).send("Science page not found");
    }
  });
  app2.get("/support", (_req, res) => {
    const supportPath = path4.resolve(process.cwd(), "server", "templates", "support.html");
    if (fs4.existsSync(supportPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(supportPath);
    } else {
      res.status(404).send("Support page not found");
    }
  });
  app2.get("/admin", requireAuth, (req, res) => {
    const adminReq = req;
    if (!ADMIN_USER_IDS.has(adminReq.userId)) {
      return res.status(403).send("Access denied");
    }
    const dashboardPath = path4.resolve(process.cwd(), "server", "templates", "admin-dashboard.html");
    if (fs4.existsSync(dashboardPath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(dashboardPath);
    } else {
      res.status(404).send("Admin dashboard not found");
    }
  });
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, req, res);
    }
    next();
  });
  const assetsPath = path4.resolve(process.cwd(), "assets");
  const staticBuildPath = path4.resolve(process.cwd(), "static-build");
  const landingAssetsPath = path4.resolve(process.cwd(), "server", "templates", "landing-assets");
  app2.use("/assets", express.static(assetsPath));
  app2.use("/landing-assets", express.static(landingAssetsPath));
  app2.use(express.static(staticBuildPath));
  logInfo("startup", "Static file serving configured", {
    assets: assetsPath,
    staticBuild: staticBuildPath
  });
}
function setupHealthEndpoint(app2) {
  app2.get("/api/health", async (_req, res) => {
    const health = {
      status: "ok",
      version: SERVER_VERSION,
      uptime_s: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      timestamp: timestamp2()
    };
    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      health.database = { status: "connected", latency_ms: Date.now() - start };
    } catch (err) {
      const dbErr = err instanceof Error ? err.message : String(err);
      health.database = { status: "error", error: dbErr };
      health.status = "degraded";
    }
    const statusCode = health.status === "ok" ? 200 : 503;
    return res.status(statusCode).json(health);
  });
}
function setupApiCatchAll(app2) {
  app2.use((req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      logWarn("http", "Unknown API endpoint hit", {
        method: req.method,
        path: req.path,
        ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
        user_agent: req.headers["user-agent"]?.substring(0, 120) || "unknown"
      });
      return res.status(404).json({ error: "API endpoint not found" });
    }
    next();
  });
}
function setupErrorHandler(app2) {
  app2.use((err, req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    logError("http", "Request error", {
      method: req.method,
      path: req.path,
      status,
      error: message,
      stack: err instanceof Error ? err.stack : void 0
    });
    if (status >= 500) {
      trackError("http", message, err instanceof Error ? err : void 0, {
        method: req.method,
        path: req.path,
        status
      });
    }
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  const startTime = Date.now();
  setupProcessHandlers();
  logInfo("startup", `Retuned server v${SERVER_VERSION} starting`, {
    node_version: process.version,
    env: process.env.NODE_ENV || "development"
  });
  const landingTemplatePath = path4.resolve(process.cwd(), "server", "templates", "landing-page.html");
  let earlyLandingCache = "";
  try {
    earlyLandingCache = fs4.readFileSync(landingTemplatePath, "utf-8");
  } catch {
  }
  const cachedAppName = getAppName();
  logInfo("startup", "Landing page cached", {
    size_bytes: earlyLandingCache.length,
    app_name: cachedAppName
  });
  cachedHealthResponse = { landingCache: earlyLandingCache, appName: cachedAppName };
  healthCheckReady = true;
  app.get("/", (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    if (!earlyLandingCache || !(req.headers.accept || "").includes("text/html")) {
      return res.status(200).send("ok");
    }
    const protocol = req.header("x-forwarded-proto") || req.protocol || "https";
    const host = req.header("x-forwarded-host") || req.get("host") || "";
    const html = earlyLandingCache.replace(/BASE_URL_PLACEHOLDER/g, `${protocol}://${host}`).replace(/EXPS_URL_PLACEHOLDER/g, host).replace(/APP_NAME_PLACEHOLDER/g, cachedAppName);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });
  logInfo("startup", "Health check (raw http) and root route registered before port open");
  const port = parseInt(process.env.PORT || "5000", 10);
  logInfo("startup", `Opening port ${port}`);
  await new Promise((resolve2, reject) => {
    server.listen({ port, host: "0.0.0.0" }, () => {
      logInfo("startup", `Port ${port} open \u2014 accepting connections`, {
        boot_time_ms: Date.now() - startTime
      });
      resolve2();
    });
    server.on("error", (err) => {
      logError("startup", `Failed to open port ${port}`, {
        error: err.message,
        code: err.code
      });
      reject(err);
    });
  });
  try {
    setupSecurityHeaders(app);
    logInfo("startup", "Security headers configured");
  } catch (err) {
    logError("startup", "Failed to configure security headers \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    setupCors(app);
    logInfo("startup", "CORS configured");
  } catch (err) {
    logError("startup", "Failed to configure CORS \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    setupBodyParsing(app);
    logInfo("startup", "Body parsing configured");
  } catch (err) {
    logError("startup", "Failed to configure body parsing \u2014 this is critical", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    setupRequestLogging(app);
    logInfo("startup", "Request logging configured");
  } catch (err) {
    logError("startup", "Failed to configure request logging \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    setupHealthEndpoint(app);
    logInfo("startup", "Health endpoint registered at /api/health");
  } catch (err) {
    logError("startup", "Failed to setup health endpoint \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    configureExpoAndLanding(app);
    logInfo("startup", "Expo and landing page configured");
  } catch (err) {
    logError("startup", "Failed to configure Expo/landing \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    await registerRoutes(app);
    logInfo("startup", "API routes registered");
  } catch (err) {
    logError("startup", "Failed to register API routes \u2014 this is critical", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : void 0
    });
    process.exit(1);
  }
  try {
    setupApiCatchAll(app);
    logInfo("startup", "API catch-all configured");
  } catch (err) {
    logError("startup", "Failed to setup API catch-all \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  try {
    setupErrorHandler(app);
    logInfo("startup", "Error handler configured");
  } catch (err) {
    logError("startup", "Failed to setup error handler \u2014 continuing", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  logInfo("startup", "All middleware configured \u2014 server fully ready", {
    boot_time_ms: Date.now() - startTime,
    version: SERVER_VERSION
  });
  const gracefulShutdown = (signal) => {
    logInfo("shutdown", `Received ${signal}, starting graceful shutdown`);
    server.close(() => {
      logInfo("shutdown", "HTTP server closed, draining database pool");
      pool.end().then(() => {
        logInfo("shutdown", "Database pool closed, exiting");
        process.exit(0);
      }).catch((err) => {
        logError("shutdown", "Error closing database pool", {
          error: err instanceof Error ? err.message : String(err)
        });
        process.exit(1);
      });
    });
    setTimeout(() => {
      logWarn("shutdown", "Graceful shutdown timed out after 15s, forcing exit");
      process.exit(1);
    }, 15e3);
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    logInfo("startup", "Database connection verified", {
      latency_ms: Date.now() - dbStart
    });
  } catch (err) {
    logWarn("startup", "Database connection check failed \u2014 server is running but DB may be unavailable", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
})();

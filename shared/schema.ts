import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - supports OAuth and password auth
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"), // Optional for OAuth users
  name: text("name").notNull(),
  authProvider: text("auth_provider").default("email"), // 'email', 'google', 'apple'
  providerId: text("provider_id"), // OAuth provider's user ID
  avatarUrl: text("avatar_url"), // Profile picture from OAuth
  hasVoiceSample: boolean("has_voice_sample").default(false),
  voiceId: text("voice_id"),
  preferredVoiceType: text("preferred_voice_type").default("ai"), // 'personal' or 'ai'
  preferredAiGender: text("preferred_ai_gender").default("female"), // 'male' or 'female'
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  authProvider: true,
  providerId: true,
  avatarUrl: true,
});

export const insertOAuthUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  authProvider: z.enum(["google", "apple"]),
  providerId: z.string(),
  avatarUrl: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Conversations table for chat (from blueprint)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Messages table for chat (from blueprint)
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Affirmation categories (default system categories)
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Custom categories created by users (max 5 per user)
export const customCategories = pgTable("custom_categories", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Affirmations table
export const affirmations = pgTable("affirmations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  script: text("script").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  customCategoryId: integer("custom_category_id").references(() => customCategories.id, { onDelete: "set null" }),
  categoryName: text("category_name"), // Simple text field for category - simpler than foreign keys
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  wordTimings: text("word_timings"), // JSON string of WordTiming[] for RSVP sync
  voiceType: text("voice_type").default("ai"), // 'personal' or 'ai' - which voice was used
  voiceGender: text("voice_gender").default("female"), // 'male' or 'female' for AI voices
  isManual: boolean("is_manual").default(false),
  isFavorite: boolean("is_favorite").default(false),
  playCount: integer("play_count").default(0),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Voice samples for cloning
export const voiceSamples = pgTable("voice_samples", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration"),
  voiceId: text("voice_id"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Auth tokens for mobile authentication (persistent storage)
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Notification settings for daily affirmation reminders
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  morningEnabled: boolean("morning_enabled").default(false),
  morningTime: text("morning_time").default("08:00"), // HH:MM format
  afternoonEnabled: boolean("afternoon_enabled").default(false),
  afternoonTime: text("afternoon_time").default("13:00"),
  eveningEnabled: boolean("evening_enabled").default(false),
  eveningTime: text("evening_time").default("20:00"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Collections for organizing affirmations
export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Junction table for affirmations in collections
export const affirmationCollections = pgTable("affirmation_collections", {
  id: serial("id").primaryKey(),
  affirmationId: integer("affirmation_id").notNull().references(() => affirmations.id, { onDelete: "cascade" }),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  affirmations: many(affirmations),
  voiceSamples: many(voiceSamples),
  collections: many(collections),
  customCategories: many(customCategories),
  notificationSettings: one(notificationSettings),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, { fields: [notificationSettings.userId], references: [users.id] }),
}));

export const customCategoriesRelations = relations(customCategories, ({ one }) => ({
  user: one(users, { fields: [customCategories.userId], references: [users.id] }),
}));

export const affirmationsRelations = relations(affirmations, ({ one, many }) => ({
  user: one(users, { fields: [affirmations.userId], references: [users.id] }),
  category: one(categories, { fields: [affirmations.categoryId], references: [categories.id] }),
  collections: many(affirmationCollections),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  affirmations: many(affirmationCollections),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  affirmations: many(affirmations),
}));

export const voiceSamplesRelations = relations(voiceSamples, ({ one }) => ({
  user: one(users, { fields: [voiceSamples.userId], references: [users.id] }),
}));

export const affirmationCollectionsRelations = relations(affirmationCollections, ({ one }) => ({
  affirmation: one(affirmations, { fields: [affirmationCollections.affirmationId], references: [affirmations.id] }),
  collection: one(collections, { fields: [affirmationCollections.collectionId], references: [collections.id] }),
}));

// Insert schemas
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertAffirmationSchema = createInsertSchema(affirmations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceSampleSchema = createInsertSchema(voiceSamples).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
});

export const insertCustomCategorySchema = createInsertSchema(customCategories).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Affirmation = typeof affirmations.$inferSelect;
export type InsertAffirmation = z.infer<typeof insertAffirmationSchema>;
export type VoiceSample = typeof voiceSamples.$inferSelect;
export type InsertVoiceSample = z.infer<typeof insertVoiceSampleSchema>;
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type CustomCategory = typeof customCategories.$inferSelect;
export type InsertCustomCategory = z.infer<typeof insertCustomCategorySchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

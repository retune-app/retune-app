import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for basic auth
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  hasVoiceSample: boolean("has_voice_sample").default(false),
  voiceId: text("voice_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

// Affirmation categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Affirmations table
export const affirmations = pgTable("affirmations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  script: text("script").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  audioUrl: text("audio_url"),
  duration: integer("duration"),
  isManual: boolean("is_manual").default(false),
  isFavorite: boolean("is_favorite").default(false),
  playCount: integer("play_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Voice samples for cloning
export const voiceSamples = pgTable("voice_samples", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration"),
  voiceId: text("voice_id"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
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
export const usersRelations = relations(users, ({ many }) => ({
  affirmations: many(affirmations),
  voiceSamples: many(voiceSamples),
  collections: many(collections),
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

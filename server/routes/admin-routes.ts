import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { db } from "../db";
import { affirmations, serverErrors, users, journeyCompletions, listeningSessions, breathingSessions, analyticsEvents } from "@shared/schema";
import { eq, desc, sql, gte } from "drizzle-orm";
import { generateSoundEffect } from "../replit_integrations/elevenlabs/client";
import { findInactiveVoices, runVoiceRotation, getVoiceSlotStats } from "../voice-rotation";

const ADMIN_USER_IDS = new Set([
  "77adcd55-7d43-48b2-ab2d-32375c4ea4d5",
]);

interface AudioResult {
  audio: ArrayBuffer;
  duration: number;
  wordTimings: any[];
}

type GenerateAudioFn = (script: string, voiceId: string, isPersonalVoice?: boolean, voiceConfig?: any) => Promise<AudioResult>;
type GetPillarVoiceConfigFn = (pillar?: string | null) => any;

export function registerAdminRoutes(
  app: Express,
  generateAudio: GenerateAudioFn,
  getPillarVoiceConfig: GetPillarVoiceConfigFn,
): void {
  app.post("/api/admin/regenerate-sound/:filename", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const filename = req.params.filename as string;
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      
      const audioDir = path.join(process.cwd(), "assets", "audio");
      const audioBuffer = await generateSoundEffect(prompt, 22, 0.3);
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      res.json({ success: true, filename, bytes: audioBuffer.byteLength });
    } catch (error: any) {
      console.error("Error regenerating sound:", error);
      res.status(500).json({ error: "Failed to regenerate sound", details: error.message });
    }
  });

  app.post("/api/admin/generate-ambient-sounds", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const audioDir = path.join(process.cwd(), "assets", "audio");
      
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
        { filename: "beta-waves.mp3", prompt: "Energizing beta brainwave binaural beat at 18Hz, with subtle ambient background for focus and concentration" },
      ];

      const results: { filename: string; success: boolean; error?: string }[] = [];

      for (const config of soundConfigs) {
        try {
          const audioBuffer = await generateSoundEffect(config.prompt, 22, 0.3);
          
          const filePath = path.join(audioDir, config.filename);
          fs.writeFileSync(filePath, Buffer.from(audioBuffer));
          
          results.push({ filename: config.filename, success: true });
        } catch (error: any) {
          console.error(`Failed to generate ${config.filename}:`, error.message);
          results.push({ filename: config.filename, success: false, error: error.message });
        }
      }

      res.json({ 
        message: "Ambient sound generation complete", 
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      });
    } catch (error: any) {
      console.error("Error generating ambient sounds:", error);
      res.status(500).json({ error: "Failed to generate ambient sounds", details: error.message });
    }
  });

  app.post("/api/admin/generate-sample-audio", async (req: Request, res: Response) => {
    try {
      const { adminKey } = req.body;
      
      if (adminKey !== "generate-sample-audio-2024") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const sampleAffirmations = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.userId, "apple-review-test-account"));
      
      const results: { id: number; title: string; status: string; error?: string }[] = [];
      const audioDir = path.join(process.cwd(), "uploads", "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      for (const affirmation of sampleAffirmations) {
        try {
          if (affirmation.audioUrl) {
            results.push({ id: affirmation.id, title: affirmation.title, status: "skipped - already has audio" });
            continue;
          }
          
          const voiceId = affirmation.aiVoiceId || "hume_lotus";
          
          const audioResult = await generateAudio(affirmation.script, voiceId, false, getPillarVoiceConfig(affirmation.pillar));
          
          const audioFileName = `affirmation-${affirmation.id}-${Date.now()}.mp3`;
          const audioPath = path.join(audioDir, audioFileName);
          fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));
          
          const audioUrl = `/uploads/audio/${audioFileName}`;
          
          await db
            .update(affirmations)
            .set({
              audioUrl,
              duration: audioResult.duration,
              wordTimings: JSON.stringify(audioResult.wordTimings),
              updatedAt: new Date(),
            })
            .where(eq(affirmations.id, affirmation.id));
          
          results.push({ id: affirmation.id, title: affirmation.title, status: "success" });
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err: any) {
          console.error(`Failed to generate audio for ${affirmation.title}:`, err);
          results.push({ id: affirmation.id, title: affirmation.title, status: "error", error: err.message });
        }
      }
      
      res.json({ total: sampleAffirmations.length, results });
    } catch (error: any) {
      console.error("Error generating sample audio:", error);
      res.status(500).json({ error: "Failed to generate sample audio" });
    }
  });

  app.get("/api/admin/voice-slots", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!ADMIN_USER_IDS.has(req.userId!)) {
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

  app.get("/api/admin/voice-rotation/preview", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!ADMIN_USER_IDS.has(req.userId!)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const days = parseInt(req.query.days as string) || 60;
      const inactive = await findInactiveVoices(days);
      res.json({ inactiveDays: days, count: inactive.length, voices: inactive });
    } catch (error) {
      console.error("Error previewing voice rotation:", error);
      res.status(500).json({ error: "Failed to preview voice rotation" });
    }
  });

  app.post("/api/admin/voice-rotation/run", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!ADMIN_USER_IDS.has(req.userId!)) {
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

  app.patch("/api/admin/users/:userId/tts-provider", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(410).json({ error: "TTS provider switching is temporarily disabled. All users use ElevenLabs." });
  });

  app.get("/api/admin/errors", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!ADMIN_USER_IDS.has(req.userId!)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const errors = await db
        .select()
        .from(serverErrors)
        .orderBy(desc(serverErrors.createdAt))
        .limit(limit);
      res.json({ errors, count: errors.length });
    } catch (error) {
      console.error("Error fetching server errors:", error);
      res.status(500).json({ error: "Failed to fetch server errors" });
    }
  });

  app.patch("/api/admin/errors/:id/resolve", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!ADMIN_USER_IDS.has(req.userId!)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const errorId = parseInt(req.params.id as string);
      if (isNaN(errorId)) {
        return res.status(400).json({ error: "Invalid error ID" });
      }
      const [updated] = await db
        .update(serverErrors)
        .set({ resolved: true })
        .where(eq(serverErrors.id, errorId))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Error not found" });
      }
      res.json({ success: true, error: updated });
    } catch (error) {
      console.error("Error resolving server error:", error);
      res.status(500).json({ error: "Failed to resolve error" });
    }
  });

  app.get("/api/admin/backup", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!ADMIN_USER_IDS.has(req.userId!)) {
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
        role: users.role,
      }).from(users);

      const affirmationsData = await db.select().from(affirmations);
      const journeyCompletionsData = await db.select().from(journeyCompletions);
      const listeningSessionsData = await db.select().from(listeningSessions);
      const breathingSessionsData = await db.select().from(breathingSessions);
      const analyticsEventsData = await db.select().from(analyticsEvents);

      res.json({
        timestamp: new Date().toISOString(),
        users: usersData,
        affirmations: affirmationsData,
        journey_completions: journeyCompletionsData,
        listening_sessions: listeningSessionsData,
        breathing_sessions: breathingSessionsData,
        analytics_events: analyticsEventsData,
      });
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });
}

export { ADMIN_USER_IDS };

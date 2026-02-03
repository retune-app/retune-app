import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { affirmations, voiceSamples, categories, users, collections, customCategories, notificationSettings, listeningSessions, breathingSessions, supportRequests } from "@shared/schema";
import { eq, desc, asc, and, sql, sum } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";
import {
  cloneVoice,
  textToSpeech as elevenLabsTTS,
  getElevenLabsClient,
  generateSoundEffect,
  type WordTiming,
} from "./replit_integrations/elevenlabs/client";
import { setupAuth, requireAuth, optionalAuth, AuthenticatedRequest } from "./auth";

// Rate limiters to prevent API abuse
const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 requests per minute for AI generation
  message: { error: "Too many requests. Please wait a minute before generating more affirmations." },
  standardHeaders: true,
  legacyHeaders: false,
});

const voiceCloneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 voice clone attempts per hour
  message: { error: "Too many voice cloning attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 TTS requests per minute
  message: { error: "Too many audio generation requests. Please wait before creating more." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Usage limit constants
const MAX_AI_AFFIRMATIONS_PER_MONTH = 10;
const MAX_VOICE_CLONES_LIFETIME = 2;

// Helper to check and reset monthly limits
async function checkAndResetMonthlyLimits(userId: string): Promise<{
  affirmationsThisMonth: number;
  affirmationsRemaining: number;
  needsReset: boolean;
}> {
  const [user] = await db
    .select({
      affirmationsThisMonth: users.affirmationsThisMonth,
      monthlyResetDate: users.monthlyResetDate,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { affirmationsThisMonth: 0, affirmationsRemaining: MAX_AI_AFFIRMATIONS_PER_MONTH, needsReset: false };
  }

  const now = new Date();
  const resetDate = user.monthlyResetDate ? new Date(user.monthlyResetDate) : now;
  
  // Check if we need to reset (if current month is different from reset month)
  const needsReset = now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear();
  
  if (needsReset) {
    // Reset the counter and update the reset date
    await db
      .update(users)
      .set({
        affirmationsThisMonth: 0,
        monthlyResetDate: now,
      })
      .where(eq(users.id, userId));
    
    return { affirmationsThisMonth: 0, affirmationsRemaining: MAX_AI_AFFIRMATIONS_PER_MONTH, needsReset: true };
  }

  const current = user.affirmationsThisMonth || 0;
  return {
    affirmationsThisMonth: current,
    affirmationsRemaining: Math.max(0, MAX_AI_AFFIRMATIONS_PER_MONTH - current),
    needsReset: false
  };
}

const audioUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `voice-${uniqueSuffix}${path.extname(file.originalname) || ".m4a"}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Generate affirmation script using OpenAI
async function generateScript(goal: string, categories?: string[], length?: string, pillar?: string): Promise<string> {
  const lengthConfig = {
    short: { sentences: 2, tokens: 80, description: "exactly 2 sentences" },
    medium: { sentences: 5, tokens: 200, description: "exactly 5 sentences" },
    long: { sentences: 10, tokens: 400, description: "exactly 10 sentences" },
  };
  
  // Category-specific tone and style instructions
  const categoryTones: Record<string, string> = {
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
    Gratitude: "appreciative, thankful, and abundant language about blessings and appreciation",
  };
  
  // Pillar-specific themes and approaches
  const pillarThemes: Record<string, string> = {
    Mind: "Focus on mental clarity, cognitive strength, emotional intelligence, and psychological resilience. Use language that emphasizes sharp thinking, mental fortitude, and inner calm.",
    Body: "Focus on physical vitality, wellness, self-care, and bodily acceptance. Use language that emphasizes health, energy, rest, and loving your physical self.",
    Spirit: "Focus on inner peace, gratitude, joy, and future vision. Use language that emphasizes spiritual connection, thankfulness, happiness, and aspirational dreaming.",
    Connection: "Focus on meaningful relationships and self-compassion. Use language that emphasizes love, empathy, understanding, and kindness toward self and others.",
    Achievement: "Focus on success, ambition, wealth, and personal growth. Use language that emphasizes accomplishment, abundance, skill mastery, and determined action.",
  };

  const config = lengthConfig[length as keyof typeof lengthConfig] || lengthConfig.medium;
  console.log(`Generating script with length: ${length}, pillar: ${pillar}, categories: ${categories?.join(", ")}, using config:`, config);
  
  // Build combined tone instruction from pillar and subcategories
  let toneInstruction = "Use positive, empowering, and uplifting language.";
  
  // Add pillar-level theme first
  if (pillar && pillarThemes[pillar]) {
    toneInstruction = pillarThemes[pillar];
  }
  
  // Add subcategory nuances
  if (categories && categories.length > 0) {
    const tones = categories
      .map(cat => categoryTones[cat])
      .filter(Boolean);
    if (tones.length > 0) {
      toneInstruction += ` Additionally, weave in these specific elements: ${tones.join("; ")}.`;
    }
  }
  
  const systemPrompt = `Write ${config.sentences} affirmation sentences. First person, present tense. No titles, no instructions, no numbering. Just ${config.sentences} sentences.

TONE AND STYLE: ${toneInstruction}`;

  const pillarContext = pillar ? ` Life pillar: ${pillar}.` : "";
  const categoryContext = categories && categories.length > 0 
    ? ` Focus areas: ${categories.join(", ")}.` 
    : "";
  const userPrompt = `${config.sentences} affirmations for: ${goal}.${pillarContext}${categoryContext} Only ${config.sentences} sentences total.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: config.tokens,
  });

  let script = response.choices[0]?.message?.content || "";
  
  // Clean up any remaining formatting the model might have added
  script = script
    .replace(/^\*\*.*?\*\*\s*/gm, "") // Remove bold titles
    .replace(/^#+\s*.*?\n/gm, "") // Remove markdown headers
    .replace(/\*?\([^)]*\)\*?\s*/g, "") // Remove parenthetical instructions
    .replace(/\[[^\]]*\]\s*/g, "") // Remove bracketed instructions
    .replace(/^\d+\.\s*/gm, "") // Remove numbered lists
    .replace(/^\s*\n/gm, "") // Remove empty lines
    .trim();
  
  // Enforce sentence limit by truncating if needed
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > config.sentences) {
    script = sentences.slice(0, config.sentences).join(" ").trim();
  }
  
  return script;
}

// Auto-generate title from affirmation script
async function autoGenerateTitle(script: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a title generator for affirmations. Create a short, inspiring title (3-6 words) that captures the essence of the affirmation. 
The title should be motivational and concise. Do NOT include quotation marks.
Respond with ONLY the title, nothing else.`,
        },
        {
          role: "user",
          content: script,
        },
      ],
      temperature: 0.7,
      max_tokens: 30,
    });

    return response.choices[0]?.message?.content?.trim() || "My Affirmation";
  } catch (error) {
    console.error("Auto-title generation failed:", error);
    return "My Affirmation";
  }
}

// Auto-categorize affirmation based on content
async function autoCategorizе(text: string): Promise<string> {
  const validCategories = ["Career", "Health", "Confidence", "Wealth", "Relationships", "Sleep"];
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a categorization assistant. Analyze the given text and categorize it into exactly one of these categories: ${validCategories.join(", ")}. 
Respond with ONLY the category name, nothing else.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 20,
    });

    const category = response.choices[0]?.message?.content?.trim() || "Confidence";
    
    // Validate category
    if (validCategories.includes(category)) {
      return category;
    }
    
    // Find closest match
    const lowerCategory = category.toLowerCase();
    for (const valid of validCategories) {
      if (valid.toLowerCase().includes(lowerCategory) || lowerCategory.includes(valid.toLowerCase())) {
        return valid;
      }
    }
    
    return "Confidence"; // Default fallback
  } catch (error) {
    console.error("Auto-categorization failed:", error);
    return "Confidence"; // Default fallback
  }
}

// Simple audio generation for voice previews (no word timings needed)
async function generateAudioSimple(text: string, voiceId: string): Promise<ArrayBuffer> {
  try {
    const client = await getElevenLabsClient();
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      model_id: "eleven_multilingual_v2",
    });
    
    // Collect chunks into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audio) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).buffer;
  } catch (error) {
    console.error("Simple TTS failed:", error);
    throw error;
  }
}

// Generate audio using ElevenLabs or fallback to OpenAI
async function generateAudio(
  script: string,
  voiceId?: string
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  try {
    // Try ElevenLabs first (for cloned voices or better quality)
    console.log("Attempting ElevenLabs TTS with voiceId:", voiceId);
    const result = await elevenLabsTTS(script, voiceId);
    console.log("ElevenLabs TTS succeeded with", result.wordTimings?.length || 0, "word timings");
    return result;
  } catch (error) {
    console.error("ElevenLabs TTS failed, falling back to OpenAI:", error);
    
    // Fallback to OpenAI TTS if ElevenLabs fails
    // Note: OpenAI TTS doesn't provide word-level timestamps, so we generate approximate timings
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: script,
    });

    const audioBuffer = await response.arrayBuffer();
    const words = script.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);
    
    // Generate approximate word timings based on word length (no real timing data from OpenAI)
    const avgWordDurationMs = (estimatedDuration * 1000) / wordCount;
    const wordTimings: WordTiming[] = words.map((word, index) => ({
      word,
      startMs: Math.round(index * avgWordDurationMs),
      endMs: Math.round((index + 1) * avgWordDurationMs),
    }));

    return {
      audio: audioBuffer,
      duration: estimatedDuration,
      wordTimings,
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Handle OPTIONS preflight for audio files (CORS)
  app.options("/uploads/audio/:filename", (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Encoding');
    res.status(204).end();
  });

  // Serve uploaded audio files (public access with security validations)
  // Audio files use random filenames making them hard to guess
  // Security is enforced through: filename pattern validation + path traversal prevention
  app.get("/uploads/audio/:filename", async (req: Request, res: Response) => {
    try {
      const rawFilename = req.params.filename;
      
      // SECURITY: Sanitize filename to prevent path traversal attacks (e.g., ../../etc/passwd)
      const filename = path.basename(rawFilename);
      
      // SECURITY: Reject any filename that doesn't match expected pattern
      if (!/^(affirmation|voice)-\d+(-\d+)?\.(mp3|m4a|wav|webm)$/.test(filename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }
      
      const audioDir = path.join(uploadDir, "audio");
      const filePath = path.join(audioDir, filename);
      
      // SECURITY: Verify resolved path is within uploads directory (defense in depth)
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(uploadDir);
      if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
        console.log(`SECURITY: Path traversal attempt blocked: ${rawFilename}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Set CORS headers for mobile audio playback (especially iOS AVPlayer)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Encoding');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Set appropriate content type based on extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.wav': 'audio/wav',
        '.webm': 'audio/webm',
      };
      if (contentTypes[ext]) {
        res.setHeader('Content-Type', contentTypes[ext]);
      }
      
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Get all categories
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get all affirmations for the authenticated user
  app.get("/api/affirmations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allAffirmations = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.userId, req.userId!))
        .orderBy(asc(affirmations.displayOrder), desc(affirmations.createdAt));
      res.json(allAffirmations);
    } catch (error) {
      console.error("Error fetching affirmations:", error);
      res.status(500).json({ error: "Failed to fetch affirmations" });
    }
  });

  // Get single affirmation (must belong to user)
  app.get("/api/affirmations/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(and(
          eq(affirmations.id, parseInt(id)),
          eq(affirmations.userId, req.userId!)
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

  // Generate script using AI (requires auth) - Limited to MAX_AI_AFFIRMATIONS_PER_MONTH per month
  // Rate limited: max 5 requests per minute
  app.post("/api/affirmations/generate-script", requireAuth, aiGenerationLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { goal, pillar, categories, category, length } = req.body;

      if (!goal) {
        return res.status(400).json({ error: "Goal is required" });
      }

      // Check monthly usage limit for AI-generated affirmations
      const limits = await checkAndResetMonthlyLimits(req.userId!);
      
      if (limits.affirmationsRemaining <= 0) {
        return res.status(429).json({
          error: `Monthly AI affirmation limit reached. Maximum ${MAX_AI_AFFIRMATIONS_PER_MONTH} AI-generated affirmations per month.`,
          limit: MAX_AI_AFFIRMATIONS_PER_MONTH,
          used: limits.affirmationsThisMonth,
          remaining: 0,
          message: "You can still create manual affirmations or wait until next month."
        });
      }

      // Support both old single category and new multi-category format
      const categoryList = categories || (category ? [category] : []);
      const script = await generateScript(goal, categoryList, length, pillar);
      
      // Increment usage counter after successful generation
      await db
        .update(users)
        .set({
          affirmationsThisMonth: (limits.affirmationsThisMonth + 1)
        })
        .where(eq(users.id, req.userId!));

      res.json({ 
        script,
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

  // Create affirmation with voice synthesis (requires auth)
  // Rate limited: max 10 TTS requests per minute
  app.post("/api/affirmations/create-with-voice", requireAuth, ttsLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, script, pillar, categories, category, isManual } = req.body;

      if (!script) {
        return res.status(400).json({ error: "Script is required" });
      }

      // Support both old single category and new multi-category format
      let categoryName: string | null = null;
      if (categories && Array.isArray(categories) && categories.length > 0) {
        categoryName = categories.join(",");
      } else if (category) {
        categoryName = category;
      }

      console.log("Saving affirmation with pillar:", pillar, "categories:", categoryName);

      // Get user's voice preferences and voice sample
      const [userWithPrefs] = await db
        .select({
          voiceId: users.voiceId,
          hasVoiceSample: users.hasVoiceSample,
          preferredVoiceType: users.preferredVoiceType,
          preferredAiGender: users.preferredAiGender,
          preferredMaleVoiceId: users.preferredMaleVoiceId,
          preferredFemaleVoiceId: users.preferredFemaleVoiceId,
        })
        .from(users)
        .where(eq(users.id, req.userId!));

      // Determine which voice ID to use based on preferences
      let voiceIdToUse: string | undefined;
      let usedPersonalVoice = false;
      let usedGender = userWithPrefs?.preferredAiGender || "female";

      if (userWithPrefs?.preferredVoiceType === "personal" && userWithPrefs?.voiceId && userWithPrefs?.hasVoiceSample) {
        // Use personal cloned voice
        voiceIdToUse = userWithPrefs.voiceId;
        usedPersonalVoice = true;
        console.log("Using personal voice:", voiceIdToUse);
      } else {
        // Use AI voice based on gender preference
        console.log("Voice preferences loaded:", {
          preferredMaleVoiceId: userWithPrefs?.preferredMaleVoiceId,
          preferredFemaleVoiceId: userWithPrefs?.preferredFemaleVoiceId,
          preferredAiGender: userWithPrefs?.preferredAiGender
        });
        if (usedGender === "male") {
          voiceIdToUse = userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id;
        } else {
          voiceIdToUse = userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
        }
        console.log("Using AI voice:", voiceIdToUse, "for gender:", usedGender);
      }

      // Generate audio with word timings
      const audioResult = await generateAudio(
        script,
        voiceIdToUse
      );

      // Save audio file to the audio subdirectory
      const audioDir = path.join(uploadDir, "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      const audioFilename = `affirmation-${Date.now()}.mp3`;
      const audioPath = path.join(audioDir, audioFilename);
      fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));

      // Create affirmation record (associated with user)
      const [newAffirmation] = await db
        .insert(affirmations)
        .values({
          userId: req.userId!,
          title: title || "My Affirmation",
          script,
          pillar: pillar || null,
          categoryName: categoryName || null,
          audioUrl: `/uploads/audio/${audioFilename}`,
          duration: audioResult.duration,
          wordTimings: JSON.stringify(audioResult.wordTimings),
          isManual: isManual || false,
          voiceType: usedPersonalVoice ? "personal" : "ai",
          voiceGender: usedPersonalVoice ? null : usedGender,
          aiVoiceId: usedPersonalVoice ? null : voiceIdToUse,
        })
        .returning();

      res.json(newAffirmation);
    } catch (error) {
      console.error("Error creating affirmation:", error);
      res.status(500).json({ error: "Failed to create affirmation" });
    }
  });

  // Delete affirmation (requires auth, must belong to user)
  app.delete("/api/affirmations/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the affirmation to delete the audio file (ensure it belongs to user)
      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(and(
          eq(affirmations.id, parseInt(id)),
          eq(affirmations.userId, req.userId!)
        ));
      
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      
      // Delete audio file if exists (with path sanitization)
      if (affirmation.audioUrl) {
        // SECURITY: Extract just the filename and validate it
        const filename = path.basename(affirmation.audioUrl);
        
        // SECURITY: Verify filename matches expected pattern before deletion
        if (/^(affirmation|voice)-\d+(-\d+)?\.(mp3|m4a|wav|webm)$/.test(filename)) {
          const audioPath = path.join(uploadDir, filename);
          
          // SECURITY: Verify resolved path is within uploads directory
          const resolvedPath = path.resolve(audioPath);
          const resolvedUploadDir = path.resolve(uploadDir);
          
          if (resolvedPath.startsWith(resolvedUploadDir + path.sep) && fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
            console.log(`SECURE DELETE: Removed audio file ${filename}`);
          }
        } else {
          console.log(`SECURITY: Skipped deletion of invalid filename pattern: ${affirmation.audioUrl}`);
        }
      }
      
      // Delete from database
      await db
        .delete(affirmations)
        .where(eq(affirmations.id, parseInt(id)));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting affirmation:", error);
      res.status(500).json({ error: "Failed to delete affirmation" });
    }
  });

  // Update favorite status (requires auth, must belong to user)
  app.patch("/api/affirmations/:id/favorite", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { isFavorite } = req.body;

      const [updated] = await db
        .update(affirmations)
        .set({ isFavorite, updatedAt: new Date() })
        .where(and(
          eq(affirmations.id, parseInt(id)),
          eq(affirmations.userId, req.userId!)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating favorite:", error);
      res.status(500).json({ error: "Failed to update favorite" });
    }
  });

  // Rename affirmation (requires auth, must belong to user)
  app.patch("/api/affirmations/:id/rename", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }

      const [updated] = await db
        .update(affirmations)
        .set({ title: title.trim(), updatedAt: new Date() })
        .where(and(
          eq(affirmations.id, parseInt(id)),
          eq(affirmations.userId, req.userId!)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error renaming affirmation:", error);
      res.status(500).json({ error: "Failed to rename affirmation" });
    }
  });

  // Auto-save affirmation with AI-generated title and category (requires auth)
  app.post("/api/affirmations/:id/auto-save", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(and(
          eq(affirmations.id, parseInt(id)),
          eq(affirmations.userId, req.userId!)
        ));

      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      const script = affirmation.script || affirmation.title || "";
      
      // Only auto-categorize if no category is set
      const hasCategory = affirmation.categoryName;
      
      // Generate AI title and category in parallel
      const [generatedTitle, newCategoryName] = await Promise.all([
        autoGenerateTitle(script),
        hasCategory ? Promise.resolve(null) : autoCategorizе(script),
      ]);

      // Update the affirmation - only set categoryName if not already set
      const [updated] = await db
        .update(affirmations)
        .set({
          title: generatedTitle,
          ...(hasCategory ? {} : { categoryName: newCategoryName }),
          updatedAt: new Date(),
        })
        .where(eq(affirmations.id, parseInt(id)))
        .returning();

      console.log(`Auto-saved affirmation ${id}: title="${generatedTitle}", categoryName=${updated.categoryName}`);
      res.json(updated);
    } catch (error) {
      console.error("Error auto-saving affirmation:", error);
      res.status(500).json({ error: "Failed to auto-save affirmation" });
    }
  });

  // Increment play count and record listening session (requires auth)
  app.post("/api/affirmations/:id/play", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { durationSeconds } = req.body || {};

      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(and(
          eq(affirmations.id, parseInt(id)),
          eq(affirmations.userId, req.userId!)
        ));

      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      // Update play count
      const [updated] = await db
        .update(affirmations)
        .set({
          playCount: (affirmation.playCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(affirmations.id, parseInt(id)))
        .returning();

      // Record listening session for analytics
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
      await db.insert(listeningSessions).values({
        userId: req.userId!,
        affirmationId: parseInt(id),
        durationSeconds: durationSeconds || Math.round((affirmation.duration || 0) / 1000),
        dateKey,
      });
      
      console.log(`Recorded listening session for user ${req.userId}, affirmation ${id}, date ${dateKey}`);

      res.json(updated);
    } catch (error) {
      console.error("Error updating play count:", error);
      res.status(500).json({ error: "Failed to update play count" });
    }
  });

  // Upload voice sample and clone voice (requires auth)
  // Max 2 voice clones per user lifetime
  // Rate limited: max 3 attempts per hour
  const MAX_VOICE_CLONES = 2;
  
  app.post(
    "/api/voice-samples",
    requireAuth,
    voiceCloneLimiter,
    audioUpload.single("audio"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        // Check user's voice clone limit
        const [user] = await db
          .select({ voiceClonesUsed: users.voiceClonesUsed, hasConsentedToVoiceCloning: users.hasConsentedToVoiceCloning })
          .from(users)
          .where(eq(users.id, req.userId!))
          .limit(1);

        if (!user) {
          // Clean up uploaded file
          fs.unlink(file.path, () => {});
          return res.status(404).json({ error: "User not found" });
        }

        // Verify consent before cloning
        if (!user.hasConsentedToVoiceCloning) {
          fs.unlink(file.path, () => {});
          return res.status(403).json({ error: "Voice cloning consent required. Please accept the voice cloning terms first." });
        }

        // Check usage limit
        const clonesUsed = user.voiceClonesUsed || 0;
        if (clonesUsed >= MAX_VOICE_CLONES) {
          // Clean up uploaded file immediately
          fs.unlink(file.path, () => {});
          return res.status(429).json({ 
            error: `Voice clone limit reached. Maximum ${MAX_VOICE_CLONES} voice clones allowed.`,
            limit: MAX_VOICE_CLONES,
            used: clonesUsed
          });
        }

        // Create voice sample record (associated with user) - no audioUrl stored for privacy
        const [sample] = await db
          .insert(voiceSamples)
          .values({
            userId: req.userId!,
            audioUrl: "processing", // Don't store actual path for privacy
            status: "processing",
          })
          .returning();

        // Clone voice with ElevenLabs
        try {
          const voiceId = await cloneVoice(file.path, "My Affirmation Voice");

          // PRIVACY: Delete the voice sample file immediately after successful cloning
          fs.unlink(file.path, (err) => {
            if (err) console.error("Failed to delete voice sample file:", err);
            else console.log("Voice sample file deleted for privacy:", file.filename);
          });

          // Update sample with voice ID (audioUrl cleared for privacy)
          const [updatedSample] = await db
            .update(voiceSamples)
            .set({ voiceId, status: "ready", audioUrl: null })
            .where(eq(voiceSamples.id, sample.id))
            .returning();

          // Update user: voiceId, hasVoiceSample, auto-switch to personal voice, and increment clones used
          await db
            .update(users)
            .set({ 
              voiceId, 
              hasVoiceSample: true, 
              preferredVoiceType: "personal",
              voiceClonesUsed: (clonesUsed + 1)
            })
            .where(eq(users.id, req.userId!));

          res.json({
            ...updatedSample,
            clonesRemaining: MAX_VOICE_CLONES - (clonesUsed + 1)
          });
        } catch (cloneError) {
          console.error("Voice cloning error:", cloneError);

          // PRIVACY: Delete file even on failure
          fs.unlink(file.path, () => {});

          // Update status to failed
          await db
            .update(voiceSamples)
            .set({ status: "failed", audioUrl: null })
            .where(eq(voiceSamples.id, sample.id));

          res.status(500).json({ error: "Voice cloning failed. Please ensure your recording is at least 30 seconds." });
        }
      } catch (error) {
        console.error("Error uploading voice sample:", error);
        res.status(500).json({ error: "Failed to upload voice sample" });
      }
    }
  );

  // Get user's voice sample status (requires auth)
  app.get("/api/voice-samples/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [sample] = await db
        .select()
        .from(voiceSamples)
        .where(eq(voiceSamples.userId, req.userId!))
        .orderBy(desc(voiceSamples.createdAt))
        .limit(1);

      // Also check user's voiceId field directly
      const [user] = await db
        .select({ voiceId: users.voiceId })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);

      const hasClonedVoice = !!(sample?.status === "ready" && sample?.voiceId) || !!user?.voiceId;

      res.json({
        hasVoiceSample: !!sample && sample.status === "ready",
        hasClonedVoice,
        hasPersonalVoice: hasClonedVoice,
        status: sample?.status || null,
      });
    } catch (error) {
      console.error("Error fetching voice sample status:", error);
      res.status(500).json({ error: "Failed to fetch voice sample status" });
    }
  });

  // AI Voice options - expanded selection from ElevenLabs
  const VOICE_OPTIONS = {
    female: [
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Mature, reassuring, confident" },
      { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", description: "Enthusiastic, quirky" },
      { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Clear, engaging, British" },
      { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Knowledgeable, professional" },
      { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", description: "Playful, bright, warm" },
      { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", description: "Professional, warm" },
      { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Velvety, British actress" },
      { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Soft, warm tone (legacy)" },
      { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Warm, British (legacy)" },
    ],
    male: [
      { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", description: "Laid-back, casual, resonant" },
      { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Deep, confident, Australian" },
      { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm, captivating storyteller, British" },
      { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Energetic, social media creator" },
      { id: "bIHbv24MWmeRgasZH58o", name: "Will", description: "Relaxed, optimistic" },
      { id: "cjVigY5qzO86Huf0OWal", name: "Eric", description: "Smooth, trustworthy" },
      { id: "iP95p4xoKVk53GoZ742B", name: "Chris", description: "Charming, down-to-earth" },
      { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Deep, resonant, comforting" },
      { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Steady, professional, British" },
      { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Dominant, firm" },
      { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", description: "Wise, mature, balanced" },
      { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Warm, friendly (legacy)" },
    ],
  };

  // Get available AI voices
  app.get("/api/voices", async (req: Request, res: Response) => {
    res.json(VOICE_OPTIONS);
  });

  // Preview phrase for voice testing
  const PREVIEW_PHRASE = "I am strong, capable, and worthy of success.";

  // Generate voice preview audio
  app.post("/api/voices/preview", async (req: Request, res: Response) => {
    try {
      const { voiceId } = req.body;

      if (!voiceId) {
        return res.status(400).json({ error: "Voice ID is required" });
      }

      // Validate the voice ID exists in our options
      const allVoices = [...VOICE_OPTIONS.female, ...VOICE_OPTIONS.male];
      const validVoice = allVoices.find(v => v.id === voiceId);
      if (!validVoice) {
        return res.status(400).json({ error: "Invalid voice ID" });
      }

      console.log(`Generating voice preview for ${validVoice.name} (${voiceId})`);

      // Generate TTS without timestamps (simpler, faster)
      const audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, voiceId);

      // Return audio as base64
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({ 
        audio: base64Audio,
        voiceName: validVoice.name,
      });
    } catch (error) {
      console.error("Error generating voice preview:", error);
      res.status(500).json({ error: "Failed to generate voice preview" });
    }
  });

  // Generate preview using user's personal cloned voice
  app.post("/api/voices/preview-personal", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get user's cloned voice ID
      const [user] = await db
        .select({
          voiceId: users.voiceId,
          hasVoiceSample: users.hasVoiceSample,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, req.userId!));

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.voiceId || !user.hasVoiceSample) {
        return res.status(400).json({ error: "No personal voice recorded. Please record your voice first." });
      }

      console.log(`Generating personal voice preview for user ${user.name} (voice: ${user.voiceId})`);

      // Generate TTS using user's cloned voice
      const audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, user.voiceId);

      // Return audio as base64
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({ 
        audio: base64Audio,
        voiceName: "My Voice",
      });
    } catch (error) {
      console.error("Error generating personal voice preview:", error);
      res.status(500).json({ error: "Failed to generate personal voice preview" });
    }
  });

  // Get user's voice preferences
  app.get("/api/voice-preferences", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [user] = await db
        .select({
          preferredVoiceType: users.preferredVoiceType,
          preferredAiGender: users.preferredAiGender,
          preferredMaleVoiceId: users.preferredMaleVoiceId,
          preferredFemaleVoiceId: users.preferredFemaleVoiceId,
          hasVoiceSample: users.hasVoiceSample,
          voiceId: users.voiceId,
        })
        .from(users)
        .where(eq(users.id, req.userId!));

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        preferredVoiceType: user.preferredVoiceType || "ai",
        preferredAiGender: user.preferredAiGender || "female",
        preferredMaleVoiceId: user.preferredMaleVoiceId || "ErXwobaYiN019PkySvjV",
        preferredFemaleVoiceId: user.preferredFemaleVoiceId || "21m00Tcm4TlvDq8ikWAM",
        hasPersonalVoice: !!user.hasVoiceSample && !!user.voiceId,
      });
    } catch (error) {
      console.error("Error fetching voice preferences:", error);
      res.status(500).json({ error: "Failed to fetch voice preferences" });
    }
  });

  // Update user's voice preferences
  app.put("/api/voice-preferences", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { preferredVoiceType, preferredAiGender, preferredMaleVoiceId, preferredFemaleVoiceId } = req.body;

      const updates: Record<string, string> = {};
      
      if (preferredVoiceType && ["personal", "ai"].includes(preferredVoiceType)) {
        updates.preferredVoiceType = preferredVoiceType;
      }
      
      if (preferredAiGender && ["male", "female"].includes(preferredAiGender)) {
        updates.preferredAiGender = preferredAiGender;
      }

      // Validate and set male voice ID
      if (preferredMaleVoiceId) {
        const validMaleVoice = VOICE_OPTIONS.male.find(v => v.id === preferredMaleVoiceId);
        if (validMaleVoice) {
          updates.preferredMaleVoiceId = preferredMaleVoiceId;
        }
      }

      // Validate and set female voice ID
      if (preferredFemaleVoiceId) {
        const validFemaleVoice = VOICE_OPTIONS.female.find(v => v.id === preferredFemaleVoiceId);
        if (validFemaleVoice) {
          updates.preferredFemaleVoiceId = preferredFemaleVoiceId;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid preferences provided" });
      }

      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, req.userId!));

      res.json({ success: true, ...updates });
    } catch (error) {
      console.error("Error updating voice preferences:", error);
      res.status(500).json({ error: "Failed to update voice preferences" });
    }
  });

  // Regenerate affirmation audio with different voice
  app.post("/api/affirmations/:id/regenerate-voice", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const affirmationId = parseInt(req.params.id, 10);
      const { voiceType, voiceGender } = req.body;

      if (!voiceType || !["personal", "ai"].includes(voiceType)) {
        return res.status(400).json({ error: "Invalid voice type. Must be 'personal' or 'ai'" });
      }

      if (voiceType === "ai" && voiceGender && !["male", "female"].includes(voiceGender)) {
        return res.status(400).json({ error: "Invalid voice gender. Must be 'male' or 'female'" });
      }

      // Get the affirmation
      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(and(eq(affirmations.id, affirmationId), eq(affirmations.userId, req.userId!)));

      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      // Determine which voice ID to use
      let voiceIdToUse: string | undefined;
      
      if (voiceType === "personal") {
        // Get user's cloned voice
        const [user] = await db
          .select({ voiceId: users.voiceId, hasVoiceSample: users.hasVoiceSample })
          .from(users)
          .where(eq(users.id, req.userId!));

        if (!user?.voiceId || !user?.hasVoiceSample) {
          return res.status(400).json({ 
            error: "No personal voice available. Please record a voice sample first." 
          });
        }
        voiceIdToUse = user.voiceId;
      } else {
        // Use AI voice based on gender - get user's preferred voice for that gender
        const gender = voiceGender || "female";
        const [userPrefs] = await db
          .select({
            preferredMaleVoiceId: users.preferredMaleVoiceId,
            preferredFemaleVoiceId: users.preferredFemaleVoiceId,
          })
          .from(users)
          .where(eq(users.id, req.userId!));
        
        if (gender === "male") {
          voiceIdToUse = userPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id;
        } else {
          voiceIdToUse = userPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
        }
      }

      // Generate new audio
      const audioResult = await generateAudio(affirmation.script, voiceIdToUse);
      
      // Save audio to file
      const audioDir = path.join(process.cwd(), "uploads", "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      
      const audioFileName = `affirmation-${affirmationId}-${Date.now()}.mp3`;
      const audioPath = path.join(audioDir, audioFileName);
      fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));
      
      const audioUrl = `/uploads/audio/${audioFileName}`;

      // Update affirmation with new audio
      await db
        .update(affirmations)
        .set({
          audioUrl,
          duration: audioResult.duration,
          wordTimings: JSON.stringify(audioResult.wordTimings),
          voiceType,
          voiceGender: voiceType === "ai" ? (voiceGender || "female") : null,
          aiVoiceId: voiceType === "ai" ? voiceIdToUse : null,
          updatedAt: new Date(),
        })
        .where(eq(affirmations.id, affirmationId));

      // Fetch updated affirmation
      const [updated] = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.id, affirmationId));

      res.json(updated);
    } catch (error) {
      console.error("Error regenerating voice:", error);
      res.status(500).json({ error: "Failed to regenerate voice" });
    }
  });

  // Get user's custom categories (requires auth)
  app.get("/api/custom-categories", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userCustomCategories = await db
        .select()
        .from(customCategories)
        .where(eq(customCategories.userId, req.userId!))
        .orderBy(asc(customCategories.createdAt));
      
      res.json(userCustomCategories);
    } catch (error) {
      console.error("Error fetching custom categories:", error);
      res.status(500).json({ error: "Failed to fetch custom categories" });
    }
  });

  // Create a custom category (requires auth, max 5 per user)
  app.post("/api/custom-categories", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Category name is required" });
      }
      
      const trimmedName = name.trim();
      
      if (trimmedName.length > 30) {
        return res.status(400).json({ error: "Category name must be 30 characters or less" });
      }
      
      // Check current count
      const existingCategories = await db
        .select()
        .from(customCategories)
        .where(eq(customCategories.userId, req.userId!));
      
      if (existingCategories.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 custom categories allowed" });
      }
      
      // Check for duplicate name (case insensitive)
      const duplicateName = existingCategories.find(
        c => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        return res.status(400).json({ error: "A category with this name already exists" });
      }
      
      // Also check against default categories
      const defaultCategories = await db.select().from(categories);
      const duplicateDefault = defaultCategories.find(
        c => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateDefault) {
        return res.status(400).json({ error: "This category already exists as a default category" });
      }
      
      const [newCategory] = await db
        .insert(customCategories)
        .values({
          userId: req.userId!,
          name: trimmedName,
        })
        .returning();
      
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating custom category:", error);
      res.status(500).json({ error: "Failed to create custom category" });
    }
  });

  // Delete a custom category (requires auth)
  app.delete("/api/custom-categories/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id);
      
      if (isNaN(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
      
      // Verify ownership
      const [category] = await db
        .select()
        .from(customCategories)
        .where(and(
          eq(customCategories.id, categoryId),
          eq(customCategories.userId, req.userId!)
        ));
      
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      await db
        .delete(customCategories)
        .where(eq(customCategories.id, categoryId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom category:", error);
      res.status(500).json({ error: "Failed to delete custom category" });
    }
  });

  // Get user stats (requires auth)
  app.get("/api/user/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allAffirmations = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.userId, req.userId!));

      const totalListens = allAffirmations.reduce(
        (sum, a) => sum + (a.playCount || 0),
        0
      );

      // Get all listening sessions for this user
      const sessions = await db
        .select()
        .from(listeningSessions)
        .where(eq(listeningSessions.userId, req.userId!))
        .orderBy(desc(listeningSessions.completedAt));

      // Calculate streak - consecutive days with activity
      const uniqueDates = [...new Set(sessions.map(s => s.dateKey))].sort().reverse();
      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      // Check if most recent activity was today or yesterday
      if (uniqueDates.length > 0 && (uniqueDates[0] === today || uniqueDates[0] === yesterday)) {
        streak = 1;
        let checkDate = new Date(uniqueDates[0]);
        
        for (let i = 1; i < uniqueDates.length; i++) {
          const prevDay = new Date(checkDate.getTime() - 86400000).toISOString().split('T')[0];
          if (uniqueDates[i] === prevDay) {
            streak++;
            checkDate = new Date(uniqueDates[i]);
          } else {
            break;
          }
        }
      }

      // Calculate best streak ever (longest consecutive run in history)
      let bestStreak = 0;
      if (uniqueDates.length > 0) {
        let currentRun = 1;
        const sortedDates = [...uniqueDates].sort(); // ascending order
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
          if (diffDays === 1) {
            currentRun++;
          } else {
            bestStreak = Math.max(bestStreak, currentRun);
            currentRun = 1;
          }
        }
        bestStreak = Math.max(bestStreak, currentRun);
      }

      // Calculate weekly data (last 7 days)
      const weeklyData: { day: string; minutes: number; date: string }[] = [];
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000);
        const dateKey = date.toISOString().split('T')[0];
        const dayName = dayNames[date.getDay()];
        
        const daySessions = sessions.filter(s => s.dateKey === dateKey);
        const totalSeconds = daySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
        
        weeklyData.push({
          day: dayName,
          minutes: Math.round(totalSeconds / 60),
          date: dateKey,
        });
      }

      const totalMinutesThisWeek = weeklyData.reduce((sum, d) => sum + d.minutes, 0);

      // Today's minutes
      const todaySessions = sessions.filter(s => s.dateKey === today);
      const minutesToday = Math.round(todaySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60);

      // Lifetime total minutes
      const lifetimeMinutes = Math.round(sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60);

      // Category breakdown (by play count from affirmations)
      const categoryBreakdown: { category: string; listens: number; minutes: number }[] = [];
      const categoryMap = new Map<string, { listens: number; minutes: number }>();
      
      for (const aff of allAffirmations) {
        const cat = aff.categoryName || 'Uncategorized';
        const existing = categoryMap.get(cat) || { listens: 0, minutes: 0 };
        existing.listens += aff.playCount || 0;
        // Estimate minutes based on duration
        existing.minutes += Math.round(((aff.duration || 0) / 1000 / 60) * (aff.playCount || 0));
        categoryMap.set(cat, existing);
      }
      
      categoryMap.forEach((value, key) => {
        categoryBreakdown.push({ category: key, ...value });
      });
      categoryBreakdown.sort((a, b) => b.listens - a.listens);

      // Get breathing/meditation sessions for additional KPIs
      const breathingSessionsData = await db
        .select()
        .from(breathingSessions)
        .where(eq(breathingSessions.userId, req.userId!))
        .orderBy(desc(breathingSessions.completedAt));

      // Breathing stats
      const breathingUniqueDates = [...new Set(breathingSessionsData.map(s => s.dateKey))].sort().reverse();
      
      // Calculate breathing streak
      let breathingStreak = 0;
      if (breathingUniqueDates.length > 0 && (breathingUniqueDates[0] === today || breathingUniqueDates[0] === yesterday)) {
        breathingStreak = 1;
        let checkDate = new Date(breathingUniqueDates[0]);
        
        for (let i = 1; i < breathingUniqueDates.length; i++) {
          const prevDay = new Date(checkDate.getTime() - 86400000).toISOString().split('T')[0];
          if (breathingUniqueDates[i] === prevDay) {
            breathingStreak++;
            checkDate = new Date(breathingUniqueDates[i]);
          } else {
            break;
          }
        }
      }

      // Best breathing streak
      let bestBreathingStreak = 0;
      if (breathingUniqueDates.length > 0) {
        let currentRun = 1;
        const sortedBreathingDates = [...breathingUniqueDates].sort();
        for (let i = 1; i < sortedBreathingDates.length; i++) {
          const prevDate = new Date(sortedBreathingDates[i - 1]);
          const currDate = new Date(sortedBreathingDates[i]);
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000);
          if (diffDays === 1) {
            currentRun++;
          } else {
            bestBreathingStreak = Math.max(bestBreathingStreak, currentRun);
            currentRun = 1;
          }
        }
        bestBreathingStreak = Math.max(bestBreathingStreak, currentRun);
      }

      // Weekly breathing data
      const breathingWeeklyData: { day: string; minutes: number; date: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000);
        const dateKey = date.toISOString().split('T')[0];
        const dayName = dayNames[date.getDay()];
        
        const daySessions = breathingSessionsData.filter(s => s.dateKey === dateKey);
        const totalSeconds = daySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
        
        breathingWeeklyData.push({
          day: dayName,
          minutes: Math.round(totalSeconds / 60),
          date: dateKey,
        });
      }

      const breathingMinutesThisWeek = breathingWeeklyData.reduce((sum, d) => sum + d.minutes, 0);
      
      // Today's breathing minutes
      const todayBreathingSessions = breathingSessionsData.filter(s => s.dateKey === today);
      const breathingMinutesToday = Math.round(todayBreathingSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60);
      
      // Lifetime breathing minutes
      const lifetimeBreathingMinutes = Math.round(breathingSessionsData.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60);

      // Total mindful minutes (affirmations + breathing)
      const totalMindfulMinutesToday = minutesToday + breathingMinutesToday;
      const totalMindfulMinutesWeek = totalMinutesThisWeek + breathingMinutesThisWeek;
      const totalMindfulMinutesLifetime = lifetimeMinutes + lifetimeBreathingMinutes;

      // Technique breakdown for breathing
      const techniqueBreakdown: { technique: string; sessions: number; minutes: number }[] = [];
      const techniqueMap = new Map<string, { sessions: number; minutes: number }>();
      
      for (const session of breathingSessionsData) {
        const tech = session.techniqueId || 'unknown';
        const existing = techniqueMap.get(tech) || { sessions: 0, minutes: 0 };
        existing.sessions += 1;
        existing.minutes += Math.round(session.durationSeconds / 60);
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
          techniqueBreakdown,
        },
        // Combined mindful stats
        mindfulMinutes: {
          today: totalMindfulMinutesToday,
          thisWeek: totalMindfulMinutesWeek,
          lifetime: totalMindfulMinutesLifetime,
        },
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  // Get categories
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Create sample affirmations for user (requires auth)
  app.post("/api/affirmations/samples", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user already has affirmations
      const existingAffirmations = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.userId, req.userId!))
        .limit(1);

      if (existingAffirmations.length > 0) {
        return res.json({ message: "User already has affirmations", created: 0 });
      }

      // Sample affirmation scripts
      const sampleAffirmations = [
        {
          title: "Morning Confidence",
          script: "I am confident, capable, and ready to embrace today. Every challenge is an opportunity for growth. I trust myself and my abilities. I am worthy of success and happiness.",
          categoryId: 3, // Confidence
        },
        {
          title: "Abundance Mindset",
          script: "I attract abundance in all areas of my life. Money flows to me easily and effortlessly. I am open to receiving prosperity. My financial future is bright and secure.",
          categoryId: 4, // Wealth
        },
        {
          title: "Inner Peace",
          script: "I am calm, centered, and at peace. I release all stress and tension. My mind is clear and my heart is open. I choose peace in every moment of my day.",
          categoryId: 2, // Health
        },
      ];

      // Get user's voice preferences to use their preferred voice
      const [userPrefs] = await db
        .select({
          preferredAiGender: users.preferredAiGender,
          preferredMaleVoiceId: users.preferredMaleVoiceId,
          preferredFemaleVoiceId: users.preferredFemaleVoiceId,
        })
        .from(users)
        .where(eq(users.id, req.userId!));

      // Determine voice to use based on preferences
      const gender = userPrefs?.preferredAiGender || "female";
      let voiceIdToUse: string;
      if (gender === "male") {
        voiceIdToUse = userPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id;
      } else {
        voiceIdToUse = userPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id;
      }
      console.log("Creating sample affirmations with voice:", voiceIdToUse, "gender:", gender);

      const createdAffirmations = [];

      // Ensure audio subdirectory exists
      const audioDir = path.join(uploadDir, "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      for (const sample of sampleAffirmations) {
        try {
          // Generate audio with user's preferred voice
          const audioResult = await generateAudio(sample.script, voiceIdToUse);
          
          // Save audio file to audio subdirectory
          const audioFilename = `affirmation-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
          const audioPath = path.join(audioDir, audioFilename);
          fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));

          // Create affirmation record
          const [newAffirmation] = await db
            .insert(affirmations)
            .values({
              userId: req.userId!,
              title: sample.title,
              script: sample.script,
              categoryId: sample.categoryId,
              audioUrl: `/uploads/audio/${audioFilename}`,
              duration: audioResult.duration,
              wordTimings: JSON.stringify(audioResult.wordTimings),
              isManual: false,
              voiceType: "ai",
              voiceGender: gender,
              aiVoiceId: voiceIdToUse,
            })
            .returning();

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

  // Reorder affirmations (requires auth)
  app.put("/api/affirmations/reorder", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      
      if (!orderedIds || !Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds array is required" });
      }

      // Update each affirmation's display order (only if owned by user)
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(affirmations)
          .set({ displayOrder: i })
          .where(and(
            eq(affirmations.id, orderedIds[i]),
            eq(affirmations.userId, req.userId!)
          ));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering affirmations:", error);
      res.status(500).json({ error: "Failed to reorder affirmations" });
    }
  });

  // Initialize default categories
  app.post("/api/categories/init", async (req: Request, res: Response) => {
    try {
      const defaultCategories = [
        { name: "Career", icon: "briefcase", color: "#4A90E2" },
        { name: "Health", icon: "heart", color: "#50E3C2" },
        { name: "Confidence", icon: "star", color: "#7B61FF" },
        { name: "Wealth", icon: "dollar-sign", color: "#F5A623" },
        { name: "Relationships", icon: "users", color: "#E91E63" },
        { name: "Sleep", icon: "moon", color: "#9C27B0" },
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

  // Update user's preferred name
  app.put("/api/user/name", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }

      const trimmedName = name.trim().substring(0, 50); // Max 50 characters

      await db
        .update(users)
        .set({ name: trimmedName })
        .where(eq(users.id, req.userId!));

      res.json({ success: true, name: trimmedName });
    } catch (error) {
      console.error("Error updating name:", error);
      res.status(500).json({ error: "Failed to update name" });
    }
  });

  // Clear all affirmations only (keeps voice samples)
  app.post("/api/affirmations/clear-all", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      // Delete all affirmations for this user
      const deletedAffirmations = await db
        .delete(affirmations)
        .where(eq(affirmations.userId, userId))
        .returning();

      res.json({ 
        success: true, 
        deletedCount: deletedAffirmations.length
      });
    } catch (error) {
      console.error("Error clearing affirmations:", error);
      res.status(500).json({ error: "Failed to clear affirmations" });
    }
  });

  // Reset user data - deletes all affirmations and voice samples for the user
  app.post("/api/user/reset", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      // Delete all affirmations for this user (audio files will be orphaned but that's ok)
      const deletedAffirmations = await db
        .delete(affirmations)
        .where(eq(affirmations.userId, userId))
        .returning();

      // Delete all voice samples for this user
      const deletedSamples = await db
        .delete(voiceSamples)
        .where(eq(voiceSamples.userId, userId))
        .returning();

      // Reset user's voice-related fields
      await db
        .update(users)
        .set({ 
          hasVoiceSample: false,
          voiceId: null
        })
        .where(eq(users.id, userId));

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

  // Delete user account - removes all user data and the account itself
  // Note: Using POST instead of DELETE because SameSite=Lax cookies aren't sent with DELETE on cross-origin requests
  app.post("/api/user/account/delete", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      // Delete all affirmations for this user
      await db
        .delete(affirmations)
        .where(eq(affirmations.userId, userId));

      // Delete all voice samples for this user
      await db
        .delete(voiceSamples)
        .where(eq(voiceSamples.userId, userId));

      // Delete all collections for this user
      await db
        .delete(collections)
        .where(eq(collections.userId, userId));

      // Delete the user account
      await db
        .delete(users)
        .where(eq(users.id, userId));

      // Destroy the session
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

  // Get notification settings for current user
  app.get("/api/notifications/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      const [settings] = await db
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, userId))
        .limit(1);

      if (!settings) {
        // Return default settings if none exist
        return res.json({
          morningEnabled: false,
          morningTime: "08:00",
          afternoonEnabled: false,
          afternoonTime: "13:00",
          eveningEnabled: false,
          eveningTime: "20:00",
        });
      }

      res.json({
        morningEnabled: settings.morningEnabled,
        morningTime: settings.morningTime,
        afternoonEnabled: settings.afternoonEnabled,
        afternoonTime: settings.afternoonTime,
        eveningEnabled: settings.eveningEnabled,
        eveningTime: settings.eveningTime,
      });
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });

  // Update notification settings for current user
  app.put("/api/notifications/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { 
        morningEnabled, 
        morningTime, 
        afternoonEnabled, 
        afternoonTime, 
        eveningEnabled, 
        eveningTime 
      } = req.body;

      // Check if settings exist
      const [existing] = await db
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, userId))
        .limit(1);

      if (existing) {
        // Update existing settings
        const [updated] = await db
          .update(notificationSettings)
          .set({
            morningEnabled: morningEnabled ?? existing.morningEnabled,
            morningTime: morningTime ?? existing.morningTime,
            afternoonEnabled: afternoonEnabled ?? existing.afternoonEnabled,
            afternoonTime: afternoonTime ?? existing.afternoonTime,
            eveningEnabled: eveningEnabled ?? existing.eveningEnabled,
            eveningTime: eveningTime ?? existing.eveningTime,
            updatedAt: new Date(),
          })
          .where(eq(notificationSettings.userId, userId))
          .returning();

        return res.json({
          morningEnabled: updated.morningEnabled,
          morningTime: updated.morningTime,
          afternoonEnabled: updated.afternoonEnabled,
          afternoonTime: updated.afternoonTime,
          eveningEnabled: updated.eveningEnabled,
          eveningTime: updated.eveningTime,
        });
      } else {
        // Create new settings
        const [created] = await db
          .insert(notificationSettings)
          .values({
            userId,
            morningEnabled: morningEnabled ?? false,
            morningTime: morningTime ?? "08:00",
            afternoonEnabled: afternoonEnabled ?? false,
            afternoonTime: afternoonTime ?? "13:00",
            eveningEnabled: eveningEnabled ?? false,
            eveningTime: eveningTime ?? "20:00",
          })
          .returning();

        return res.json({
          morningEnabled: created.morningEnabled,
          morningTime: created.morningTime,
          afternoonEnabled: created.afternoonEnabled,
          afternoonTime: created.afternoonTime,
          eveningEnabled: created.eveningEnabled,
          eveningTime: created.eveningTime,
        });
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ error: "Failed to update notification settings" });
    }
  });

  // ============ Breathing Sessions API ============
  
  // Record a breathing session
  app.post("/api/breathing-sessions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { techniqueId, durationSeconds } = req.body;
      
      if (!techniqueId || typeof durationSeconds !== 'number' || durationSeconds <= 0) {
        return res.status(400).json({ error: "Invalid session data" });
      }

      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD

      const [session] = await db
        .insert(breathingSessions)
        .values({
          userId,
          techniqueId,
          durationSeconds,
          dateKey,
        })
        .returning();

      res.json(session);
    } catch (error) {
      console.error("Error recording breathing session:", error);
      res.status(500).json({ error: "Failed to record breathing session" });
    }
  });

  // Get today's breathing progress
  app.get("/api/breathing-sessions/today", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const today = new Date();
      const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD

      const sessions = await db
        .select({
          totalSeconds: sql<number>`COALESCE(SUM(${breathingSessions.durationSeconds}), 0)::int`,
          sessionCount: sql<number>`COUNT(*)::int`,
        })
        .from(breathingSessions)
        .where(and(
          eq(breathingSessions.userId, userId),
          eq(breathingSessions.dateKey, dateKey)
        ));

      const result = sessions[0] || { totalSeconds: 0, sessionCount: 0 };
      
      res.json({
        totalMinutes: Math.floor(result.totalSeconds / 60),
        totalSeconds: result.totalSeconds,
        sessionCount: result.sessionCount,
        dateKey,
        goalMinutes: 5, // Default daily goal
      });
    } catch (error) {
      console.error("Error getting today's breathing progress:", error);
      res.status(500).json({ error: "Failed to get breathing progress" });
    }
  });

  // Get breathing streak (consecutive days)
  app.get("/api/breathing-sessions/streak", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get distinct dates with breathing sessions, ordered by date desc
      const sessionsResult = await db
        .select({
          dateKey: breathingSessions.dateKey,
        })
        .from(breathingSessions)
        .where(eq(breathingSessions.userId, userId))
        .groupBy(breathingSessions.dateKey)
        .orderBy(desc(breathingSessions.dateKey));

      const dates = sessionsResult.map(s => s.dateKey);
      
      if (dates.length === 0) {
        return res.json({ streak: 0, lastActiveDate: null });
      }

      // Calculate streak
      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      // Check if most recent session was today or yesterday
      if (dates[0] !== today && dates[0] !== yesterday) {
        return res.json({ streak: 0, lastActiveDate: dates[0] });
      }

      // Count consecutive days
      let currentDate = new Date(dates[0]);
      for (const dateKey of dates) {
        const sessionDate = new Date(dateKey);
        const diffDays = Math.floor((currentDate.getTime() - sessionDate.getTime()) / 86400000);
        
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

  // Generate ambient sounds using ElevenLabs Sound Effects API
  // Regenerate a single ambient sound
  app.post("/api/admin/regenerate-sound/:filename", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { filename } = req.params;
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      
      const audioDir = path.join(process.cwd(), "assets", "audio");
      console.log(`Regenerating: ${filename} with prompt: ${prompt}`);
      
      const audioBuffer = await generateSoundEffect(prompt, 22, 0.3);
      const filePath = path.join(audioDir, filename);
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      
      console.log(`Successfully regenerated: ${filename}`);
      res.json({ success: true, filename, bytes: audioBuffer.byteLength });
    } catch (error: any) {
      console.error("Error regenerating sound:", error);
      res.status(500).json({ error: "Failed to regenerate sound", details: error.message });
    }
  });

  app.post("/api/admin/generate-ambient-sounds", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const audioDir = path.join(process.cwd(), "assets", "audio");
      
      // Sound prompts for each ambient type
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
          console.log(`Generating: ${config.filename}`);
          const audioBuffer = await generateSoundEffect(config.prompt, 22, 0.3);
          
          const filePath = path.join(audioDir, config.filename);
          fs.writeFileSync(filePath, Buffer.from(audioBuffer));
          
          results.push({ filename: config.filename, success: true });
          console.log(`Successfully generated: ${config.filename}`);
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

  // Support request submission
  app.post("/api/support", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, subject, message } = req.body;
      
      if (!email || !subject || !message) {
        return res.status(400).json({ error: "Email, subject, and message are required" });
      }

      const userId = req.user?.id || null;

      const [request] = await db
        .insert(supportRequests)
        .values({
          userId,
          email,
          subject,
          message,
        })
        .returning();

      res.json({ success: true, requestId: request.id });
    } catch (error: any) {
      console.error("Error submitting support request:", error);
      res.status(500).json({ error: "Failed to submit support request" });
    }
  });

  // TEMPORARY: Admin endpoint to generate audio for sample affirmations
  app.post("/api/admin/generate-sample-audio", async (req: Request, res: Response) => {
    try {
      const { adminKey } = req.body;
      
      // Simple admin key protection
      if (adminKey !== "generate-sample-audio-2024") {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get all sample affirmations that need audio
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
          // Skip if already has audio
          if (affirmation.audioUrl) {
            results.push({ id: affirmation.id, title: affirmation.title, status: "skipped - already has audio" });
            continue;
          }
          
          // Use the assigned AI voice or default to Sarah
          const voiceId = affirmation.aiVoiceId || "EXAVITQu4vr4xnSDxMaL";
          
          console.log(`Generating audio for: ${affirmation.title} with voice ${voiceId}`);
          
          // Generate audio
          const audioResult = await generateAudio(affirmation.script, voiceId);
          
          // Save audio file
          const audioFileName = `affirmation-${affirmation.id}-${Date.now()}.mp3`;
          const audioPath = path.join(audioDir, audioFileName);
          fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));
          
          const audioUrl = `/uploads/audio/${audioFileName}`;
          
          // Update affirmation
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
          
          // Small delay to avoid rate limits
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

  const httpServer = createServer(app);

  return httpServer;
}

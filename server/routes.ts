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
import OpenAI from "openai";
import {
  cloneVoice,
  textToSpeech as elevenLabsTTS,
  getElevenLabsClient,
  generateSoundEffect,
  deleteVoice,
  type WordTiming,
} from "./replit_integrations/elevenlabs/client";
import { humeTextToSpeech, humeSimpleTTS, HUME_VOICE_OPTIONS, type WordTiming as HumeWordTiming } from "./hume-client";
import { findInactiveVoices, runVoiceRotation, getVoiceSlotStats, checkVoiceSlotWarning } from "./voice-rotation";
import { setupAuth, requireAuth, optionalAuth, AuthenticatedRequest } from "./auth";
import {
  postIssueComment,
  setIssueStatusLabel,
  updateProjectCard,
  getIssueNodeId,
  getAssignedIssues,
  listRepos,
  initCoordination,
  updateStatus,
  addBlocker,
  getStatus,
  getPriorities,
  acknowledgePriorities,
  initDocStructure,
  pushDocument,
  pushInboxMessage,
  getInboxMessages,
} from "./github";

// Rate limiters to prevent API abuse
const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many requests. Please wait a minute before generating more affirmations." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const voiceCloneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: { error: "Too many voice cloning attempts. Please wait about an hour and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many audio generation requests. Please wait before creating more." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const dailyGreetingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many greeting requests. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.userId || req.ip || "unknown";
  },
});

const dailyGreetingCache = new Map<string, string>();

const dailyGreetingFallbacks: Record<string, string> = {
  morning: "A new morning means a new chance to become who you are meant to be",
  afternoon: "You are carrying today with quiet strength — keep moving forward",
  evening: "Tonight you can rest knowing you gave today your honest effort",
  night: "Let the stillness remind you how far you have already come",
};

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Usage limit constants
const MAX_AI_AFFIRMATIONS_PER_MONTH = 20;
const MAX_VOICE_CLONES_LIFETIME = 5;

// Admin accounts with no restrictions
const ADMIN_USER_IDS = new Set([
  "77adcd55-7d43-48b2-ab2d-32375c4ea4d5",
]);

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
    short: { sentences: 2, tokens: 150, description: "exactly 2 sentences" },
    medium: { sentences: 5, tokens: 350, description: "exactly 5 sentences" },
    long: { sentences: 10, tokens: 600, description: "exactly 10 sentences" },
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
  
  const systemPrompt = `You are an expert in subconscious reprogramming and neurolinguistic patterning. Write ${config.sentences} affirmation sentences that are psychologically optimized to bypass conscious resistance and embed deeply into the subconscious mind.

SUBCONSCIOUS LANGUAGE RULES (apply ALL of these):

1. PRESENT TENSE ONLY: Always "I am", "I have", "I feel" — never future tense. The subconscious cannot process "I will" or "someday". Everything must feel true NOW.

2. POSITIVE FRAMING: Never use negatives (not, don't, won't, no longer, without, free from). The subconscious ignores negation and absorbs the negative concept. Say "I am calm" not "I am not anxious". Say "I welcome abundance" not "I am free from scarcity".

3. SENSORY-RICH LANGUAGE: Include felt sensations — what the person feels in their body, sees in their mind, or hears internally. Examples: "I feel the steady warmth of confidence radiating through my chest", "I sense my own quiet power". This activates the subconscious through embodiment.

4. IDENTITY-LEVEL STATEMENTS: Frame as identity ("I am someone who..."), not behavior ("I try to..."). Identity statements reshape self-concept at the deepest level. Mix "I am" with "I naturally...", "I effortlessly...", "It is in my nature to...".

5. PROGRESSIVE BELIEVABILITY: Start with grounded, easily believable statements and gradually build to more aspirational ones. This prevents conscious rejection. First sentence should feel undeniably true, last sentence should feel like an exciting stretch.

6. EMBEDDED COMMANDS: Weave in subtle permission-giving phrases: "I allow myself to...", "I give myself permission to...", "I am ready to...", "I am open to receiving...". These dissolve inner resistance.

7. RHYTHM AND FLOW: Create a natural, almost poetic cadence. Use parallel structure and gentle repetition of key power words. The rhythm makes phrases easier for the subconscious to absorb during repetitive listening.

8. EMOTIONAL ANCHORING: Each sentence should evoke a specific positive emotion (safety, pride, gratitude, excitement, peace, love). Name the emotion when possible: "I feel deeply proud of who I am becoming."

FORMAT: No titles, no instructions, no numbering, no quotes. Just ${config.sentences} flowing sentences, each on its own line. Write as if speaking directly to the deepest part of someone's mind.

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

// Direct OpenAI client for TTS fallback (uses real OpenAI API, not Replit AI integration)
const directOpenAI = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const HUME_TO_OPENAI_VOICE_MAP: Record<string, string> = {
  "hume_seraphina": "nova",
  "hume_lotus": "shimmer",
  "hume_amber": "alloy",
  "hume_nova": "nova",
  "hume_willow": "shimmer",
  "hume_orion": "onyx",
  "hume_atlas": "echo",
  "hume_sage": "fable",
  "hume_summit": "onyx",
  "hume_bodhi": "echo",
};

// Map Hume voice IDs to their voice names for TTS API calls
const HUME_VOICE_ID_MAP: Record<string, string> = {
  "hume_seraphina": "Serene Assistant",
  "hume_lotus": "Female Meditation Guide",
  "hume_amber": "Warm American Female",
  "hume_nova": "Warm Female Assistant Voice",
  "hume_willow": "Demure Conversationalist",
  "hume_orion": "Inspiring Man",
  "hume_atlas": "Deep Male Conversational Voice",
  "hume_sage": "Soft Male Conversationalist",
  "hume_summit": "Nature Documentary Narrator",
  "hume_bodhi": "Wise Wizard",
};

function getHumeVoiceNameForId(voiceId?: string): string | null {
  if (!voiceId) return null;
  return HUME_VOICE_ID_MAP[voiceId] || null;
}

function isHumeVoice(voiceId?: string): boolean {
  return !!voiceId && voiceId.startsWith("hume_");
}

function getOpenAIFallbackVoice(voiceId?: string): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
  if (!voiceId) return "nova";
  const mapped = HUME_TO_OPENAI_VOICE_MAP[voiceId];
  return (mapped as any) || "nova";
}

async function generateAudioOpenAI(
  script: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova"
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  if (!directOpenAI) {
    throw new Error("TTS_UNAVAILABLE: No OpenAI API key configured");
  }

  const response = await directOpenAI.audio.speech.create({
    model: "tts-1",
    voice,
    input: script,
  });

  const audioBuffer = await response.arrayBuffer();
  const words = script.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const estimatedDuration = Math.ceil((wordCount / 150) * 60);

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

async function generateAudioSimpleOpenAI(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova"
): Promise<ArrayBuffer> {
  if (!directOpenAI) {
    throw new Error("TTS_UNAVAILABLE: No OpenAI API key configured");
  }
  const response = await directOpenAI.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
  });
  return await response.arrayBuffer();
}

async function generateAudioSimple(text: string, voiceId: string, isPersonalVoice: boolean = false): Promise<ArrayBuffer> {
  // Personal voice: always use ElevenLabs
  if (isPersonalVoice) {
    try {
      const client = await getElevenLabsClient();
      const audio = await client.textToSpeech.convert(voiceId, {
        text,
        model_id: "eleven_multilingual_v2",
      });
      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).buffer;
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const isQuota = errMsg.includes("quota_exceeded") || errMsg.includes("Unauthorized");
      const isVoiceNotFound = errMsg.includes("voice_not_found") ||
        errMsg.includes("Not Found") ||
        String(error).includes("voice_not_found");
      if (isQuota) {
        throw new Error("QUOTA_EXCEEDED: Your voice cloning credits have been used up for this period. Please switch to an AI voice or wait for your credits to reset.");
      }
      if (isVoiceNotFound) {
        throw new Error("VOICE_EXPIRED: Your voice clone has expired or is no longer available. Please re-record your voice sample.");
      }
      throw new Error("PERSONAL_VOICE_FAILED: Could not generate audio with your personal voice. Please try again or re-record your voice.");
    }
  }

  // Stock AI voice: use Hume AI (primary), OpenAI (fallback)
  const humeName = getHumeVoiceNameForId(voiceId);
  
  if (humeName) {
    try {
      console.log(`Using Hume AI simple TTS for stock voice: ${humeName}`);
      return await humeSimpleTTS(text, humeName);
    } catch (humeError: any) {
      console.error("Hume AI simple TTS failed, trying OpenAI fallback:", humeError?.message || humeError);
    }
  }

  // Fallback to OpenAI
  if (directOpenAI) {
    try {
      const openaiVoice = getOpenAIFallbackVoice(voiceId);
      return await generateAudioSimpleOpenAI(text, openaiVoice);
    } catch (openaiError: any) {
      console.error("OpenAI simple TTS fallback also failed:", openaiError?.message || openaiError);
    }
  }

  throw new Error("TTS_UNAVAILABLE: All TTS services are unavailable");
}

async function generateAudio(
  script: string,
  voiceId?: string,
  isPersonalVoice: boolean = false
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  // Personal voice: always use ElevenLabs (voice clones live there)
  if (isPersonalVoice) {
    try {
      const result = await elevenLabsTTS(script, voiceId);
      return result;
    } catch (elevenLabsError: any) {
      const isQuotaExhausted = elevenLabsError?.message?.includes("quota_exceeded") ||
        elevenLabsError?.message?.includes("Unauthorized") ||
        String(elevenLabsError).includes("quota_exceeded");
      const isVoiceNotFound = elevenLabsError?.message?.includes("voice_not_found") ||
        elevenLabsError?.message?.includes("Not Found") ||
        String(elevenLabsError).includes("voice_not_found");
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
      throw new Error("PERSONAL_VOICE_FAILED: Could not generate audio with your personal voice. Please try again or re-record your voice.");
    }
  }

  // Stock AI voice: use Hume AI (primary), OpenAI (fallback)
  const humeName = getHumeVoiceNameForId(voiceId);
  
  if (humeName) {
    try {
      console.log(`Using Hume AI TTS for stock voice: ${humeName}`);
      const result = await humeTextToSpeech(script, humeName);
      return result;
    } catch (humeError: any) {
      console.error("Hume AI TTS failed, trying OpenAI fallback:", humeError?.message || humeError);
    }
  }

  // Fallback to OpenAI for stock voices
  if (directOpenAI) {
    try {
      const openaiVoice = getOpenAIFallbackVoice(voiceId);
      return await generateAudioOpenAI(script, openaiVoice);
    } catch (openaiError: any) {
      console.error("OpenAI TTS fallback also failed:", openaiError?.message || openaiError);
    }
  }

  throw new Error("TTS_UNAVAILABLE: All TTS services (Hume AI, OpenAI) are unavailable");
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
      const rawFilename = req.params.filename as string;
      
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
      const id = req.params.id as string;
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

      // Check monthly usage limit for AI-generated affirmations (skip for admin accounts)
      const isAdmin = ADMIN_USER_IDS.has(req.userId!);
      const limits = await checkAndResetMonthlyLimits(req.userId!);
      
      if (!isAdmin && limits.affirmationsRemaining <= 0) {
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
      const { title, script, pillar, categories, category, isManual, forceAiVoice } = req.body;

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

      if (!forceAiVoice && userWithPrefs?.preferredVoiceType === "personal" && (!userWithPrefs?.voiceId || !userWithPrefs?.hasVoiceSample)) {
        return res.status(400).json({
          error: "VOICE_ROTATED",
          message: "Your personal voice has expired. Please re-record your voice sample to continue using your personal voice, or switch to an AI voice.",
        });
      }

      if (!forceAiVoice && userWithPrefs?.preferredVoiceType === "personal" && userWithPrefs?.voiceId && userWithPrefs?.hasVoiceSample) {
        voiceIdToUse = userWithPrefs.voiceId;
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
          usedPersonalVoice
        );
      } catch (genError: any) {
        if (usedPersonalVoice && genError?.message?.includes("QUOTA_EXCEEDED")) {
          console.log("Personal voice quota exceeded, falling back to AI voice");
          const fallbackGender = usedGender || "female";
          const fallbackVoiceId = fallbackGender === "male"
            ? (userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id)
            : (userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id);
          usedPersonalVoice = false;
          voiceIdToUse = fallbackVoiceId;
          audioResult = await generateAudio(script, fallbackVoiceId, false);
        } else if (usedPersonalVoice && (genError?.message?.includes("PERSONAL_VOICE_FAILED") || genError?.message?.includes("VOICE_EXPIRED"))) {
          console.log("Personal voice not found/expired, falling back to AI voice");
          const fallbackGender = usedGender || "female";
          const fallbackVoiceId = fallbackGender === "male"
            ? (userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id)
            : (userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id);
          usedPersonalVoice = false;
          voiceIdToUse = fallbackVoiceId;
          audioResult = await generateAudio(script, fallbackVoiceId, false);
        } else {
          throw genError;
        }
      }

      if (usedPersonalVoice) {
        await db
          .update(users)
          .set({ voiceLastUsedAt: new Date() })
          .where(eq(users.id, req.userId!));
      }

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
    } catch (error: any) {
      console.error("Error creating affirmation:", error);
      if (error?.message?.includes("QUOTA_EXCEEDED")) {
        res.status(429).json({ error: "QUOTA_EXCEEDED", message: "Your voice credits have been used up for this period. The affirmation will be created with an AI voice instead." });
      } else if (error?.message?.includes("PERSONAL_VOICE_FAILED")) {
        res.status(422).json({ error: "PERSONAL_VOICE_FAILED", message: "Could not generate audio with your personal voice. You can try again or switch to an AI voice." });
      } else if (error?.message?.includes("TTS_UNAVAILABLE")) {
        res.status(503).json({ error: "Voice services are temporarily unavailable. Please try again later." });
      } else {
        res.status(500).json({ error: "Failed to create affirmation. Please try again." });
      }
    }
  });

  // Delete affirmation (requires auth, must belong to user)
  app.delete("/api/affirmations/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      
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
      const id = req.params.id as string;
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
      const id = req.params.id as string;
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
      const id = req.params.id as string;

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

      res.json(updated);
    } catch (error) {
      console.error("Error auto-saving affirmation:", error);
      res.status(500).json({ error: "Failed to auto-save affirmation" });
    }
  });

  // Increment play count and record listening session (requires auth)
  app.post("/api/affirmations/:id/play", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
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
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating play count:", error);
      res.status(500).json({ error: "Failed to update play count" });
    }
  });

  // Upload voice sample and clone voice (requires auth)
  // Max 5 voice clones per user lifetime (ElevenLabs Pro Plan)
  // Rate limited: max 3 attempts per hour
  const MAX_VOICE_CLONES = 5;
  
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
        } catch (cloneError: any) {
          console.error("Voice cloning error:", cloneError);

          // PRIVACY: Delete file even on failure
          fs.unlink(file.path, () => {});

          // Update status to failed
          await db
            .update(voiceSamples)
            .set({ status: "failed", audioUrl: null })
            .where(eq(voiceSamples.id, sample.id));

          const elevenLabsDetail = cloneError?.elevenLabsDetail || cloneError?.message || "";
          const statusCode = cloneError?.statusCode || 500;
          let userMessage = "Voice cloning failed. Please try again.";

          if (elevenLabsDetail.toLowerCase().includes("maximum") || elevenLabsDetail.toLowerCase().includes("custom voices") || elevenLabsDetail.toLowerCase().includes("voice limit")) {
            console.error("[Voice Slots] ElevenLabs voice slot limit reached! Attempting auto-cleanup...");
            userMessage = "Voice cloning is temporarily unavailable. Please try again in a few minutes.";
          } else if (statusCode === 401 || statusCode === 403) {
            userMessage = "Voice cloning service is temporarily unavailable. Please try again later.";
          } else if (statusCode === 429) {
            userMessage = "Voice cloning service is busy. Please wait a few minutes and try again.";
          } else if (elevenLabsDetail.toLowerCase().includes("too short") || elevenLabsDetail.toLowerCase().includes("duration")) {
            userMessage = "Your recording was too short. Please record at least 20 seconds of clear speech.";
          } else if (elevenLabsDetail.toLowerCase().includes("audio") || elevenLabsDetail.toLowerCase().includes("format")) {
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

  const VOICE_OPTIONS = {
    female: [
      { id: "hume_seraphina", name: "Seraphina", description: "Tranquil, radiant calm", provider: "HUME_AI", humeName: "Serene Assistant" },
      { id: "hume_lotus", name: "Lotus", description: "Peaceful, guiding presence", provider: "HUME_AI", humeName: "Female Meditation Guide" },
      { id: "hume_amber", name: "Amber", description: "Warm, grounding energy", provider: "HUME_AI", humeName: "Warm American Female" },
      { id: "hume_nova", name: "Nova", description: "Gentle, luminous clarity", provider: "HUME_AI", humeName: "Warm Female Assistant Voice" },
      { id: "hume_willow", name: "Willow", description: "Soft, graceful wisdom", provider: "HUME_AI", humeName: "Demure Conversationalist" },
    ],
    male: [
      { id: "hume_orion", name: "Orion", description: "Bold, uplifting strength", provider: "HUME_AI", humeName: "Inspiring Man" },
      { id: "hume_atlas", name: "Atlas", description: "Deep, grounded resonance", provider: "HUME_AI", humeName: "Deep Male Conversational Voice" },
      { id: "hume_sage", name: "Sage", description: "Calm, centering stillness", provider: "HUME_AI", humeName: "Soft Male Conversationalist" },
      { id: "hume_summit", name: "Summit", description: "Steady, expansive clarity", provider: "HUME_AI", humeName: "Nature Documentary Narrator" },
      { id: "hume_bodhi", name: "Bodhi", description: "Ancient, soulful wisdom", provider: "HUME_AI", humeName: "Wise Wizard" },
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

      let audioBuffer: ArrayBuffer;
      try {
        audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, user.voiceId, true);
      } catch (ttsError: any) {
        const msg = ttsError?.message || "";
        if (msg.includes("PERSONAL_VOICE_FAILED") || msg.includes("voice_not_found") || msg.includes("404")) {
          return res.status(422).json({ 
            error: "VOICE_EXPIRED",
            message: "Your voice clone may have expired. Please re-record your voice to continue using personal voice features."
          });
        }
        throw ttsError;
      }

      await db
        .update(users)
        .set({ voiceLastUsedAt: new Date() })
        .where(eq(users.id, req.userId!));

      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      res.json({ 
        audio: base64Audio,
        voiceName: "My Voice",
      });
    } catch (error) {
      console.error("Error generating personal voice preview:", error);
      res.status(500).json({ error: "Failed to generate personal voice preview. Please try again." });
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
        preferredMaleVoiceId: user.preferredMaleVoiceId || "hume_orion",
        preferredFemaleVoiceId: user.preferredFemaleVoiceId || "hume_seraphina",
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
      const affirmationId = parseInt(req.params.id as string, 10);
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
            error: "VOICE_ROTATED",
            message: "Your personal voice has expired. Please re-record your voice sample to continue using your personal voice, or switch to an AI voice.",
          });
        }
        voiceIdToUse = user.voiceId;
      } else {
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

      const isPersonalVoice = voiceType === "personal";
      const audioResult = await generateAudio(affirmation.script, voiceIdToUse, isPersonalVoice);

      if (isPersonalVoice) {
        await db
          .update(users)
          .set({ voiceLastUsedAt: new Date() })
          .where(eq(users.id, req.userId!));
      }
      
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
    } catch (error: any) {
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
          message: "Could not generate audio with your personal voice. Please try again or switch to an AI voice."
        });
      }
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
      const categoryId = parseInt(req.params.id as string);
      
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

      // 6 sample affirmations: one per pillar, varied lengths (2 short, 2 medium, 2 long)
      // Each gently steers users toward mental wellness and meditation
      const sampleAffirmations = [
        {
          title: "Calm Mind",
          pillar: "Mind",
          categoryName: "Focus,Resilience",
          script: "My mind is still and clear. In this moment of quiet, I find my center. I breathe deeply and let every thought settle like water becoming glass. I choose calm over chaos.",
        },
        {
          title: "Body at Rest",
          pillar: "Body",
          categoryName: "Health,Sleep",
          script: "I honor my body by giving it rest. With every slow breath, tension melts from my shoulders, my jaw, my hands. I feel my heartbeat steady and strong. My body knows how to heal when I create space for stillness. Tonight, I will sleep deeply and wake restored.",
        },
        {
          title: "Grateful Spirit",
          pillar: "Spirit",
          categoryName: "Gratitude,Happiness",
          script: "I am grateful for this quiet moment. Gratitude fills me like warm sunlight. I appreciate the small blessings that surround me today. In stillness, I discover that everything I need is already within me.",
        },
        {
          title: "Present with Others",
          pillar: "Connection",
          categoryName: "Relationships,Self-Compassion",
          script: "I am fully present when I am with the people I love. I listen with patience and speak with kindness. By nurturing my own inner peace through meditation, I bring a calmer, more compassionate version of myself to every conversation. I attract meaningful connections because I first connect deeply with myself. The love I cultivate in stillness radiates outward and touches everyone around me.",
        },
        {
          title: "Focused Achievement",
          pillar: "Achievement",
          categoryName: "Career,Motivation",
          script: "I accomplish my goals with steady focus. Each morning I take a moment to breathe, set my intention, and move forward with clarity. Success flows naturally when my mind is calm.",
        },
        {
          title: "Peaceful Home",
          pillar: "Home",
          categoryName: "Family,Environment",
          script: "My home is a sanctuary of peace and warmth. I create calm in my living space by first cultivating calm within myself. When I pause to breathe and center my thoughts, that serenity flows into every room. My family feels safe and loved because I choose presence over distraction. I tend to my home with the same gentle attention I give to my meditation practice. Order, beauty, and tranquility are not things I chase. They are things I create, one mindful moment at a time. My home reflects the peace I carry inside.",
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
              pillar: sample.pillar,
              categoryName: sample.categoryName,
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
      const userId = req.userId;
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
      const userId = req.userId;
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
      const userId = req.userId;
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

  // Support request submission
  app.post("/api/support", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email, subject, message } = req.body;
      
      if (!email || !subject || !message) {
        return res.status(400).json({ error: "Email, subject, and message are required" });
      }

      const userId = req.userId || null;

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
          
          const voiceId = affirmation.aiVoiceId || "hume_seraphina";
          
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

  // Set voice cloning consent (required before recording)
  app.post("/api/user/voice-consent", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { consent } = req.body;
      
      if (typeof consent !== "boolean") {
        return res.status(400).json({ error: "Consent must be a boolean value" });
      }

      await db
        .update(users)
        .set({ hasConsentedToVoiceCloning: consent })
        .where(eq(users.id, req.userId!));

      res.json({ success: true, hasConsentedToVoiceCloning: consent });
    } catch (error) {
      console.error("Error updating voice consent:", error);
      res.status(500).json({ error: "Failed to update consent" });
    }
  });

  // Get user's usage limits and consent status
  app.get("/api/user/limits", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limits = await checkAndResetMonthlyLimits(req.userId!);
      
      const [user] = await db
        .select({
          voiceClonesUsed: users.voiceClonesUsed,
          hasConsentedToVoiceCloning: users.hasConsentedToVoiceCloning,
        })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);

      const isAdmin = ADMIN_USER_IDS.has(req.userId!);
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

  // Delete all user data (GDPR compliance)
  app.delete("/api/user/data", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      
      // Get user's affirmations to delete their audio files
      const userAffirmations = await db
        .select({ audioUrl: affirmations.audioUrl })
        .from(affirmations)
        .where(eq(affirmations.userId, userId));

      // Delete audio files from filesystem
      for (const aff of userAffirmations) {
        if (aff.audioUrl) {
          const filePath = path.join(uploadDir, aff.audioUrl.replace("/uploads/", ""));
          fs.unlink(filePath, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error("Failed to delete audio file:", err);
            }
          });
        }
      }

      // Get user's voice samples to delete their files (in case any exist)
      const userVoiceSamples = await db
        .select({ audioUrl: voiceSamples.audioUrl })
        .from(voiceSamples)
        .where(eq(voiceSamples.userId, userId));

      for (const sample of userVoiceSamples) {
        if (sample.audioUrl && sample.audioUrl !== "processing") {
          const filePath = path.join(uploadDir, sample.audioUrl.replace("/uploads/", ""));
          fs.unlink(filePath, () => {});
        }
      }

      // Delete user data in order (respecting foreign key constraints)
      // Most tables cascade delete from users, but let's be explicit
      await db.delete(listeningSessions).where(eq(listeningSessions.userId, userId));
      await db.delete(breathingSessions).where(eq(breathingSessions.userId, userId));
      await db.delete(notificationSettings).where(eq(notificationSettings.userId, userId));
      await db.delete(affirmations).where(eq(affirmations.userId, userId));
      await db.delete(voiceSamples).where(eq(voiceSamples.userId, userId));
      await db.delete(customCategories).where(eq(customCategories.userId, userId));
      await db.delete(collections).where(eq(collections.userId, userId));
      
      // Finally, delete the user
      await db.delete(users).where(eq(users.id, userId));

      res.json({ 
        success: true, 
        message: "All your data has been permanently deleted." 
      });
    } catch (error) {
      console.error("Error deleting user data:", error);
      res.status(500).json({ error: "Failed to delete user data. Please contact support." });
    }
  });

  // ============ GitHub Integration Routes ============

  app.get("/api/github/repos", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const repos = await listRepos();
      res.json(repos);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch repositories" });
    }
  });

  app.get("/api/github/issues/:owner/:repo", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issues = await getAssignedIssues(owner, repo);
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch issues" });
    }
  });

  app.post("/api/github/issues/:owner/:repo/:issueNumber/comment", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issueNumber = req.params.issueNumber as string;
      const { body } = req.body;
      if (!body) {
        return res.status(400).json({ error: "Comment body is required" });
      }
      const comment = await postIssueComment(owner, repo, parseInt(issueNumber), body);
      res.json({ success: true, commentId: comment.id, url: comment.html_url });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to post comment" });
    }
  });

  app.post("/api/github/issues/:owner/:repo/:issueNumber/label", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issueNumber = req.params.issueNumber as string;
      const { status } = req.body;
      const validStatuses = ['in-progress', 'blocked', 'completed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      const result = await setIssueStatusLabel(owner, repo, parseInt(issueNumber), status);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update label" });
    }
  });

  app.post("/api/github/project/:owner/:projectNumber/move", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const projectNumber = req.params.projectNumber as string;
      const { repo, issueNumber, status } = req.body;
      if (!repo || !issueNumber || !status) {
        return res.status(400).json({ error: "repo, issueNumber, and status are required" });
      }
      const nodeId = await getIssueNodeId(owner, repo, parseInt(issueNumber));
      const result = await updateProjectCard(owner, parseInt(projectNumber), nodeId, status);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update project card" });
    }
  });

  app.post("/api/github/issues/:owner/:repo/:issueNumber/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const issueNumber = req.params.issueNumber as string;
      const { status, comment, projectNumber } = req.body;
      const validStatuses = ['in-progress', 'blocked', 'completed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      const num = parseInt(issueNumber);
      const results: any = { success: true };

      const labelResult = await setIssueStatusLabel(owner, repo, num, status);
      results.label = labelResult;

      const statusMessages: Record<string, string> = {
        'in-progress': '🔄 **Status: In Progress**',
        'blocked': '🚫 **Status: Blocked**',
        'completed': '✅ **Status: Completed**',
      };
      const commentBody = comment
        ? `${statusMessages[status]}\n\n${comment}`
        : statusMessages[status];
      const commentResult = await postIssueComment(owner, repo, num, commentBody);
      results.comment = { id: commentResult.id, url: commentResult.html_url };

      if (projectNumber) {
        try {
          const nodeId = await getIssueNodeId(owner, repo, num);
          const projectResult = await updateProjectCard(owner, parseInt(projectNumber), nodeId, status);
          results.project = projectResult;
        } catch (e: any) {
          results.projectError = e.message;
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update issue status" });
    }
  });

  // ============ Coordination System Routes ============

  app.post("/api/github/coordination/:owner/:repo/init", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const results = await initCoordination(owner, repo);
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initialize coordination" });
    }
  });

  app.get("/api/github/coordination/:owner/:repo/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const status = await getStatus(owner, repo);
      if (!status) {
        return res.status(404).json({ error: "status.json not found. Run init first." });
      }
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get status" });
    }
  });

  app.post("/api/github/coordination/:owner/:repo/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const { current_work, status, estimated_completion } = req.body;
      const validStatuses = ['idle', 'in_progress', 'completed'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      const result = await updateStatus(owner, repo, { current_work, status, estimated_completion });
      res.json({ success: true, status: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update status" });
    }
  });

  app.post("/api/github/coordination/:owner/:repo/blocker", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const { blocker } = req.body;
      if (!blocker) {
        return res.status(400).json({ error: "blocker text is required" });
      }
      const result = await addBlocker(owner, repo, blocker);
      res.json({ success: true, status: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to add blocker" });
    }
  });

  app.get("/api/github/coordination/:owner/:repo/priorities", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const priorities = await getPriorities(owner, repo);
      if (!priorities) {
        return res.status(404).json({ error: "priorities.json not found. Run init first." });
      }
      res.json(priorities);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get priorities" });
    }
  });

  app.post("/api/github/coordination/:owner/:repo/acknowledge", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const result = await acknowledgePriorities(owner, repo);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to acknowledge priorities" });
    }
  });

  // ============ Document Sharing System ============

  app.post("/api/github/docs/:owner/:repo/init", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const results = await initDocStructure(owner, repo);
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to initialize doc structure" });
    }
  });

  app.post("/api/github/docs/:owner/:repo/push", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const { category, filename, content, commitMessage } = req.body;
      if (!category || !filename || !content) {
        return res.status(400).json({ error: "category, filename, and content are required" });
      }
      const result = await pushDocument(owner, repo, category, filename, content, commitMessage);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to push document" });
    }
  });

  app.post("/api/github/inbox/:owner/:repo/:direction", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const direction = req.params.direction as string;
      if (direction !== 'to-agent' && direction !== 'to-team') {
        return res.status(400).json({ error: "direction must be 'to-agent' or 'to-team'" });
      }
      const { filename, content } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ error: "filename and content are required" });
      }
      const result = await pushInboxMessage(owner, repo, direction, filename, content);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to push inbox message" });
    }
  });

  app.get("/api/github/inbox/:owner/:repo/:direction", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const owner = req.params.owner as string;
      const repo = req.params.repo as string;
      const direction = req.params.direction as string;
      if (direction !== 'to-agent' && direction !== 'to-team') {
        return res.status(400).json({ error: "direction must be 'to-agent' or 'to-team'" });
      }
      const messages = await getInboxMessages(owner, repo, direction);
      res.json({ messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get inbox messages" });
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

  app.get("/api/daily-greeting", requireAuth, dailyGreetingLimiter, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const timeOfDay = (req.query.timeOfDay as string) || "morning";
    const validTimes = ["morning", "afternoon", "evening", "night"];
    const normalizedTime = validTimes.includes(timeOfDay) ? timeOfDay : "morning";

    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `${userId}-${today}`;

    const cached = dailyGreetingCache.get(cacheKey);
    if (cached) {
      return res.json({ message: cached, cached: true });
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are part of the Serene Empowerment brand. Generate a single short empowering sub-message (15-25 words max) for a user greeting. The message should fit the ${normalizedTime} time of day. Never use quotation marks. Be warm but not overly cheery. Focus on inner strength, resilience, and gentle encouragement. Examples of the tone: Your mind is your greatest asset. Every breath is a step forward. You've been showing up for yourself — that's real strength. Respond with ONLY the message, nothing else.`,
          },
          {
            role: "user",
            content: `Generate an empowering ${normalizedTime} greeting sub-message.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 50,
      });

      let message = response.choices[0]?.message?.content?.trim() || dailyGreetingFallbacks[normalizedTime];
      message = message.replace(/["""'']/g, "");

      dailyGreetingCache.set(cacheKey, message);
      res.json({ message, cached: false });
    } catch (error) {
      console.error("Daily greeting generation failed:", error);
      res.json({ message: dailyGreetingFallbacks[normalizedTime], cached: false });
    }
  });

  setInterval(async () => {
    try {
      console.log("[Voice Rotation] Running scheduled voice cleanup...");
      const results = await runVoiceRotation(60);
      if (results.rotated > 0) {
        console.log(`[Voice Rotation] Rotated ${results.rotated} inactive voices`);
      } else {
        console.log("[Voice Rotation] No inactive voices to rotate");
      }

      const warning = await checkVoiceSlotWarning();
      if (warning) {
        console.warn(warning);
      }
    } catch (error) {
      console.error("[Voice Rotation] Scheduled cleanup failed:", error);
    }
  }, 24 * 60 * 60 * 1000);

  const httpServer = createServer(app);

  return httpServer;
}

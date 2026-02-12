import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { affirmations, voiceSamples, categories, users, collections, customCategories, notificationSettings, reminders, listeningSessions, breathingSessions, supportRequests } from "@shared/schema";
import { eq, desc, asc, and, sql, sum, isNull } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";
import OpenAI from "openai";
import { isPremiumUser, FREE_FEATURES, PREMIUM_FEATURES_LIST, BETA_MODE } from "./premium";
import { MOOD_TAG_PREFERENCES, type MoodType, type TimeOfDay } from "@shared/pillars";
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
import { moderateContent, moderateMultipleTexts, validateAffirmationContent } from "./moderation";
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

const guidedMomentLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: { error: "You've reached today's limit for micro-meditations. Come back tomorrow for a fresh session." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const authReq = req as AuthenticatedRequest;
    return `guided-${authReq.userId || req.ip || "unknown"}`;
  },
});

const MEDITATION_MOOD_CONFIG: Record<string, {
  scriptTone: string;
  humeSpeed: number;
  pauseSeconds: number;
  elevenLabsStability: number;
  elevenLabsStyle: number;
}> = {
  calm: {
    scriptTone: "serene, spacious, and deeply unhurried — like floating on still water. Use languid, flowing language with long vowel sounds. Invite the listener to sink deeper into stillness.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.25,
  },
  stressed: {
    scriptTone: "soothing, reassuring, and safe — like a warm blanket wrapping around tension. Use short, simple sentences that feel like exhales. Emphasize releasing, letting go, and being held.",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  tired: {
    scriptTone: "gentle, nurturing, and restoring — like soft morning light. Use comforting, cozy language. Acknowledge weariness with compassion before gently inviting renewal.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.25,
  },
  energized: {
    scriptTone: "uplifting, dynamic, and motivating — like standing on a mountaintop with wind in your hair. Use vivid action words, strong verbs, and forward momentum. The pace should feel alive and purposeful, not calm or sleepy. Think motivational coach meets mindfulness, not lullaby.",
    humeSpeed: 1.1,
    pauseSeconds: 1.0,
    elevenLabsStability: 0.35,
    elevenLabsStyle: 0.5,
  },
  anxious: {
    scriptTone: "grounding, steady, and anchoring — like roots growing deep into earth. Use concrete, physical language (feet on ground, weight of body, solid surfaces). Repeat grounding cues. Prioritize predictability and safety in word choice.",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2,
  },
  grateful: {
    scriptTone: "warm, expansive, and heartfelt — like sunlight spreading across your chest. Use rich sensory language about warmth, light, and connection. Invite savoring and appreciation with an open, generous tone.",
    humeSpeed: 0.95,
    pauseSeconds: 1.5,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.4,
  },
};

const PILLAR_VOICE_CONFIG: Record<string, {
  humeSpeed: number;
  pauseSeconds: number;
  elevenLabsStability: number;
  elevenLabsStyle: number;
}> = {
  mind: {
    humeSpeed: 0.95,
    pauseSeconds: 1.2,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.35,
  },
  body: {
    humeSpeed: 1.0,
    pauseSeconds: 1.0,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.4,
  },
  spirit: {
    humeSpeed: 0.88,
    pauseSeconds: 1.6,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  connection: {
    humeSpeed: 0.95,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45,
  },
  achievement: {
    humeSpeed: 1.05,
    pauseSeconds: 0.9,
    elevenLabsStability: 0.4,
    elevenLabsStyle: 0.5,
  },
};

function getPillarVoiceConfig(pillar?: string | null): typeof MEDITATION_MOOD_CONFIG[string] | undefined {
  if (!pillar) return undefined;
  const key = pillar.toLowerCase();
  const config = PILLAR_VOICE_CONFIG[key];
  if (!config) return undefined;
  return { ...config, scriptTone: '' };
}

const dailyGreetingCache = new Map<string, { message: string; actionText?: string; actionType?: string }>();

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

9. WORD VARIETY: Avoid overusing any single verb or adjective. Specifically, do NOT overuse these words: embrace, unlock, harness, ignite, unleash, manifest, radiate, transcend, awaken, abundant, limitless, boundless, infinite. Use each at most ONCE across the entire script, and prefer simpler, more natural alternatives like "welcome", "hold", "carry", "choose", "build", "step into", "notice", "trust".

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
          content: `You are a title generator for personalized affirmations. Create a short, inspiring title (3-6 words) that captures the core theme of the affirmation.

CRITICAL RULES:
- Be specific and vivid — reflect the unique theme, not generic motivation
- Use fresh, varied language — never default to the same patterns
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

BAD TITLE EXAMPLES (REJECTED — uses banned words):
- Embrace Your Inner Power
- Unlock Your True Potential
- Radiate Boundless Energy
- Manifest Infinite Abundance
- Embracing Growth and Confidence
- Embrace the Abundance Within

Respond with ONLY the title, nothing else.`,
        },
        {
          role: "user",
          content: script,
        },
      ],
      temperature: 0.9,
      max_tokens: 30,
    });

    let title = response.choices[0]?.message?.content?.trim() || "My Affirmation";
    title = title.replace(/^["']|["']$/g, "");
    return title;
  } catch (error) {
    console.error("Auto-title generation failed:", error);
    return "My Affirmation";
  }
}

async function autoGenerateDescription(script: string, goal?: string): Promise<string> {
  try {
    const userContext = goal 
      ? `\nUSER'S ORIGINAL GOAL: "${goal}"\nUse this goal to ground the description in what the user actually wants to achieve.`
      : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You write short, clear descriptions for affirmation cards in a mindfulness app. Write one sentence (8-15 words) that explains what this affirmation is about — its purpose and theme.

RULES:
- Be clear and grounded — describe what the affirmation helps with, not how it makes you feel
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
Respond with ONLY the description, nothing else.`,
        },
        { role: "user", content: script },
      ],
      temperature: 0.7,
      max_tokens: 40,
    });

    return response.choices[0]?.message?.content?.trim().replace(/['"]/g, '').replace(/\.$/, '') || "";
  } catch (error) {
    console.error("Error generating description:", error);
    return "";
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
      throw new Error("PERSONAL_VOICE_FAILED: Could not generate audio with your Inner Voice. Please try again or re-record your voice.");
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
  isPersonalVoice: boolean = false,
  moodConfig?: typeof MEDITATION_MOOD_CONFIG[string]
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  // Personal voice: always use ElevenLabs (voice clones live there)
  if (isPersonalVoice) {
    try {
      const result = await elevenLabsTTS(script, voiceId, moodConfig ? {
        stability: moodConfig.elevenLabsStability,
        style: moodConfig.elevenLabsStyle,
        pauseSeconds: moodConfig.pauseSeconds,
      } : undefined);
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
      throw new Error("PERSONAL_VOICE_FAILED: Could not generate audio with your Inner Voice. Please try again or re-record your voice.");
    }
  }

  // Stock AI voice: use Hume AI (primary), OpenAI (fallback)
  const humeName = getHumeVoiceNameForId(voiceId);
  
  if (humeName) {
    try {
      console.log(`Using Hume AI TTS for stock voice: ${humeName}`);
      const result = await humeTextToSpeech(script, humeName, moodConfig?.humeSpeed, moodConfig?.pauseSeconds);
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
      if (!/^(affirmation|voice)[-\w]+\.(mp3|m4a|wav|webm)$/.test(filename)) {
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

  app.post("/api/moderate-content", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }
      const result = await moderateContent(text);
      res.json(result);
    } catch (error) {
      console.error("Moderation check error:", error);
      res.json({ flagged: false, categories: [], message: "" });
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

      // Validate goal input — checks both explicit content and affirmation alignment
      const goalModResult = await validateAffirmationContent(goal);
      if (goalModResult.flagged) {
        return res.status(422).json({
          error: "content_flagged", 
          message: goalModResult.message,
          categories: goalModResult.categories
        });
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
      
      const [title, description] = await Promise.all([
        autoGenerateTitle(script),
        autoGenerateDescription(script, goal),
      ]);
      
      // Increment usage counter after successful generation
      await db
        .update(users)
        .set({
          affirmationsThisMonth: (limits.affirmationsThisMonth + 1)
        })
        .where(eq(users.id, req.userId!));

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

  // Create affirmation with voice synthesis (requires auth)
  // Rate limited: max 10 TTS requests per minute
  app.post("/api/affirmations/create-with-voice", requireAuth, ttsLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, script, pillar, categories, category, isManual, forceAiVoice, description } = req.body;

      if (!script) {
        return res.status(400).json({ error: "Script is required" });
      }

      // Content moderation check — validates both explicit content and affirmation alignment
      const textsToCheck = [script, title].filter(Boolean);
      if (categories && Array.isArray(categories)) {
        textsToCheck.push(...categories);
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
          usedPersonalVoice,
          getPillarVoiceConfig(pillar)
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
          audioResult = await generateAudio(script, fallbackVoiceId, false, getPillarVoiceConfig(pillar));
        } else if (usedPersonalVoice && (genError?.message?.includes("PERSONAL_VOICE_FAILED") || genError?.message?.includes("VOICE_EXPIRED"))) {
          console.log("Personal voice not found/expired, falling back to AI voice");
          const fallbackGender = usedGender || "female";
          const fallbackVoiceId = fallbackGender === "male"
            ? (userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id)
            : (userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id);
          usedPersonalVoice = false;
          voiceIdToUse = fallbackVoiceId;
          audioResult = await generateAudio(script, fallbackVoiceId, false, getPillarVoiceConfig(pillar));
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
          description: finalDescription || null,
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
        res.status(422).json({ error: "PERSONAL_VOICE_FAILED", message: "Could not generate audio with your Inner Voice. You can try again or switch to an AI voice." });
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

      // Content moderation check on the script
      const autoSaveModResult = await moderateContent(script);
      if (autoSaveModResult.flagged) {
        return res.status(422).json({
          error: "content_flagged",
          message: autoSaveModResult.message,
          categories: autoSaveModResult.categories
        });
      }
      
      // Only auto-categorize if no category is set
      const hasCategory = affirmation.categoryName;
      
      // Generate AI title, description and category in parallel
      const [generatedTitle, generatedDescription, newCategoryName] = await Promise.all([
        autoGenerateTitle(script),
        autoGenerateDescription(script),
        hasCategory ? Promise.resolve(null) : autoCategorizе(script),
      ]);

      // Update the affirmation - only set categoryName if not already set
      const [updated] = await db
        .update(affirmations)
        .set({
          title: generatedTitle,
          description: generatedDescription || undefined,
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

  app.post("/api/affirmations/backfill-descriptions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userAffirmations = await db
        .select({ id: affirmations.id, script: affirmations.script })
        .from(affirmations)
        .where(and(
          eq(affirmations.userId, req.userId!),
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
            await db
              .update(affirmations)
              .set({ description, updatedAt: new Date() })
              .where(eq(affirmations.id, aff.id));
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
      { id: "hume_lotus", name: "Lotus", description: "Peaceful, guiding presence", provider: "HUME_AI", humeName: "Female Meditation Guide" },
      { id: "hume_seraphina", name: "Seraphina", description: "Tranquil, radiant calm", provider: "HUME_AI", humeName: "Serene Assistant" },
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

      console.log(`Generating voice preview for: ${voiceId} (${validVoice.name})`);
      const audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, voiceId);

      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      console.log(`Voice preview generated successfully for ${validVoice.name}, size: ${base64Audio.length} chars`);
      res.json({ 
        audio: base64Audio,
        voiceName: validVoice.name,
      });
    } catch (error: any) {
      console.error("Error generating voice preview:", error?.message || error);
      res.status(500).json({ error: "Failed to generate voice preview. Please try again." });
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
        return res.status(400).json({ error: "No Inner Voice recorded. Please record your voice first." });
      }

      let audioBuffer: ArrayBuffer;
      try {
        audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, user.voiceId, true);
      } catch (ttsError: any) {
        const msg = ttsError?.message || "";
        if (msg.includes("PERSONAL_VOICE_FAILED") || msg.includes("voice_not_found") || msg.includes("404")) {
          return res.status(422).json({ 
            error: "VOICE_EXPIRED",
            message: "Your voice clone may have expired. Please re-record your voice to continue using Inner Voice features."
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
        voiceName: "Inner Voice",
      });
    } catch (error) {
      console.error("Error generating Inner Voice preview:", error);
      res.status(500).json({ error: "Failed to generate Inner Voice preview. Please try again." });
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
        preferredFemaleVoiceId: user.preferredFemaleVoiceId || "hume_lotus",
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
            message: "Your personal voice has expired. Please re-record your voice sample to continue using your Inner Voice, or switch to an AI voice.",
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
      const audioResult = await generateAudio(affirmation.script, voiceIdToUse, isPersonalVoice, getPillarVoiceConfig(affirmation.pillar));

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
          message: "Could not generate audio with your Inner Voice. Please try again or switch to an AI voice."
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
          categoryName: "Gratitude,Joy",
          script: "I am grateful for this quiet moment. Gratitude fills me like warm sunlight. I appreciate the small blessings that surround me today. In stillness, I discover that everything I need is already within me.",
        },
        {
          title: "Present with Others",
          pillar: "Connection",
          categoryName: "Love,Self-Compassion",
          script: "I am fully present when I am with the people I love. I listen with patience and speak with kindness. By nurturing my own inner peace through meditation, I bring a calmer, more compassionate version of myself to every conversation. I attract meaningful connections because I first connect deeply with myself. The love I cultivate in stillness radiates outward and touches everyone around me.",
        },
        {
          title: "Focused Achievement",
          pillar: "Achievement",
          categoryName: "Career,Drive",
          script: "I accomplish my goals with steady focus. Each morning I take a moment to breathe, set my intention, and move forward with clarity. Success flows naturally when my mind is calm.",
        },
        {
          title: "Peaceful Home",
          pillar: "Home",
          categoryName: "Family,Comfort",
          script: "My home is a sanctuary of peace and warmth. I create calm in my living space by first cultivating calm within myself. When I pause to breathe and center my thoughts, that serenity flows into every room. My family feels safe and loved because I choose presence over distraction. I tend to my home with the same gentle attention I give to my meditation practice. Order, beauty, and tranquility are not things I chase. They are things I create, one mindful moment at a time. My home reflects the peace I carry inside.",
        },
      ];

      const voiceRotation = [
        { id: "hume_lotus", gender: "female" },
        { id: "hume_orion", gender: "male" },
        { id: "hume_amber", gender: "female" },
        { id: "hume_sage", gender: "male" },
        { id: "hume_nova", gender: "female" },
        { id: "hume_atlas", gender: "male" },
      ];
      const createdAffirmations = [];

      // Ensure audio subdirectory exists
      const audioDir = path.join(uploadDir, "audio");
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      for (let idx = 0; idx < sampleAffirmations.length; idx++) {
        const sample = sampleAffirmations[idx];
        const voice = voiceRotation[idx % voiceRotation.length];
        try {
          const audioResult = await generateAudio(sample.script, voice.id);
          
          const audioFilename = `affirmation-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
          const audioPath = path.join(audioDir, audioFilename);
          fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));

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
              voiceGender: voice.gender,
              aiVoiceId: voice.id,
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

  // ============ Mood Check-in API ============

  app.post("/api/mood-prompt", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentMood, timeOfDay } = req.body;
      if (!currentMood || !timeOfDay) {
        return res.status(400).json({ error: "currentMood and timeOfDay are required" });
      }

      const userId = req.userId!;
      const userData = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
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
  "title": "A short, warm 3-6 word title that acknowledges their ${currentMood} feeling and hints at transformation. Use ${userName}'s name sometimes but not always. Examples for stressed: 'Let's lighten that load, ${userName}', 'You deserve some ease'. Examples for tired: 'Rest is calling you', 'Time to recharge, ${userName}'. Examples for anxious: 'Let's find your ground'. Examples for calm: 'Beautiful — let's build on this'. Examples for energized: 'Love that spark, ${userName}'. Examples for grateful: 'What a gift that is'. Never use emojis.",
  "subtitle": "A short 5-10 word sentence about choosing their destination mood. Creative and warm, not clinical. Examples: 'Pick the feeling you want to carry', 'Where shall we take you?', 'Choose the version of you that's waiting'. Never use emojis."
}

Rules:
- Be specific to the ${currentMood} mood, not generic
- Sound like a wise, warm friend
- Vary language dramatically each time
- No exclamation marks, no emojis
- Keep it concise and punchy`,
            },
            {
              role: "user",
              content: `I'm feeling ${currentMood} right now. It's ${timeOfDay}.`,
            },
          ],
          temperature: 0.95,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        res.json({
          title: parsed.title || "Where would you like to be?",
          subtitle: parsed.subtitle || "Choose your destination",
        });
      } catch (aiError) {
        res.json({
          title: "Where would you like to be?",
          subtitle: "Choose your destination",
        });
      }
    } catch (error) {
      console.error("Error generating mood prompt:", error);
      res.status(500).json({ error: "Failed to generate prompt" });
    }
  });

  app.post("/api/mood-checkin", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { mood, targetMood, timeOfDay } = req.body;

      if (!mood || !targetMood || !timeOfDay) {
        return res.status(400).json({ error: "mood, targetMood, and timeOfDay are required" });
      }

      const validStartingMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed"];
      const validTargetMoods = ["calm", "energized", "grateful", "confident", "focused", "joyful"];
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

      const userId = req.userId!;

      const [userData, userAffirmationsList, latestVoiceSample] = await Promise.all([
        db.select({ name: users.name, voiceId: users.voiceId }).from(users).where(eq(users.id, userId)).limit(1),
        db.select({
          id: affirmations.id,
          title: affirmations.title,
          description: affirmations.description,
          pillar: affirmations.pillar,
          categoryName: affirmations.categoryName,
          voiceType: affirmations.voiceType,
          audioUrl: affirmations.audioUrl,
          playCount: affirmations.playCount,
          isFavorite: affirmations.isFavorite,
        }).from(affirmations).where(eq(affirmations.userId, userId)),
        db.select({ status: voiceSamples.status, voiceId: voiceSamples.voiceId })
          .from(voiceSamples)
          .where(eq(voiceSamples.userId, userId))
          .orderBy(desc(voiceSamples.createdAt))
          .limit(1),
      ]);

      const user = userData[0];
      const userName = user?.name?.split(" ")[0] || "Friend";
      const hasClonedVoice = !!(latestVoiceSample[0]?.status === "ready" && latestVoiceSample[0]?.voiceId) || !!user?.voiceId;
      const hasAffirmations = userAffirmationsList.length > 0;
      const hasAffirmationsWithAudio = userAffirmationsList.filter(a => a.audioUrl).length > 0;

      const moodPrefs = MOOD_TAG_PREFERENCES[mood as MoodType]?.[timeOfDay as TimeOfDay];
      const preferredTags = moodPrefs?.preferredTags || [];
      const preferredPillars = moodPrefs?.preferredPillars || ["Mind"];

      let matchedAffirmation: { id: number; title: string; description: string | null; voiceType: string | null } | null = null;
      let matchReason: "tag" | "pillar" | "any" | null = null;

      const withAudio = userAffirmationsList.filter(a => a.audioUrl);

      if (withAudio.length > 0) {
        const scoreAffirmation = (a: typeof withAudio[0]) => {
          let score = 0;
          const tags = (a.categoryName || "").split(",").map(t => t.trim()).filter(Boolean);
          const tagMatches = tags.filter(t => preferredTags.includes(t)).length;
          score += tagMatches * 3;
          if (a.pillar && preferredPillars.includes(a.pillar)) {
            score += preferredPillars.indexOf(a.pillar) === 0 ? 2 : 1;
          }
          if (a.isFavorite) score += 1;
          return score;
        };

        const scored = withAudio.map(a => ({ ...a, score: scoreAffirmation(a) }));
        scored.sort((a, b) => b.score - a.score);

        const topScore = scored[0].score;
        if (topScore > 0) {
          const topPool = scored.filter(a => a.score === topScore);
          const picked = topPool[Math.floor(Math.random() * topPool.length)];
          matchedAffirmation = picked;
          matchReason = topScore >= 3 ? "tag" : "pillar";
        } else {
          matchedAffirmation = withAudio[Math.floor(Math.random() * withAudio.length)];
          matchReason = "any";
        }
      }

      const suggestedCreationTheme = !matchedAffirmation ? (() => {
        const themeMap: Record<string, Record<string, string>> = {
          stressed: { morning: "calm clarity to start your day", afternoon: "releasing tension and finding ease", evening: "letting go of the day's weight", night: "peaceful surrender into rest" },
          anxious: { morning: "grounded confidence for the day ahead", afternoon: "calm resilience and inner safety", evening: "releasing worry and finding peace", night: "safe, calm sleep and letting go of fear" },
          tired: { morning: "gentle energy and vitality", afternoon: "renewed focus and stamina", evening: "restful sleep and deep recovery", night: "peaceful sleep and body restoration" },
          sad: { morning: "warmth and gentle hope for the day", afternoon: "finding light in the present moment", evening: "self-compassion and tender care", night: "comfort and knowing tomorrow is new" },
          overwhelmed: { morning: "simplicity and one step at a time", afternoon: "clearing the noise and finding clarity", evening: "releasing what you can't control", night: "letting go and trusting the process" },
          calm: { morning: "deepening your morning serenity", afternoon: "sustaining your peaceful presence", evening: "gratitude and gentle reflection", night: "honoring your calm with restful sleep" },
        };
        return themeMap[mood]?.[timeOfDay] || "your current emotional state";
      })() : null;

      const moodPairBreathMap: Record<string, { name: string; id: string }> = {
        "stressed→calm": { name: "4-7-8 Relaxation", id: "478" },
        "stressed→energized": { name: "Box Breathing", id: "box" },
        "stressed→grateful": { name: "Coherent Breathing", id: "coherent" },
        "stressed→confident": { name: "Box Breathing", id: "box" },
        "stressed→focused": { name: "Box Breathing", id: "box" },
        "stressed→joyful": { name: "Coherent Breathing", id: "coherent" },
        "anxious→calm": { name: "4-7-8 Relaxation", id: "478" },
        "anxious→grateful": { name: "Box Breathing", id: "box" },
        "anxious→confident": { name: "Box Breathing", id: "box" },
        "anxious→focused": { name: "4-7-8 Relaxation", id: "478" },
        "anxious→energized": { name: "Box Breathing", id: "box" },
        "anxious→joyful": { name: "Coherent Breathing", id: "coherent" },
        "tired→energized": { name: "Energizing Breath", id: "energizing" },
        "tired→calm": { name: "Coherent Breathing", id: "coherent" },
        "tired→focused": { name: "Energizing Breath", id: "energizing" },
        "tired→confident": { name: "Energizing Breath", id: "energizing" },
        "tired→grateful": { name: "Coherent Breathing", id: "coherent" },
        "tired→joyful": { name: "Energizing Breath", id: "energizing" },
        "sad→calm": { name: "Coherent Breathing", id: "coherent" },
        "sad→grateful": { name: "Coherent Breathing", id: "coherent" },
        "sad→joyful": { name: "Energizing Breath", id: "energizing" },
        "sad→confident": { name: "Box Breathing", id: "box" },
        "sad→energized": { name: "Energizing Breath", id: "energizing" },
        "sad→focused": { name: "Box Breathing", id: "box" },
        "overwhelmed→calm": { name: "4-7-8 Relaxation", id: "478" },
        "overwhelmed→focused": { name: "Box Breathing", id: "box" },
        "overwhelmed→grateful": { name: "Coherent Breathing", id: "coherent" },
        "overwhelmed→confident": { name: "Box Breathing", id: "box" },
        "overwhelmed→energized": { name: "Box Breathing", id: "box" },
        "overwhelmed→joyful": { name: "Coherent Breathing", id: "coherent" },
        "calm→energized": { name: "Energizing Breath", id: "energizing" },
        "calm→grateful": { name: "Coherent Breathing", id: "coherent" },
        "calm→confident": { name: "Energizing Breath", id: "energizing" },
        "calm→focused": { name: "Box Breathing", id: "box" },
        "calm→joyful": { name: "Coherent Breathing", id: "coherent" },
      };

      const moodOnlyBreathFallback: Record<string, { name: string; id: string }> = {
        stressed: { name: "Box Breathing", id: "box" },
        anxious: { name: "4-7-8 Relaxation", id: "478" },
        tired: { name: "Energizing Breath", id: "energizing" },
        sad: { name: "Coherent Breathing", id: "coherent" },
        overwhelmed: { name: "4-7-8 Relaxation", id: "478" },
        calm: { name: "Coherent Breathing", id: "coherent" },
      };

      const pairKey = `${mood}→${targetMood}`;
      const breathing = moodPairBreathMap[pairKey] || moodOnlyBreathFallback[mood] || { name: "Box Breathing", id: "box" };

      let listenContext = "";
      if (matchedAffirmation) {
        const isInnerVoice = matchedAffirmation.voiceType === "personal";
        const matchQuality = matchReason === "tag" ? "closely matches their mood and time of day" : matchReason === "pillar" ? "aligns with their current emotional needs" : "is available to listen to";
        const descriptionContext = matchedAffirmation.description ? ` This affirmation is "${matchedAffirmation.description}".` : "";
        listenContext = `The user has an affirmation called "${matchedAffirmation.title}"${isInnerVoice ? " recorded in their own cloned voice (Inner Voice)" : ""} that ${matchQuality}.${descriptionContext} It is ${timeOfDay} — tailor your note accordingly.`;
      } else if (hasAffirmations) {
        listenContext = `The user has affirmations but none with audio yet. It is ${timeOfDay} — suggest bringing one to life.`;
      } else {
        listenContext = `The user hasn't created any affirmations yet. Suggest creating one about ${suggestedCreationTheme}.`;
      }

      const voiceContext = hasClonedVoice
        ? "The user has set up their Inner Voice (personal cloned voice)."
        : "The user hasn't set up their Inner Voice yet — hearing affirmations in your own voice deepens subconscious impact.";

      let journeyTitle = "Your Journey";
      let acknowledgment = `${userName}, let's take you from ${mood} to ${targetMood}.`;
      let stepTypes: string[] = ["breathe", "meditate"];
      let breatheNote: string | null = `Two minutes of ${breathing.name} can help settle your nervous system.`;
      let meditateNote: string | null = "A 2-minute guided moment to reconnect with yourself.";
      let listenNote: string | null = matchedAffirmation
        ? `Your affirmation "${matchedAffirmation.title}" is waiting for you.`
        : suggestedCreationTheme ? `Create an affirmation about ${suggestedCreationTheme}.` : "Create an affirmation that speaks to how you feel.";

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are the voice of Retuned, a personal wellness app. The user wants to journey from feeling ${mood} to feeling ${targetMood}. Design a personalized wellness journey with 2-3 steps (minimum 2, maximum 3) from these tools: breathe, meditate, listen.

Choose steps wisely — not every journey needs all three. Consider:
- If user is already calm, they probably don't need breathing
- If they want energy, meditation alone won't cut it
- If they're anxious, breathing should almost always be first
- Order matters: breathing first to settle the body, meditation to shift the mind, listening to reinforce

User context:
- Name: ${userName}
- Current mood: ${mood}
- Target mood: ${targetMood}
- Time: ${timeOfDay}
- ${listenContext}
- ${voiceContext}
- Total affirmations: ${userAffirmationsList.length}
- Best breathing match for this transition: ${breathing.name}

Respond as JSON with exactly these fields:
{
  "journeyTitle": "A creative 2-5 word title for this journey (like 'From Storm to Stillness', 'Finding Your Spark', 'Back to Center'). Should capture the mood transition. No emojis.",
  "acknowledgment": "1-2 sentences, max 25 words total. Use ${userName}'s name. Validate their current ${mood} feeling specifically (not generically), then create excitement about reaching ${targetMood}. Reference both moods. Be direct and real, not vague. Never use emojis. BAD examples (too generic): 'Looks like tonight is a bit tough for you' / 'Sounds like a tough night'. GOOD examples: '${userName}, that ${mood} feeling doesn't have to stay — let's move you toward ${targetMood}', '${userName}, going from ${mood} to ${targetMood} is totally doable right now'.",
  "stepTypes": ["breathe", "meditate", "listen"],
  "breatheNote": "One punchy sentence (max 20 words) or null if breathe is not in stepTypes. Naturally mention that this is a 2-minute exercise. Explain WHY ${breathing.name} specifically helps for the ${mood}→${targetMood} transition — reference a real physical effect but in plain everyday language. Make it feel like insider knowledge, not textbook.",
  "meditateNote": "One punchy sentence (max 20 words) or null if meditate is not in stepTypes. Naturally mention that this is a 2-minute guided meditation. Explain why it uniquely helps shift from ${mood} to ${targetMood} at ${timeOfDay}. Connect it to something real about their transition.",
  "listenNote": "One or two sentences (max 30 words) or null if listen is not in stepTypes. ${matchedAffirmation ? `Reference '${matchedAffirmation.title}' specifically.${matchedAffirmation.description ? ` Use the affirmation's description — "${matchedAffirmation.description}" — to explain WHY this particular affirmation is the perfect fit for the ${mood}→${targetMood} transition right now.` : ` Explain why hearing it NOW during this ${mood}→${targetMood} transition would land differently than usual.`}` : hasAffirmations ? `Make them excited to play one of their existing affirmations right now — connect it to the ${mood}→${targetMood} journey.` : `Inspire them to create their first affirmation about ${suggestedCreationTheme}${!hasClonedVoice ? " — mention how hearing it in their own cloned voice makes it 10x more powerful" : ""}. Make creation feel exciting, not like homework.`}"
}

Rules for stepTypes:
- Must be an array of 2-3 strings from: "breathe", "meditate", "listen"
- Order them in the sequence the user should do them
- Be smart about which steps to include for this specific ${mood}→${targetMood} transition

Rules for tone:
- Be specific and insightful, never generic
- Sound like a smart friend who knows about wellness, not a greeting card
- No flowery metaphors or poetic language
- No "you should" — use "let's" or direct suggestions
- No exclamation marks
- Each note must teach them something or create curiosity — not just describe the feature
- Vary your language dramatically between responses`,
            },
            {
              role: "user",
              content: `I'm feeling ${mood} and I want to feel ${targetMood}. It's ${timeOfDay}.`,
            },
          ],
          temperature: 0.8,
          max_tokens: 350,
          response_format: { type: "json_object" },
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        if (parsed.journeyTitle) journeyTitle = parsed.journeyTitle;
        if (parsed.acknowledgment) acknowledgment = parsed.acknowledgment;
        if (Array.isArray(parsed.stepTypes) && parsed.stepTypes.length >= 2 && parsed.stepTypes.length <= 3) {
          const validStepTypes = parsed.stepTypes.filter((s: string) => ["breathe", "meditate", "listen"].includes(s));
          if (validStepTypes.length >= 2) {
            stepTypes = validStepTypes;
          }
        }
        if (parsed.breatheNote) breatheNote = parsed.breatheNote;
        if (parsed.meditateNote) meditateNote = parsed.meditateNote;
        if (parsed.listenNote) listenNote = parsed.listenNote;
      } catch (e) {}

      if (!stepTypes.includes("listen")) {
        stepTypes.push("listen");
      }
      const reordered = stepTypes.filter((s: string) => s !== "listen");
      reordered.push("listen");

      const steps: any[] = [];
      for (const stepType of reordered) {
        if (stepType === "breathe") {
          steps.push({
            type: "breathe",
            techniqueId: breathing.id,
            techniqueName: breathing.name,
            duration: 3,
            note: breatheNote || `${breathing.name} can help settle your nervous system.`,
          });
        } else if (stepType === "meditate") {
          steps.push({
            type: "meditate",
            note: meditateNote || "A guided moment to reconnect with yourself.",
            mood: targetMood,
            timeOfDay,
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
            suggestedTheme: suggestedCreationTheme,
          });
        }
      }

      res.json({
        journeyTitle,
        acknowledgment,
        currentMood: mood,
        targetMood,
        steps,
      });
    } catch (error) {
      console.error("Error in mood check-in:", error);
      res.status(500).json({ error: "Failed to process mood check-in" });
    }
  });

  // ============ Micro-Meditations API ============

  app.post("/api/guided-moments/script", requireAuth, guidedMomentLimiter, async (req: AuthenticatedRequest, res: Response) => {
    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    try {
      const { mood, timeOfDay, duration: rawDuration } = req.body;

      if (!mood || !timeOfDay) {
        return res.status(400).json({ error: "mood and timeOfDay are required" });
      }

      const validMoods = ["calm", "stressed", "tired", "energized", "anxious", "grateful"];
      const validTimes = ["morning", "afternoon", "evening", "night"];
      const validDurations = [1, 2, 3];

      if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: "Invalid mood value" });
      }
      if (!validTimes.includes(timeOfDay)) {
        return res.status(400).json({ error: "Invalid timeOfDay value" });
      }

      const duration = validDurations.includes(Number(rawDuration)) ? Number(rawDuration) : 1;

      const wordCountMap: Record<number, { min: number; max: number }> = {
        1: { min: 50, max: 75 },
        2: { min: 100, max: 145 },
        3: { min: 150, max: 210 },
      };
      const maxTokensMap: Record<number, number> = { 1: 200, 2: 350, 3: 450 };
      const wordCount = wordCountMap[duration] || wordCountMap[1];
      const maxTokens = maxTokensMap[duration] || 300;

      const durationLabel = duration === 1 ? "60-90 seconds" : `${duration} minutes`;

      const userId = req.userId!;

      const [userResult] = await Promise.all([
        db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
      ]);

      const userName = userResult[0]?.name?.split(" ")[0] || "Friend";

      const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const clientDayOfWeek = req.body.dayOfWeek;
      const dayOfWeek = (clientDayOfWeek && validDays.includes(clientDayOfWeek)) ? clientDayOfWeek : validDays[new Date().getDay()];

      if (clientDisconnected) {
        console.log(`Client disconnected before script generation (${duration}min), aborting`);
        return;
      }

      const moodConfig = MEDITATION_MOOD_CONFIG[mood] || MEDITATION_MOOD_CONFIG.calm;
      const paceDescription = mood === "energized" ? "at a lively, motivated pace" : "at a calm pace";

      console.log(`Generating micro-meditation script (${duration}min) for user ${userId} (${userName}), mood: ${mood}, time: ${timeOfDay}, day: ${dayOfWeek}`);

      const scriptResponse = await openai.chat.completions.create({
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
              `1. OPENING (1-2 sentences): Begin with a brief, natural acknowledgment of where they are in their week and day — weave the day and time of day into a warm, conversational greeting before the grounding cue. Examples: "It's ${dayOfWeek} ${timeOfDay} — let this be your moment of calm..." or "The middle of the week can feel long... right here, right now, you're choosing stillness." Keep it effortless, never forced. Then invite them to close their eyes, notice their breath, or feel their body.`,
              `2. BREATHING GUIDANCE (2-3 sentences): Lead a brief breathing cycle tailored to their mood. For stressed/anxious: slow exhales for vagus nerve activation. For tired: energizing breath with counts. For calm/grateful: simple awareness breath.${mood === "energized" ? " For energized: strong rhythmic breathing that builds momentum and channels power." : ""}`,
              `3. VISUALIZATION (3-4 sentences): Paint a vivid, sensory-rich scene using present tense. Include at least 2 senses (sight + touch, or sound + warmth, etc.). Match the imagery to their mood — calming scenes for stress, ${mood === "energized" ? "dynamic, expansive scenes with movement and light for energy" : "expansive scenes for energy"}, warm scenes for gratitude.`,
              `4. AFFIRMATION ANCHORING (2-3 sentences): Weave in identity-level affirmations using "I am" or "I choose" language. Use embedded commands naturally. Connect the affirmation to the visualization scene.`,
              `5. GENTLE RETURN (2-3 sentences): Slowly guide them back to their surroundings. Include a physical cue like "wiggle your fingers" or "notice the sounds around you." Then invite them to open their eyes when ready — never rush this transition. Add a pause ("...") before the final line.`,
              `6. WARM SIGN-OFF (1-2 sentences): End with a genuine, heartfelt send-off that feels like a friend wishing them well. Match the time of day: morning→"carry this into your day," afternoon→"let this fuel your afternoon," evening→"take this peace into your night." Occasionally (~30% of the time), add a playful or tender touch like "and don't forget to breathe" or "you've already done something beautiful today." The closing should feel like a gentle landing, never abrupt — the listener should feel held until the very last word.`,
              ``,
              `RULES:`,
              `- Total length: ${wordCount.min}-${wordCount.max} words (${durationLabel} ${paceDescription})`,
              `- Use the person's name once, naturally, about three-quarters of the way through — in the visualization or early affirmation anchoring section. Never at the very beginning, middle, or very end.`,
              `- Include natural pauses marked with "..." (3-4 throughout, including one before the final sign-off)`,
              `- Write in second person ("you") for guidance, first person ("I am") for affirmations`,
              `- Tone: ${moodConfig.scriptTone}`,
              `- No exclamation marks, no questions, no medical claims`,
              `- The day/time reference should feel organic and conversational — never robotic or templated. Vary your approach each time.`,
              `- The ending must never feel rushed or cut short. The last 2-3 sentences should slow down in pacing and feel like a soft exhale.`,
              `- Reference accessible neuroscience concepts naturally (e.g., "your nervous system settles," "each breath sends a signal of safety")`,
              `- Mood-specific emphasis: stressed→release/safety, anxious→grounding/presence, tired→vitality/awakening, calm→deepening/peace, energized→channeling/focus, grateful→expansion/abundance`,
              `- This is a mindfulness exercise, not medical advice`,
              ``,
              `Return ONLY the script text, no formatting or labels.`,
            ].join("\n"),
          },
          {
            role: "user",
            content: `Create a ${duration}-minute micro-meditation for someone named ${userName} feeling ${mood} on ${dayOfWeek} ${timeOfDay}.`,
          },
        ],
        temperature: 0.85,
        max_tokens: maxTokens,
      });

      const script = scriptResponse.choices[0]?.message?.content?.trim();
      if (!script) {
        return res.status(500).json({ error: "Failed to generate meditation script" });
      }

      console.log(`Script generated (${script.split(/\s+/).length} words): ${script.substring(0, 80)}...`);

      res.json({
        script,
        mood,
        disclaimer: "This is a mindfulness exercise for relaxation purposes. It is not a substitute for professional mental health care.",
      });
    } catch (error: any) {
      console.error("Error generating micro-meditation script:", error);
      res.status(500).json({ error: "Failed to generate micro-meditation script. Please try again." });
    }
  });

  app.post("/api/guided-moments/audio", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    try {
      const { script, usePersonalVoice, voiceId: rawVoiceId, mood } = req.body;
      const moodConfig = mood ? MEDITATION_MOOD_CONFIG[mood] : undefined;

      if (!script || typeof script !== "string" || script.trim().length === 0) {
        return res.status(400).json({ error: "script is required and must be a non-empty string" });
      }

      const userId = req.userId!;

      let voiceId = rawVoiceId;
      if (usePersonalVoice && !voiceId) {
        const voiceResult = await db.select({ voiceId: voiceSamples.voiceId }).from(voiceSamples)
          .where(and(eq(voiceSamples.userId, userId), eq(voiceSamples.status, "ready")))
          .orderBy(desc(voiceSamples.createdAt)).limit(1);
        if (voiceResult[0]?.voiceId) {
          voiceId = voiceResult[0].voiceId;
          console.log(`Resolved personal voice clone ID: ${voiceId} for user ${userId}`);
        } else {
          console.warn(`User ${userId} requested personal voice but no completed voice clone found`);
        }
      }

      if (clientDisconnected) {
        console.log(`Client disconnected before TTS, aborting`);
        return;
      }

      let audioBuffer: ArrayBuffer;
      let wordTimings: WordTiming[] = [];
      let audioDuration = 0;

      const ttsStartTime = Date.now();
      try {
        if (usePersonalVoice && voiceId) {
          const result = await generateAudio(script, voiceId, true, moodConfig);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        } else {
          const stockVoiceId = voiceId && isHumeVoice(voiceId) ? voiceId : "hume_lotus";
          const result = await generateAudio(script, stockVoiceId, false, moodConfig);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        }
      } catch (ttsError: any) {
        console.error("Guided moment TTS failed:", ttsError?.message || ttsError);
        return res.status(500).json({
          error: "Could not generate audio for your micro-meditation. Please try again.",
          code: ttsError?.message?.includes("QUOTA_EXCEEDED") ? "QUOTA_EXCEEDED" :
                ttsError?.message?.includes("VOICE_EXPIRED") ? "VOICE_EXPIRED" : "TTS_FAILED"
        });
      }
      const ttsTime = Date.now() - ttsStartTime;
      console.log(`TTS generated in ${ttsTime}ms`);

      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      res.json({
        audioBase64,
        duration: audioDuration,
        wordTimings,
      });
    } catch (error: any) {
      console.error("Error generating micro-meditation audio:", error);
      res.status(500).json({ error: "Failed to generate micro-meditation audio. Please try again." });
    }
  });

  app.post("/api/guided-moments/generate", requireAuth, guidedMomentLimiter, async (req: AuthenticatedRequest, res: Response) => {
    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    try {
      const { mood, timeOfDay, usePersonalVoice, voiceId: rawVoiceId, duration: rawDuration } = req.body;

      if (!mood || !timeOfDay) {
        return res.status(400).json({ error: "mood and timeOfDay are required" });
      }

      const validMoods = ["calm", "stressed", "tired", "energized", "anxious", "grateful"];
      const validTimes = ["morning", "afternoon", "evening", "night"];
      const validDurations = [1, 2, 3];

      if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: "Invalid mood value" });
      }
      if (!validTimes.includes(timeOfDay)) {
        return res.status(400).json({ error: "Invalid timeOfDay value" });
      }

      const duration = validDurations.includes(Number(rawDuration)) ? Number(rawDuration) : 1;

      const wordCountMap: Record<number, { min: number; max: number }> = {
        1: { min: 50, max: 75 },
        2: { min: 100, max: 145 },
        3: { min: 150, max: 210 },
      };
      const maxTokensMap: Record<number, number> = { 1: 200, 2: 350, 3: 450 };
      const wordCount = wordCountMap[duration] || wordCountMap[1];
      const maxTokens = maxTokensMap[duration] || 300;

      const durationLabel = duration === 1 ? "60-90 seconds" : `${duration} minutes`;

      const userId = req.userId!;
      const startTime = Date.now();

      const [userResult, voiceResult] = await Promise.all([
        db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
        (usePersonalVoice && !rawVoiceId)
          ? db.select({ voiceId: voiceSamples.voiceId }).from(voiceSamples)
              .where(and(eq(voiceSamples.userId, userId), eq(voiceSamples.status, "ready")))
              .orderBy(desc(voiceSamples.createdAt)).limit(1)
          : Promise.resolve([]),
      ]);

      const userName = userResult[0]?.name?.split(" ")[0] || "Friend";
      let voiceId = rawVoiceId;
      if (usePersonalVoice && !voiceId) {
        if (voiceResult[0]?.voiceId) {
          voiceId = voiceResult[0].voiceId;
          console.log(`Resolved personal voice clone ID: ${voiceId} for user ${userId}`);
        } else {
          console.warn(`User ${userId} requested personal voice but no completed voice clone found`);
        }
      }

      const validDaysLegacy = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const clientDayOfWeekLegacy = req.body.dayOfWeek;
      const dayOfWeek = (clientDayOfWeekLegacy && validDaysLegacy.includes(clientDayOfWeekLegacy)) ? clientDayOfWeekLegacy : validDaysLegacy[new Date().getDay()];

      if (clientDisconnected) {
        console.log(`Client disconnected before script generation (${duration}min), aborting`);
        return;
      }

      const moodConfig = MEDITATION_MOOD_CONFIG[mood] || MEDITATION_MOOD_CONFIG.calm;
      const paceDescription = mood === "energized" ? "at a lively, motivated pace" : "at a calm pace";

      console.log(`Generating micro-meditation (${duration}min) for user ${userId} (${userName}), mood: ${mood}, time: ${timeOfDay}, day: ${dayOfWeek}`);

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
              `1. OPENING (1-2 sentences): Begin with a brief, natural acknowledgment of where they are in their week and day — weave the day and time of day into a warm, conversational greeting before the grounding cue. Keep it effortless, never forced. Then invite them to close their eyes, notice their breath, or feel their body.`,
              `2. BREATHING GUIDANCE (2-3 sentences): Lead a brief breathing cycle tailored to their mood. For stressed/anxious: slow exhales for vagus nerve activation. For tired: energizing breath with counts. For calm/grateful: simple awareness breath.${mood === "energized" ? " For energized: strong rhythmic breathing that builds momentum and channels power." : ""}`,
              `3. VISUALIZATION (3-4 sentences): Paint a vivid, sensory-rich scene using present tense. Include at least 2 senses (sight + touch, or sound + warmth, etc.). Match the imagery to their mood — calming scenes for stress, ${mood === "energized" ? "dynamic, expansive scenes with movement and light for energy" : "expansive scenes for energy"}, warm scenes for gratitude.`,
              `4. AFFIRMATION ANCHORING (2-3 sentences): Weave in identity-level affirmations using "I am" or "I choose" language. Use embedded commands naturally. Connect the affirmation to the visualization scene.`,
              `5. GENTLE RETURN (2-3 sentences): Slowly guide them back to their surroundings. Include a physical cue like "wiggle your fingers" or "notice the sounds around you." Then invite them to open their eyes when ready — never rush this transition. Add a pause ("...") before the final line.`,
              `6. WARM SIGN-OFF (1-2 sentences): End with a genuine, heartfelt send-off that feels like a friend wishing them well. Match the time of day: morning→"carry this into your day," afternoon→"let this fuel your afternoon," evening→"take this peace into your night." Occasionally (~30% of the time), add a playful or tender touch like "and don't forget to breathe" or "you've already done something beautiful today." The closing should feel like a gentle landing, never abrupt — the listener should feel held until the very last word.`,
              ``,
              `RULES:`,
              `- Total length: ${wordCount.min}-${wordCount.max} words (${durationLabel} ${paceDescription})`,
              `- Use the person's name once, naturally, about three-quarters of the way through — in the visualization or early affirmation anchoring section. Never at the very beginning, middle, or very end.`,
              `- Include natural pauses marked with "..." (3-4 throughout, including one before the final sign-off)`,
              `- Write in second person ("you") for guidance, first person ("I am") for affirmations`,
              `- Tone: ${moodConfig.scriptTone}`,
              `- No exclamation marks, no questions, no medical claims`,
              `- The day/time reference should feel organic and conversational — never robotic or templated. Vary your approach each time.`,
              `- The ending must never feel rushed or cut short. The last 2-3 sentences should slow down in pacing and feel like a soft exhale.`,
              `- Reference accessible neuroscience concepts naturally (e.g., "your nervous system settles," "each breath sends a signal of safety")`,
              `- Mood-specific emphasis: stressed→release/safety, anxious→grounding/presence, tired→vitality/awakening, calm→deepening/peace, energized→channeling/focus, grateful→expansion/abundance`,
              `- This is a mindfulness exercise, not medical advice`,
              ``,
              `Return ONLY the script text, no formatting or labels.`,
            ].join("\n"),
          },
          {
            role: "user",
            content: `Create a ${duration}-minute micro-meditation for someone named ${userName} feeling ${mood} on ${dayOfWeek} ${timeOfDay}.`,
          },
        ],
        temperature: 0.85,
        max_tokens: maxTokens,
      });

      const scriptResponse = await scriptPromise;
      const script = scriptResponse.choices[0]?.message?.content?.trim();
      if (!script) {
        return res.status(500).json({ error: "Failed to generate meditation script" });
      }

      const scriptTime = Date.now() - startTime;
      console.log(`Script generated in ${scriptTime}ms (${script.split(/\s+/).length} words): ${script.substring(0, 80)}...`);

      if (clientDisconnected) {
        console.log(`Client disconnected after script generation (${duration}min), skipping TTS`);
        return;
      }

      let audioBuffer: ArrayBuffer;
      let wordTimings: WordTiming[] = [];
      let audioDuration = 0;

      const ttsStartTime = Date.now();
      try {
        if (usePersonalVoice && voiceId) {
          const result = await generateAudio(script, voiceId, true, moodConfig);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        } else {
          const stockVoiceId = voiceId && isHumeVoice(voiceId) ? voiceId : "hume_lotus";
          const result = await generateAudio(script, stockVoiceId, false, moodConfig);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        }
      } catch (ttsError: any) {
        console.error("Guided moment TTS failed:", ttsError?.message || ttsError);
        return res.status(500).json({ 
          error: "Could not generate audio for your micro-meditation. Please try again.",
          code: ttsError?.message?.includes("QUOTA_EXCEEDED") ? "QUOTA_EXCEEDED" : 
                ttsError?.message?.includes("VOICE_EXPIRED") ? "VOICE_EXPIRED" : "TTS_FAILED"
        });
      }
      const ttsTime = Date.now() - ttsStartTime;
      console.log(`TTS generated in ${ttsTime}ms`);

      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      const totalTime = Date.now() - startTime;
      console.log(`Micro-meditation (${duration}min) generated: ${audioDuration}s audio, ${audioBase64.length} base64 chars (script: ${scriptTime}ms, tts: ${ttsTime}ms, total: ${totalTime}ms)`);

      res.json({
        script,
        audioBase64,
        duration: audioDuration,
        wordTimings,
        mood,
        disclaimer: "This is a mindfulness exercise for relaxation purposes. It is not a substitute for professional mental health care.",
      });
    } catch (error: any) {
      console.error("Error generating micro-meditation:", error);
      res.status(500).json({ error: "Failed to generate micro-meditation. Please try again." });
    }
  });

  // ============ Reminders API ============

  async function generateReminderMessage(activityType: string, time: string, userName: string, currentMessage?: string): Promise<string> {
    try {
      const hour = parseInt(time.split(":")[0], 10);
      let timeOfDay = "morning";
      if (hour >= 21) timeOfDay = "night";
      else if (hour >= 17) timeOfDay = "evening";
      else if (hour >= 12) timeOfDay = "afternoon";

      const avoidClause = currentMessage
        ? `\nIMPORTANT: Do NOT repeat or rephrase this previous message: "${currentMessage}". Write something completely different.`
        : "";

      const techniqueGuidance = activityType === 'breathe'
        ? `\nYou MUST recommend a specific breathing technique based on time of day:
- Morning: "Energizing Breath" (quick 2-1 rhythm for energy and alertness)
- Afternoon: "Box Breathing" (4-4-4-4 for focus and grounding) or "Coherent Breathing" (5-5 for balance)
- Evening: "Coherent Breathing" (5-5 for heart coherence and winding down)
- Night: "4-7-8 Relaxation" (deep relaxation for sleep)
Include the technique name naturally in your message.`
        : "";

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
Respond with ONLY the notification message text.${avoidClause}`,
          },
          {
            role: "user",
            content: `Generate a ${activityType === 'breathe' ? 'meditation/breathing' : 'affirmation listening'} reminder for ${timeOfDay} time.`,
          },
        ],
        temperature: 1.0,
        max_tokens: 40,
      });

      const message = response.choices[0]?.message?.content?.trim();
      if (message) return message;
    } catch (error) {
      console.error("Failed to generate reminder message:", error);
    }

    return activityType === 'breathe'
      ? "A few mindful breaths can shift your entire day"
      : "Your affirmations are ready when you are";
  }

  app.get("/api/reminders", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;

      let userReminders = await db
        .select()
        .from(reminders)
        .where(eq(reminders.userId, userId))
        .orderBy(reminders.time);

      if (userReminders.length === 0) {
        const [oldSettings] = await db
          .select()
          .from(notificationSettings)
          .where(eq(notificationSettings.userId, userId))
          .limit(1);

        if (oldSettings) {
          const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
          const userName = user?.name || "Friend";

          const slotsToMigrate: { enabled: boolean | null; time: string | null }[] = [
            { enabled: oldSettings.morningEnabled, time: oldSettings.morningTime },
            { enabled: oldSettings.afternoonEnabled, time: oldSettings.afternoonTime },
            { enabled: oldSettings.eveningEnabled, time: oldSettings.eveningTime },
          ];

          for (const slot of slotsToMigrate) {
            if (slot.enabled && slot.time) {
              const message = await generateReminderMessage('believe', slot.time, userName);
              await db.insert(reminders).values({
                userId,
                activityType: 'believe',
                time: slot.time,
                enabled: true,
                notificationMessage: message,
              });
            }
          }

          userReminders = await db
            .select()
            .from(reminders)
            .where(eq(reminders.userId, userId))
            .orderBy(reminders.time);
        }
      }

      res.json(userReminders);
    } catch (error) {
      console.error("Error fetching reminders:", error);
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.post("/api/reminders", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { activityType, time, enabled } = req.body;

      if (!activityType || !time) {
        return res.status(400).json({ error: "activityType and time are required" });
      }

      const existing = await db
        .select()
        .from(reminders)
        .where(eq(reminders.userId, userId));

      if (existing.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 reminders allowed. Please delete one to add a new reminder." });
      }

      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const userName = user?.name || "Friend";
      const notificationMessage = await generateReminderMessage(activityType, time, userName);

      const [reminder] = await db
        .insert(reminders)
        .values({
          userId,
          activityType,
          time,
          enabled: enabled ?? true,
          notificationMessage,
        })
        .returning();

      res.json(reminder);
    } catch (error) {
      console.error("Error creating reminder:", error);
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });

  app.put("/api/reminders/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const reminderId = parseInt(req.params.id as string, 10);
      const { activityType, time, enabled } = req.body;

      const [existing] = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      const updates: Record<string, any> = {};
      if (activityType !== undefined) updates.activityType = activityType;
      if (time !== undefined) updates.time = time;
      if (enabled !== undefined) updates.enabled = enabled;

      const needsNewMessage =
        (activityType !== undefined && activityType !== existing.activityType) ||
        (time !== undefined && time !== existing.time);

      if (needsNewMessage) {
        const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
        const userName = user?.name || "Friend";
        updates.notificationMessage = await generateReminderMessage(
          activityType ?? existing.activityType,
          time ?? existing.time,
          userName
        );
      }

      const [updated] = await db
        .update(reminders)
        .set(updates)
        .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  app.delete("/api/reminders/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const reminderId = parseInt(req.params.id as string, 10);

      const [existing] = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      await db
        .delete(reminders)
        .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting reminder:", error);
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });

  app.post("/api/reminders/:id/regenerate-message", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const reminderId = parseInt(req.params.id as string, 10);

      const [existing] = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Reminder not found" });
      }

      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
      const userName = user?.name || "Friend";
      const notificationMessage = await generateReminderMessage(existing.activityType, existing.time, userName, existing.notificationMessage ?? undefined);

      const [updated] = await db
        .update(reminders)
        .set({ notificationMessage })
        .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error regenerating reminder message:", error);
      res.status(500).json({ error: "Failed to regenerate reminder message" });
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
      const { email, subject, message, appVersion } = req.body;
      
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
          appVersion: appVersion || null,
        })
        .returning();

      res.json({ success: true, requestId: request.id });
    } catch (error: any) {
      console.error("Error submitting support request:", error);
      res.status(500).json({ error: "Failed to submit support request" });
    }
  });

  // Feedback & feature requests endpoint
  app.post("/api/feedback", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, title, message, email, appVersion } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      const userId = req.userId || null;
      const subject = `[${type || "feedback"}] ${title}`;

      const [request] = await db
        .insert(supportRequests)
        .values({
          userId,
          email: email || "not provided",
          subject,
          message,
          appVersion: appVersion || null,
        })
        .returning();

      res.json({ success: true, requestId: request.id });
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
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
          
          const voiceId = affirmation.aiVoiceId || "hume_lotus";
          
          // Generate audio
          const audioResult = await generateAudio(affirmation.script, voiceId, false, getPillarVoiceConfig(affirmation.pillar));
          
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

  // Get user's subscription info
  app.get("/api/subscription", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [user] = await db
        .select({ subscriptionTier: users.subscriptionTier })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);

      const tier = (user?.subscriptionTier || "free") as "free" | "premium";
      res.json({
        tier,
        isPremium: isPremiumUser({ subscriptionTier: tier } as any),
        betaMode: BETA_MODE,
        freeFeatures: FREE_FEATURES,
        premiumFeatures: PREMIUM_FEATURES_LIST,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription info" });
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
      await db.delete(reminders).where(eq(reminders.userId, userId));
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
      return res.json({ ...cached, cached: true });
    }

    try {
      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
      const firstName = user?.name?.split(" ")[0] || "";

      const [sessionStats, affirmationCount, voiceCloneStatus, listeningCount] = await Promise.all([
        db.select({ total: sql<number>`count(*)::int` })
          .from(breathingSessions)
          .where(eq(breathingSessions.userId, userId))
          .then(r => r[0]),
        db.select({ total: sql<number>`count(*)::int` })
          .from(affirmations)
          .where(eq(affirmations.userId, userId))
          .then(r => r[0]),
        db.select({ voiceId: voiceSamples.voiceId, status: voiceSamples.status })
          .from(voiceSamples)
          .where(and(eq(voiceSamples.userId, userId), eq(voiceSamples.status, "ready")))
          .limit(1)
          .then(r => r[0]),
        db.select({ total: sql<number>`count(*)::int` })
          .from(listeningSessions)
          .where(eq(listeningSessions.userId, userId))
          .then(r => r[0]),
      ]);

      const totalBreathingSessions = sessionStats?.total || 0;
      const totalAffirmations = affirmationCount?.total || 0;
      const hasVoiceClone = !!voiceCloneStatus;
      const totalListens = listeningCount?.total || 0;

      const [streakResult] = await db
        .select({ dateKey: breathingSessions.dateKey })
        .from(breathingSessions)
        .where(eq(breathingSessions.userId, userId))
        .orderBy(desc(breathingSessions.completedAt))
        .limit(1);

      let streak = 0;
      if (streakResult) {
        let checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);
        const todayKey = checkDate.toISOString().slice(0, 10);
        const yesterdayDate = new Date(checkDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);

        if (streakResult.dateKey === todayKey || streakResult.dateKey === yesterdayKey) {
          const allDates = await db
            .select({ dateKey: breathingSessions.dateKey })
            .from(breathingSessions)
            .where(eq(breathingSessions.userId, userId))
            .orderBy(desc(breathingSessions.dateKey));

          const uniqueDates = [...new Set(allDates.map(d => d.dateKey))];
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

      const [topTechnique] = await db
        .select({
          techniqueId: breathingSessions.techniqueId,
          count: sql<number>`count(*)::int`,
        })
        .from(breathingSessions)
        .where(eq(breathingSessions.userId, userId))
        .groupBy(breathingSessions.techniqueId)
        .orderBy(sql`count(*) desc`)
        .limit(1);

      const nudgeOpportunities: string[] = [];
      if (totalAffirmations === 0) nudgeOpportunities.push("NO_AFFIRMATIONS: User has never created an affirmation yet.");
      else if (totalAffirmations < 3) nudgeOpportunities.push(`FEW_AFFIRMATIONS: User has only ${totalAffirmations} affirmation(s). Encourage creating more.`);
      if (!hasVoiceClone) nudgeOpportunities.push("NO_VOICE_CLONE: User hasn't set up voice cloning (Inner Voice) yet.");
      if (totalBreathingSessions === 0) nudgeOpportunities.push("NO_BREATHING: User hasn't tried any breathing exercises yet.");
      if (totalListens === 0 && totalAffirmations > 0) nudgeOpportunities.push("NO_LISTENS: User has affirmations but hasn't listened to any yet.");

      let statsContext = "";
      if (totalBreathingSessions > 0 || totalAffirmations > 0) {
        const parts = [];
        if (streak > 1) parts.push(`${streak}-day breathing streak`);
        if (totalBreathingSessions > 0) parts.push(`${totalBreathingSessions} breathing sessions`);
        if (totalAffirmations > 0) parts.push(`${totalAffirmations} affirmation(s) created`);
        if (totalListens > 0) parts.push(`${totalListens} listening sessions`);
        if (hasVoiceClone) parts.push("has cloned voice (Inner Voice)");
        if (topTechnique) parts.push(`favorite technique: ${topTechnique.techniqueId}`);
        statsContext = `\nUser activity: ${parts.join(", ")}.`;
      }

      let nudgeContext = "";
      if (nudgeOpportunities.length > 0) {
        nudgeContext = `\nNudge opportunities (pick ONE randomly if you want to nudge, or skip if you prefer pure encouragement):\n${nudgeOpportunities.join("\n")}`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              `You write ultra-short empowering sub-messages for the Retuned wellness app. The greeting line ("Good morning, Name") is already shown above your message — you only write the sub-message below it.`,
              ``,
              `TONE: ${normalizedTime} mood. Warm, not cheery. Like a knowing friend. Be creative, witty, surprising — users should look forward to what it says next. No quotation marks, no exclamation marks.`,
              ``,
              `THEMES to weave in (pick one per message): neural pathways strengthening, brain rewiring for confidence, neuroplasticity shaping beliefs, amygdala calming through breathwork, prefrontal cortex activation. Use accessible language — no jargon.`,
              `${statsContext}`,
              `${nudgeContext}`,
              ``,
              `RESPONSE FORMAT: Return valid JSON only. No markdown, no code fences.`,
              `{`,
              `  "message": "Your main message text here (max 12 words)",`,
              `  "actionText": "tappable link text (2-5 words, optional — omit key if no nudge)",`,
              `  "actionType": "create | breathe | meditate | clone (only if actionText is provided)"`,
              `}`,
              ``,
              `RULES:`,
              `- "message" is the full visible text INCLUDING a natural lead-in to the action. Max 12 words total.`,
              `- If nudging, end "message" with a dash or ellipsis, then put the call-to-action in "actionText". The actionText is rendered as a tappable link right after the message.`,
              `  Example: { "message": "Your mind is ready for something new —", "actionText": "create your first affirmation", "actionType": "create" }`,
              `  Example: { "message": "Imagine hearing these words in your voice —", "actionText": "try Inner Voice", "actionType": "clone" }`,
              `  Example: { "message": "A 60-second reset could change your day —", "actionText": "breathe now", "actionType": "breathe" }`,
              `  Example: { "message": "Let stillness find you —", "actionText": "start a guided moment", "actionType": "meditate" }`,
              `- If no nudge fits, just return { "message": "..." } with pure encouragement (max 10 words).`,
              `- actionType mapping: "create" = create new affirmation, "breathe" = breathing exercise, "meditate" = guided meditation, "clone" = voice cloning setup.`,
              `- About 60% of the time, include a nudge when opportunities exist. 40% pure encouragement.`,
              `- Never nag. Be curious, inviting, playful. Each message should feel fresh.`,
            ].join("\n"),
          },
          {
            role: "user",
            content: `Generate a ${normalizedTime} sub-message.`,
          },
        ],
        temperature: 0.85,
        max_tokens: 80,
      });

      const raw = response.choices[0]?.message?.content?.trim() || "";
      let parsed: { message: string; actionText?: string; actionType?: string };
      try {
        const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(cleaned);
        parsed.message = (parsed.message || "").replace(/["""''!]/g, "");
        if (parsed.actionText) {
          parsed.actionText = parsed.actionText.replace(/["""''!]/g, "");
        }
        const validActions = ["create", "breathe", "meditate", "clone"];
        if (parsed.actionType && !validActions.includes(parsed.actionType)) {
          delete parsed.actionText;
          delete parsed.actionType;
        }
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

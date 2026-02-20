import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { affirmations, voiceSamples, categories, users, collections, customCategories, notificationSettings, reminders, pushTokens, listeningSessions, breathingSessions, journeyCompletions } from "@shared/schema";
import { eq, desc, asc, and, sql, sum, isNull, isNotNull } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";
import OpenAI from "openai";
import { isPremiumUser, FREE_FEATURES, PREMIUM_FEATURES_LIST, BETA_MODE } from "./premium";
import { MOOD_TAG_PREFERENCES, TARGET_MOOD_TAGS, type MoodType, type TimeOfDay, type TargetMoodType } from "@shared/pillars";
import { VIBE_LIST, getVibeConfig, resolveVibeFromMoodPair, type VibeId } from "@shared/vibes";
import { routeVibe, pickBestAffirmation, getSuggestedCreationTheme as getVibeCreationTheme, getVibeJourneyPromptContext } from "./vibe-engine";
import {
  cloneVoice,
  textToSpeech as elevenLabsTTS,
  getElevenLabsClient,
  deleteVoice,
  type WordTiming,
} from "./replit_integrations/elevenlabs/client";
import { cartesiaCloneVoice, cartesiaTTS, cartesiaSimpleTTS, isCartesiaConfigured, getCartesiaEmotionConfig } from "./cartesia-tts";
import { humeTextToSpeech, humeSimpleTTS, type WordTiming as HumeWordTiming } from "./hume-client";
import { runVoiceRotation, checkVoiceSlotWarning, freeVoiceSlotForNewClone } from "./voice-rotation";
import { sendVoiceExpiryWarnings } from "./push-notifications";
import { setupAuth, requireAuth, optionalAuth, AuthenticatedRequest } from "./auth";
import { moderateContent, validateAffirmationContent } from "./moderation";
import { registerGithubRoutes } from "./routes/github-routes";
import { registerBreathingRoutes } from "./routes/breathing-routes";
import { registerReminderRoutes } from "./routes/reminder-routes";
import { registerAdminRoutes, ADMIN_USER_IDS } from "./routes/admin-routes";

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
  max: 20,
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
  anxious: {
    scriptTone: "grounding, steady, and anchoring — like roots growing deep into earth. Use concrete, physical language (feet on ground, weight of body, solid surfaces). Repeat grounding cues. Prioritize predictability and safety in word choice.",
    humeSpeed: 0.9,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2,
  },
  sad: {
    scriptTone: "warm, tender, and compassionate — like being gently held by someone who truly understands. Use soft, comforting language that acknowledges pain without rushing past it. Invite the listener to be gentle with themselves.",
    humeSpeed: 0.88,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  overwhelmed: {
    scriptTone: "steady, simplifying, and reassuring — like a calm hand on your shoulder when everything feels too much. Use short, clear sentences. Emphasize one thing at a time, letting go of what can wait, and coming back to this single breath.",
    humeSpeed: 0.88,
    pauseSeconds: 1.7,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.2,
  },
  energized: {
    scriptTone: "bright, uplifting, and invigorating — like the first breath of fresh mountain air. Use dynamic, forward-moving language that celebrates vitality and momentum.",
    humeSpeed: 1.0,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.4,
  },
  grateful: {
    scriptTone: "warm, reverent, and heart-centered — like sunlight pouring through a window onto your chest. Use rich, appreciative language that savors each moment and connection.",
    humeSpeed: 0.9,
    pauseSeconds: 1.6,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.35,
  },
  confident: {
    scriptTone: "strong, grounded, and empowering — like standing tall on solid ground with the wind at your back. Use affirming, bold language that reinforces inner strength and self-trust.",
    humeSpeed: 0.95,
    pauseSeconds: 1.4,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.4,
  },
  focused: {
    scriptTone: "clear, precise, and centering — like a laser beam of gentle attention cutting through noise. Use clean, purposeful language that sharpens awareness and quiets distraction.",
    humeSpeed: 0.92,
    pauseSeconds: 1.5,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  joyful: {
    scriptTone: "light, playful, and radiant — like bubbles of laughter rising through warm water. Use buoyant, celebratory language that invites smiling from the inside out.",
    humeSpeed: 0.95,
    pauseSeconds: 1.4,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45,
  },
};

const PILLAR_VOICE_CONFIG: Record<string, {
  scriptTone: string;
  humeSpeed: number;
  pauseSeconds: number;
  elevenLabsStability: number;
  elevenLabsStyle: number;
}> = {
  mind: {
    scriptTone: "Clear, steady, and measured. Quiet certainty. Deliver each statement like a calm, focused thought landing with precision.",
    humeSpeed: 0.92,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.55,
    elevenLabsStyle: 0.3,
  },
  body: {
    scriptTone: "Warm, grounded, and physical. Connected to sensation. Speak as if you can feel each word in your body — rooted and present.",
    humeSpeed: 0.95,
    pauseSeconds: 1.1,
    elevenLabsStability: 0.5,
    elevenLabsStyle: 0.4,
  },
  spirit: {
    scriptTone: "Soft, contemplative, and spacious. Gentle and unhurried. Let each phrase breathe, as if the silence between words matters as much as the words themselves.",
    humeSpeed: 0.85,
    pauseSeconds: 1.8,
    elevenLabsStability: 0.6,
    elevenLabsStyle: 0.25,
  },
  connection: {
    scriptTone: "Warm, open, and heartfelt. Inviting and sincere. Speak as if addressing someone you deeply care about — natural, genuine, emotionally present.",
    humeSpeed: 0.93,
    pauseSeconds: 1.3,
    elevenLabsStability: 0.45,
    elevenLabsStyle: 0.45,
  },
  achievement: {
    scriptTone: "Confident, grounded, and forward-moving. Strong without being aggressive. Deliver like a coach who believes in you — direct, clear, empowering.",
    humeSpeed: 1.0,
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
  return config;
}

const dailyGreetingCache = new Map<string, { message: string; actionText?: string; actionType?: string }>();
const lastNudgeTypeByUser = new Map<string, string>();

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

10. HUMAN VOICE: Write the way a real person talks to themselves — not like a motivational poster. Use contractions (I'm, it's, I've, that's). Vary sentence length — mix short punchy statements with longer flowing ones. Avoid stacking grandiose adjectives (never "immense, limitless, boundless power"). Include moments of gentle self-acknowledgment: "I've been working on this, and it's showing" or "something in me is shifting." Occasional dashes and commas create natural breathing pauses. The listener should feel like these are their own private thoughts, not a script being read to them.

11. AVOID AI-ISMS: Never sound like a corporate affirmation card or self-help book cover. Avoid clichés like "I am a beacon of light", "I radiate pure energy", "I command the room", "my potential is limitless." Instead, choose language that feels intimate and specific — "there's a quiet confidence building in me" rather than "I radiate unshakeable confidence." If a sentence could appear on a motivational Instagram post, rewrite it to sound more like a private journal entry.

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
  
  script = await humanizeScript(script, config.sentences);
  
  return script;
}

async function humanizeScript(script: string, sentenceCount: number): Promise<string> {
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

VOICE — This is the most important part:
- Use contractions ALWAYS: I'm, I've, it's, that's, there's, I'd, who's. Never "I am" when "I'm" works. Never "it is" when "it's" sounds more natural.
- Mix sentence lengths dramatically. Some sentences should be 5-8 words. Others can flow longer. Never let all sentences be the same length.
- Add dashes and commas for breathing rhythm: "I'm building something real — and I can feel it."
- Include self-acknowledgment: "I've been working at this, and it's showing." "Something in me is different now."
- Write like a private journal entry, not a speech. "There's a steadiness in me that wasn't there before" instead of "I am filled with unwavering steadiness."

KILL THESE AI PATTERNS:
- "I naturally bring [grandiose noun] to every [context]" → too formulaic
- "I am someone who carries/radiates/embodies [abstract quality]" → too stiff
- Stacking multiple abstract nouns: "clarity, purpose, and determination" → pick ONE and make it specific
- "It is in my nature to..." → sounds robotic, rephrase conversationally
- Any phrase that could appear on a motivational poster or Instagram caption → rewrite intimately`,
        },
        {
          role: "user",
          content: script,
        },
      ],
      temperature: 0.8,
      max_tokens: 600,
    });

    const humanized = response.choices[0]?.message?.content?.trim();
    if (!humanized) return script;

    let result = humanized
      .replace(/^\*\*.*?\*\*\s*/gm, "")
      .replace(/^#+\s*.*?\n/gm, "")
      .replace(/^\d+\.\s*/gm, "")
      .replace(/^["']/gm, "")
      .replace(/["']$/gm, "")
      .replace(/^\s*\n/gm, "")
      .trim();

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

function resolvePersonalVoiceId(
  ttsProvider: string | null | undefined,
  voiceId: string | null | undefined,
  elevenLabsVoiceId: string | null | undefined,
  cartesiaVoiceId: string | null | undefined
): string | undefined {
  if (elevenLabsVoiceId) return elevenLabsVoiceId;
  return voiceId || undefined;
}

async function generateAudioSimple(text: string, voiceId: string, isPersonalVoice: boolean = false, ttsProvider?: string): Promise<ArrayBuffer> {
  if (isPersonalVoice) {
    try {
      const client = await getElevenLabsClient();
      const audio = await client.textToSpeech.convert(voiceId, {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
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
  moodConfig?: typeof MEDITATION_MOOD_CONFIG[string],
  ttsProvider?: string,
  isMeditation: boolean = false
): Promise<{ audio: ArrayBuffer; duration: number; wordTimings: WordTiming[] }> {
  if (isPersonalVoice) {
    const personalVoiceSettings = isMeditation
      ? { stability: 0.70, style: 0.25, pauseSeconds: 2.5 }
      : { stability: 0.78, style: 0.15, pauseSeconds: 2.0 };
    try {
      const result = await elevenLabsTTS(script, voiceId, personalVoiceSettings);
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
          ttsProvider: users.ttsProvider,
          elevenLabsVoiceId: users.elevenLabsVoiceId,
          cartesiaVoiceId: users.cartesiaVoiceId,
        })
        .from(users)
        .where(eq(users.id, req.userId!));

      // Determine which voice ID to use based on preferences
      let voiceIdToUse: string | undefined;
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
          userWithPrefs?.ttsProvider || undefined
        );
      } catch (genError: any) {
        if (usedPersonalVoice && genError?.message?.includes("QUOTA_EXCEEDED")) {
          const fallbackGender = usedGender || "female";
          const fallbackVoiceId = fallbackGender === "male"
            ? (userWithPrefs?.preferredMaleVoiceId || VOICE_OPTIONS.male[0].id)
            : (userWithPrefs?.preferredFemaleVoiceId || VOICE_OPTIONS.female[0].id);
          usedPersonalVoice = false;
          voiceIdToUse = fallbackVoiceId;
          audioResult = await generateAudio(script, fallbackVoiceId, false, getPillarVoiceConfig(pillar));
        } else if (usedPersonalVoice && (genError?.message?.includes("PERSONAL_VOICE_FAILED") || genError?.message?.includes("VOICE_EXPIRED"))) {
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
          .select({ voiceClonesUsed: users.voiceClonesUsed, hasConsentedToVoiceCloning: users.hasConsentedToVoiceCloning, ttsProvider: users.ttsProvider })
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

        try {
          let voiceId: string;
          const providerVoiceUpdate: Record<string, any> = { 
            hasVoiceSample: true, 
            preferredVoiceType: "personal",
            voiceClonesUsed: (clonesUsed + 1)
          };

          voiceId = await cloneVoice(file.path, "My Affirmation Voice");
          providerVoiceUpdate.elevenLabsVoiceId = voiceId;
          providerVoiceUpdate.voiceId = voiceId;

          // PRIVACY: Delete the voice sample file immediately after cloning
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

          // Update user with all voice IDs
          await db
            .update(users)
            .set(providerVoiceUpdate)
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

          const errorDetail = cloneError?.elevenLabsDetail || cloneError?.message || "";
          const statusCode = cloneError?.statusCode || 500;
          let userMessage = "Voice cloning failed. Please try again.";

          if (errorDetail.toLowerCase().includes("maximum") || errorDetail.toLowerCase().includes("custom voices") || errorDetail.toLowerCase().includes("voice limit")) {
            console.warn("[Voice Slots] ElevenLabs quota hit. Attempting queue-based slot recovery...");
            
            try {
              const slotResult = await freeVoiceSlotForNewClone(req.userId!);
              if (slotResult.freed) {
                console.log(`[Voice Slots] Freed slot (rotated user=${slotResult.rotatedUserId}). Retrying clone...`);
                
                const retryVoiceId = await cloneVoice(file.path, "My Affirmation Voice");
                fs.unlink(file.path, () => {});
                
                const [retryUpdatedSample] = await db
                  .update(voiceSamples)
                  .set({ voiceId: retryVoiceId, status: "ready", audioUrl: null })
                  .where(eq(voiceSamples.id, sample.id))
                  .returning();
                
                await db
                  .update(users)
                  .set({ 
                    voiceId: retryVoiceId, 
                    hasVoiceSample: true, 
                    preferredVoiceType: "personal",
                    voiceClonesUsed: (clonesUsed + 1)
                  })
                  .where(eq(users.id, req.userId!));
                
                return res.json({
                  ...retryUpdatedSample,
                  clonesRemaining: MAX_VOICE_CLONES - (clonesUsed + 1)
                });
              }
            } catch (retryError: any) {
              console.error("[Voice Slots] Retry after slot recovery failed:", retryError?.message);
            }
            
            userMessage = "Voice cloning is temporarily unavailable. Please try again in a few minutes.";
          } else if (statusCode === 401 || statusCode === 403) {
            userMessage = "Voice cloning service is temporarily unavailable. Please try again later.";
          } else if (statusCode === 429) {
            userMessage = "Voice cloning service is busy. Please wait a few minutes and try again.";
          } else if (errorDetail.toLowerCase().includes("too short") || errorDetail.toLowerCase().includes("duration")) {
            const minDuration = '20';
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

      const audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, voiceId);

      const base64Audio = Buffer.from(audioBuffer).toString("base64");
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
          ttsProvider: users.ttsProvider,
          elevenLabsVoiceId: users.elevenLabsVoiceId,
          cartesiaVoiceId: users.cartesiaVoiceId,
        })
        .from(users)
        .where(eq(users.id, req.userId!));

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const resolvedVoiceId = resolvePersonalVoiceId(user.ttsProvider, user.voiceId, user.elevenLabsVoiceId, user.cartesiaVoiceId);
      if (!resolvedVoiceId || !user.hasVoiceSample) {
        return res.status(400).json({ error: "No Inner Voice recorded. Please record your voice first." });
      }

      let audioBuffer: ArrayBuffer;
      try {
        audioBuffer = await generateAudioSimple(PREVIEW_PHRASE, resolvedVoiceId, true);
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

  app.post("/api/tts/compare", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    return res.status(410).json({ error: "TTS comparison is temporarily disabled" });
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
          ttsProvider: users.ttsProvider,
          elevenLabsVoiceId: users.elevenLabsVoiceId,
          cartesiaVoiceId: users.cartesiaVoiceId,
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
        hasPersonalVoice: !!user.hasVoiceSample && !!(user.elevenLabsVoiceId || user.cartesiaVoiceId || user.voiceId),
        ttsProvider: "elevenlabs",
        hasElevenLabsVoice: !!user.elevenLabsVoiceId,
        hasCartesiaVoice: false,
      });
    } catch (error) {
      console.error("Error fetching voice preferences:", error);
      res.status(500).json({ error: "Failed to fetch voice preferences" });
    }
  });

  // Update user's voice preferences
  app.put("/api/voice-preferences", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { preferredVoiceType, preferredAiGender, preferredMaleVoiceId, preferredFemaleVoiceId, ttsProvider } = req.body;

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

      const [userTtsInfo] = await db.select({ ttsProvider: users.ttsProvider }).from(users).where(eq(users.id, req.userId!));

      // Determine which voice ID to use
      let voiceIdToUse: string | undefined;
      
      if (voiceType === "personal") {
        // Get user's cloned voice
        const [user] = await db
          .select({ voiceId: users.voiceId, hasVoiceSample: users.hasVoiceSample, elevenLabsVoiceId: users.elevenLabsVoiceId, cartesiaVoiceId: users.cartesiaVoiceId, ttsProvider: users.ttsProvider })
          .from(users)
          .where(eq(users.id, req.userId!));

        const resolvedVoiceId = resolvePersonalVoiceId(user?.ttsProvider, user?.voiceId, user?.elevenLabsVoiceId, user?.cartesiaVoiceId);
        if (!resolvedVoiceId || !user?.hasVoiceSample) {
          return res.status(400).json({ 
            error: "VOICE_ROTATED",
            message: "Your personal voice has expired. Please re-record your voice sample to continue using your Inner Voice, or switch to an AI voice.",
          });
        }
        voiceIdToUse = resolvedVoiceId;
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

  app.post("/api/push-token", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token, platform } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Push token is required" });
      }

      const existing = await db
        .select()
        .from(pushTokens)
        .where(eq(pushTokens.token, token))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(pushTokens)
          .set({ userId: req.userId!, platform: platform || "unknown", updatedAt: new Date() })
          .where(eq(pushTokens.token, token));
      } else {
        await db
          .insert(pushTokens)
          .values({ userId: req.userId!, token, platform: platform || "unknown" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error registering push token:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  app.post("/api/voice/keep-active", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [user] = await db
        .select({ voiceId: users.voiceId, hasVoiceSample: users.hasVoiceSample })
        .from(users)
        .where(eq(users.id, req.userId!));

      if (!user?.voiceId || !user?.hasVoiceSample) {
        return res.status(400).json({ error: "No active voice clone found" });
      }

      await db
        .update(users)
        .set({ voiceLastUsedAt: new Date(), voiceExpiryWarningAt: null })
        .where(eq(users.id, req.userId!));

      res.json({ success: true, message: "Voice clone marked as active" });
    } catch (error: any) {
      console.error("Error keeping voice active:", error);
      res.status(500).json({ error: "Failed to update voice status" });
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
  "title": "A short, warm 3-6 word title that acknowledges their ${currentMood} feeling and hints at transformation. Use ${userName}'s name sometimes but not always. Examples for stressed: 'Let's lighten that load, ${userName}', 'You deserve some ease'. Examples for tired: 'Rest is calling you', 'Time to recharge, ${userName}'. Examples for anxious: 'Let's find your ground'. Examples for sad: 'Sunshine is on its way'. Examples for overwhelmed: 'One breath at a time'. Examples for calm: 'Beautiful — let's build on this'. Never use emojis.",
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

      const validStartingMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed", "wired", "frustrated", "scattered", "good"];
      const validTargetMoods = ["calm", "energized", "grateful", "confident", "focused", "joyful", "locked_in", "grounded", "lit_up"];
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
        db.select({ name: users.name, voiceId: users.voiceId, preferredVoiceType: users.preferredVoiceType }).from(users).where(eq(users.id, userId)).limit(1),
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
      const userPreferredVoiceType = user?.preferredVoiceType || "ai";

      const resolvedVibeId = resolveVibeFromMoodPair(mood, targetMood);
      const resolvedVibe = getVibeConfig(resolvedVibeId);
      const vibeRouting = routeVibe(resolvedVibeId);

      let matchedAffirmation: { id: number; title: string; description: string | null; voiceType: string | null } | null = null;
      let matchReason: "tag" | "pillar" | "any" | null = null;

      if (vibeRouting) {
        const result = pickBestAffirmation(userAffirmationsList, vibeRouting.matching, userPreferredVoiceType);
        if (result) {
          matchedAffirmation = result.affirmation;
          matchReason = result.matchReason;
        }
      } else {
        const withAudio = userAffirmationsList.filter(a => a.audioUrl);
        if (withAudio.length > 0) {
          matchedAffirmation = withAudio[Math.floor(Math.random() * withAudio.length)];
          matchReason = "any";
        }
      }

      const suggestedCreationTheme = !matchedAffirmation
        ? getVibeCreationTheme(resolvedVibeId, timeOfDay)
        : null;

      const breathing = vibeRouting
        ? { name: vibeRouting.breathingTechniqueName, id: vibeRouting.breathingTechniqueId }
        : { name: "Box Breathing", id: "box" };

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

      let journeyHistoryContext = "";
      try {
        const [journeyTotal, lastJourney, frequentPath] = await Promise.all([
          db.select({ total: sql<number>`count(*)::int` })
            .from(journeyCompletions)
            .where(eq(journeyCompletions.userId, userId))
            .then(r => r[0]),
          db.select()
            .from(journeyCompletions)
            .where(eq(journeyCompletions.userId, userId))
            .orderBy(desc(journeyCompletions.completedAt))
            .limit(1)
            .then(r => r[0]),
          db.select({
            currentMood: journeyCompletions.currentMood,
            targetMood: journeyCompletions.targetMood,
            count: sql<number>`count(*)::int`,
          })
            .from(journeyCompletions)
            .where(eq(journeyCompletions.userId, userId))
            .groupBy(journeyCompletions.currentMood, journeyCompletions.targetMood)
            .orderBy(sql`count(*) desc`)
            .limit(1)
            .then(r => r[0]),
        ]);

        const totalJourneys = journeyTotal?.total || 0;
        if (totalJourneys > 0) {
          const parts: string[] = [`${totalJourneys} mood journey(s) completed`];
          if (lastJourney) {
            parts.push(`last journey was ${lastJourney.currentMood}→${lastJourney.targetMood}`);
            if (lastJourney.completedFully) parts.push("(completed fully)");
          }
          if (frequentPath) {
            parts.push(`most common path: ${frequentPath.currentMood}→${frequentPath.targetMood} (${frequentPath.count} times)`);
          }
          journeyHistoryContext = `\nJourney history: ${parts.join(", ")}.`;
          if (lastJourney?.currentMood === mood && lastJourney?.targetMood === targetMood) {
            journeyHistoryContext += " Note: this is the SAME mood path as their last journey — acknowledge the pattern subtly.";
          }
        }
      } catch (e) {}

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
              content: `You are the voice of Retuned, a personal wellness app backed by neuroscience and mindfulness traditions. The user wants to journey from feeling ${mood} to feeling ${targetMood}. Design a personalized wellness journey with 2-3 steps (minimum 2, maximum 3) from these tools: breathe, meditate, listen.

Choose steps wisely — not every journey needs all three. Consider:
- If user is already calm or good, they probably don't need breathing
- If they want energy or to feel lit up, meditation alone won't cut it
- If they're anxious, wired, or scattered, breathing should almost always be first
- If they're frustrated, breathing helps channel that energy constructively
- If they're already in a good state (good, calm), focus on amplifying rather than fixing
- Order matters: breathing first to settle the body, meditation to shift the mind, listening to reinforce

KNOWLEDGE BASE — draw from these naturally (pick 1-2 per response, never lecture):
Neuroscience: vagus nerve stimulation, amygdala downregulation, prefrontal cortex activation, parasympathetic nervous system, neuroplasticity, default mode network quieting, theta/alpha brainwave states, cortisol reduction, HRV (heart rate variability), mirror neuron activation, dopamine and serotonin pathways, polyvagal theory (ventral vagal = safe/social state)
Spirituality & mindfulness: present-moment awareness, non-attachment to emotional states, the observer self, pranayama traditions, loving-kindness practice roots, body scan origins in Vipassana, the concept of "witness consciousness," energy shifting through intention, the Buddhist concept that feelings are visitors not residents, somatic awareness, the yogic idea that breath is the bridge between body and mind

User context:
- Name: ${userName}
- Current mood: ${mood}
- Target mood: ${targetMood}
- Time: ${timeOfDay}
- Vibe: "${resolvedVibe?.label || "Reset"}" — ${vibeRouting ? getVibeJourneyPromptContext(resolvedVibeId) : ""}
- ${listenContext}
- ${voiceContext}
- Total affirmations: ${userAffirmationsList.length}
- Best breathing match for this transition: ${breathing.name}
- ${journeyHistoryContext || "First mood journey"}

Respond as JSON with exactly these fields:
{
  "journeyTitle": "A creative 2-5 word title for this journey. Should capture the mood transition. No emojis. Can reference a neuroscience or mindfulness concept when it fits naturally (e.g., 'Vagal Reset', 'Rewiring the Signal', 'Back to Center', 'Finding Ventral'). Keep it punchy.",
  "acknowledgment": "1-2 sentences, max 30 words total. Use ${userName}'s name. Validate their ${mood} state with a real insight, then pivot to ${targetMood} with confidence. Never use emojis. Never use metaphors.

VARIETY IS CRITICAL. Randomly choose ONE of these angles — and within that angle, pick a DIFFERENT mechanism each time:
A) Neuroscience angle — pick ONE mechanism you haven't used recently: amygdala hijack, cortisol flooding, prefrontal cortex going offline, sympathetic overdrive, depleted serotonin, overactive default mode network, disrupted HRV, dopamine seeking loops, adrenaline surplus, or polyvagal dorsal shutdown. DO NOT default to 'fight-or-flight' or 'vagus nerve' — those are overused.
B) Mindfulness angle — pick from: feelings as visitors, observer self, non-attachment, witness consciousness, present-moment anchoring, the space between stimulus and response, beginner's mind, radical acceptance, pranayama traditions, or the Buddhist concept of impermanence. Vary which tradition or concept you reference.
C) Body-first angle — name where ${mood} shows up physically: jaw tension, shallow breathing, chest tightness, shoulder knots, stomach churning, heavy limbs, restless hands, constricted throat, tight forehead, or numb extremities. Be specific to ${mood}, not generic.
D) Direct/confident angle — no science, just a grounded observation about what ${userName} needs right now. Vary your sentence structure — sometimes start with their name, sometimes end with it.

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
  "breatheNote": "One punchy sentence (max 20 words) or null if breathe is not in stepTypes. Mention this is a 2-minute exercise. Pick a DIFFERENT mechanism each time from: vagus nerve stimulation, CO2 tolerance building, HRV improvement, parasympathetic activation, baroreceptor reset, diaphragm engagement, or a pranayama principle. State it as fact, not textbook. Do NOT reuse previous phrasing — generate fresh wording.",
  "meditateNote": "One punchy sentence (max 20 words) or null if meditate is not in stepTypes. Mention this is a 2-minute guided meditation. Pick a DIFFERENT mechanism each time from: default mode network quieting, theta state access, amygdala cooling, witness consciousness, present-moment anchoring, prefrontal re-engagement, or interoceptive awareness. Connect it to ${timeOfDay}. Do NOT reuse previous phrasing — generate fresh wording.",
  "listenNote": "One or two sentences (max 30 words) or null if listen is not in stepTypes. ${matchedAffirmation ? `Reference '${matchedAffirmation.title}' specifically.${matchedAffirmation.description ? ` Use the affirmation's description — "${matchedAffirmation.description}" — to explain WHY this particular affirmation is the perfect fit for the ${mood}→${targetMood} transition right now. Reference neuroplasticity or subconscious reprogramming.` : ` Explain why hearing it NOW after breathing/meditation lands differently — reference neuroplasticity, subconscious receptivity, or how the brain is more open to new patterns after a nervous system reset.`}` : hasAffirmations ? `Connect one of their existing affirmations to the ${mood}→${targetMood} shift. Reference how repetition rewires neural pathways or how the subconscious is most receptive after breathwork/meditation.` : `Inspire them to create their first affirmation about ${suggestedCreationTheme}${!hasClonedVoice ? " — mention how hearing your own voice activates mirror neurons differently than any other voice" : ""}. Reference neuroplasticity or subconscious programming.`}"
}

Rules for stepTypes:
- Must be an array of 2-3 strings from: "breathe", "meditate", "listen"
- Order them in the sequence the user should do them
- Be smart about which steps to include for this specific ${mood}→${targetMood} transition

Rules for tone:
- Sound like a confident coach who knows the science cold — not a textbook, not a greeting card
- No metaphors, no flowery imagery, no poetic language
- State neuroscience and spiritual concepts as direct facts — never hedge with "studies show" or "research suggests"
- No "you should" — use "let's" or direct suggestions
- No exclamation marks
- Each note must teach them something specific or create genuine curiosity
- NEVER repeat the same phrasing across responses — vary structure, angle, and vocabulary dramatically
- Treat the user as intelligent — they can handle real concepts like "vagus nerve" or "amygdala" without dumbing down
- Keep language accessible — explain the science in everyday words, not academic jargon`,
            },
            {
              role: "user",
              content: `I'm feeling ${mood} and I want to feel ${targetMood}. It's ${timeOfDay}.`,
            },
          ],
          temperature: 0.95,
          max_tokens: 450,
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
            meditationStyle: vibeRouting?.meditationStyle,
            meditationFocus: vibeRouting?.meditationFocus,
            meditationTTS: vibeRouting?.meditationTTS,
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
        steps,
      });
    } catch (error) {
      console.error("Error in mood check-in:", error);
      res.status(500).json({ error: "Failed to process mood check-in" });
    }
  });

  // ============ Vibe Check-In API ============

  app.post("/api/vibe-checkin", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

      const userId = req.userId!;
      const { vibe, startingMood: mood, targetMood, matching } = routing;

      const [userData, userAffirmationsList, latestVoiceSample] = await Promise.all([
        db.select({ name: users.name, voiceId: users.voiceId, preferredVoiceType: users.preferredVoiceType }).from(users).where(eq(users.id, userId)).limit(1),
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
      const userPreferredVoiceType = user?.preferredVoiceType || "ai";

      const matchResult = pickBestAffirmation(userAffirmationsList, matching, userPreferredVoiceType);
      const matchedAffirmation = matchResult?.affirmation || null;
      const matchReason = matchResult?.matchReason || null;

      const suggestedCreationTheme = !matchedAffirmation ? getVibeCreationTheme(vibeId as VibeId, timeOfDay) : null;

      const breathing = { name: routing.breathingTechniqueName, id: routing.breathingTechniqueId };

      let listenContext = "";
      if (matchedAffirmation) {
        const isInnerVoice = matchedAffirmation.voiceType === "personal";
        const matchQuality = matchReason === "tag" ? "closely matches their vibe" : matchReason === "pillar" ? "aligns with their current emotional needs" : "is available to listen to";
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

      let journeyHistoryContext = "";
      try {
        const [journeyTotal, lastJourney] = await Promise.all([
          db.select({ total: sql<number>`count(*)::int` })
            .from(journeyCompletions)
            .where(eq(journeyCompletions.userId, userId))
            .then(r => r[0]),
          db.select()
            .from(journeyCompletions)
            .where(eq(journeyCompletions.userId, userId))
            .orderBy(desc(journeyCompletions.completedAt))
            .limit(1)
            .then(r => r[0]),
        ]);

        if (journeyTotal && journeyTotal.total > 0) {
          journeyHistoryContext = `This user has completed ${journeyTotal.total} vibe sessions. ${lastJourney ? `Last session: "${lastJourney.currentMood}→${lastJourney.targetMood}"${lastJourney.vibeId ? ` (${lastJourney.vibeId} vibe)` : ""}.` : ""}`;
        }
      } catch (e) {}

      const vibeContext = getVibeJourneyPromptContext(vibeId as VibeId);

      let journeyTitle = `${vibe.label} Session`;
      let acknowledgment = `Let's ${vibe.subtitle.toLowerCase()}.`;
      let stepTypes: string[] = ["breathe", "meditate", "listen"];
      let breatheNote: string | null = null;
      let meditateNote: string | null = null;
      let listenNote: string | null = null;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a wellness guide for the Retuned app. The user picked a "vibe" — a casual word for how they're feeling. Your job is to acknowledge their state and design a personalized micro-journey.

${vibeContext}

Vibe: "${vibe.label}" — ${vibe.description}
From: ${mood} → To: ${targetMood}

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
A) Neuroscience — pick ONE mechanism: amygdala hijack, cortisol flooding, prefrontal cortex offline, sympathetic overdrive, depleted serotonin, overactive default mode network, disrupted HRV, dopamine loops, polyvagal dorsal shutdown
B) Mindfulness — pick from: feelings as visitors, observer self, non-attachment, witness consciousness, present-moment anchoring, beginner's mind, radical acceptance, impermanence
C) Body-first — name where this vibe shows up physically: jaw tension, shallow breathing, chest tightness, shoulder knots, restless hands, tight forehead
D) Direct/confident — no science, just a grounded observation

BANNED PHRASES: 'stuck in fight-or-flight', 'activate your vagus nerve', 'bring you back to baseline', 'studies show', 'research suggests', 'proven to', 'can help'",
  "stepTypes": ["breathe", "meditate", "listen"],
  "breatheNote": "One punchy sentence (max 20 words) or null. Mention 2-minute exercise. Pick a different mechanism each time. State as fact.",
  "meditateNote": "One punchy sentence (max 20 words) or null. Mention 2-minute guided meditation. Connect to ${timeOfDay}. Fresh wording.",
  "listenNote": "One or two sentences (max 30 words) or null. ${matchedAffirmation ? `Reference '${matchedAffirmation.title}' specifically.${matchedAffirmation.description ? ` Use "${matchedAffirmation.description}" to explain why this affirmation fits the ${vibe.label} vibe.` : ` Explain why hearing it after breathing/meditation lands differently.`}` : hasAffirmations ? `Connect one of their affirmations to the ${vibe.label} vibe.` : `Inspire creating a first affirmation about ${suggestedCreationTheme}${!hasClonedVoice ? " — mention Inner Voice" : ""}.`}"
}

Rules for stepTypes:
- Array of 2-3 strings from: "breathe", "meditate", "listen"
- Order them in the best sequence for this vibe
- Be smart about which steps to include

Rules for tone:
- Sound like a confident coach who knows the science — not a textbook, not a greeting card
- No metaphors, no flowery imagery
- State concepts as direct facts — never hedge
- No "you should" — use "let's" or direct suggestions
- No exclamation marks
- NEVER repeat the same phrasing across responses`,
            },
            {
              role: "user",
              content: `I'm vibing "${vibe.label}" right now. It's ${timeOfDay}.`,
            },
          ],
          temperature: 0.95,
          max_tokens: 450,
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
            vibeId,
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
        vibeId,
        vibeLabel: vibe.label,
        vibeAccentColor: routing.accentColor,
        vibeIcon: routing.icon,
        currentMood: mood,
        targetMood,
        steps,
      });
    } catch (error) {
      console.error("Error in vibe check-in:", error);
      res.status(500).json({ error: "Failed to process vibe check-in" });
    }
  });

  // ============ Journey Completions API ============

  app.post("/api/journey-completions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentMood, targetMood, vibeId, stepsPlanned, stepsCompleted, stepsSkipped, stepTypes, completedFully, timeOfDay, durationSeconds } = req.body;
      const userId = req.userId!;
      
      if (!currentMood || !targetMood || !stepTypes) {
        return res.status(400).json({ error: "currentMood, targetMood, and stepTypes are required" });
      }
      
      const dateKey = new Date().toISOString().slice(0, 10);
      
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
        dateKey,
      }).returning();
      
      res.json(completion);
    } catch (error) {
      console.error("Error recording journey completion:", error);
      res.status(500).json({ error: "Failed to record journey completion" });
    }
  });

  app.get("/api/journey-stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      
      const [totalCount, completedCount, recentJourneys, moodFrequency, topTargetMood] = await Promise.all([
        db.select({ total: sql<number>`count(*)::int` })
          .from(journeyCompletions)
          .where(eq(journeyCompletions.userId, userId))
          .then(r => r[0]),
        db.select({ total: sql<number>`count(*)::int` })
          .from(journeyCompletions)
          .where(and(eq(journeyCompletions.userId, userId), eq(journeyCompletions.completedFully, true)))
          .then(r => r[0]),
        db.select()
          .from(journeyCompletions)
          .where(eq(journeyCompletions.userId, userId))
          .orderBy(desc(journeyCompletions.completedAt))
          .limit(5),
        db.select({
          currentMood: journeyCompletions.currentMood,
          targetMood: journeyCompletions.targetMood,
          count: sql<number>`count(*)::int`,
        })
          .from(journeyCompletions)
          .where(eq(journeyCompletions.userId, userId))
          .groupBy(journeyCompletions.currentMood, journeyCompletions.targetMood)
          .orderBy(sql`count(*) desc`)
          .limit(3),
        db.select({
          targetMood: journeyCompletions.targetMood,
          count: sql<number>`count(*)::int`,
        })
          .from(journeyCompletions)
          .where(and(eq(journeyCompletions.userId, userId), eq(journeyCompletions.completedFully, true)))
          .groupBy(journeyCompletions.targetMood)
          .orderBy(sql`count(*) desc`)
          .limit(1),
      ]);
      
      let journeyStreak = 0;
      if (recentJourneys.length > 0) {
        let checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);
        const todayKey = checkDate.toISOString().slice(0, 10);
        const yesterdayDate = new Date(checkDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);
        
        const allDates = await db
          .select({ dateKey: journeyCompletions.dateKey })
          .from(journeyCompletions)
          .where(eq(journeyCompletions.userId, userId))
          .orderBy(desc(journeyCompletions.dateKey));
        
        const uniqueDates = [...new Set(allDates.map(d => d.dateKey))];
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
        lastJourney: recentJourneys[0] || null,
      });
    } catch (error) {
      console.error("Error fetching journey stats:", error);
      res.status(500).json({ error: "Failed to fetch journey stats" });
    }
  });

  // ============ Micro-Meditations API ============

  app.post("/api/guided-moments/script", requireAuth, guidedMomentLimiter, async (req: AuthenticatedRequest, res: Response) => {
    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    try {
      const { mood, timeOfDay, duration: rawDuration, vibeId: reqVibeId } = req.body;

      if (!mood || !timeOfDay) {
        return res.status(400).json({ error: "mood and timeOfDay are required" });
      }

      const validMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed", "energized", "grateful", "confident", "focused", "joyful", "wired", "frustrated", "scattered", "good", "locked_in", "grounded", "lit_up"];
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
      const maxTokensMap: Record<number, number> = { 1: 250, 2: 450, 3: 600 };
      const wordCount = wordCountMap[duration] || wordCountMap[1];
      const maxTokens = maxTokensMap[duration] || 350;

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
            elevenLabsStyle: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStyle,
          };
          vibeContextLine = `\nThe user's vibe is "${vibeRouting.vibe.label}" — ${vibeRouting.vibe.description}. Meditation style: ${vibeRouting.vibe.meditation.style}. Focus: ${vibeRouting.vibe.meditation.focusArea}.`;
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
              `1. OPENING (1-2 sentences): Begin with a brief, natural acknowledgment of where they are in their week and day — weave the day and time of day into a warm, conversational greeting before the grounding cue. Examples: "It's ${dayOfWeek} ${timeOfDay} — let this be your moment of calm..." or "The middle of the week can feel long... right here, right now, you're choosing stillness." Keep it effortless, never forced. Then invite them to close their eyes, notice their breath, or feel their body.`,
              `2. BREATHING GUIDANCE (2-3 sentences): Lead a brief breathing cycle tailored to their mood. For stressed/anxious/overwhelmed: slow exhales for vagus nerve activation. For tired: energizing breath with counts. For sad: gentle, warming breaths. For calm: simple awareness breath.`,
              `3. VISUALIZATION (3-4 sentences): Paint a vivid, sensory-rich scene using present tense. Include at least 2 senses (sight + touch, or sound + warmth, etc.). Match the imagery to their mood — calming scenes for stress/overwhelm, gentle uplifting scenes for sadness, expansive scenes for energy, warm scenes for gratitude.`,
              `4. AFFIRMATION ANCHORING (2-3 sentences): Weave in identity-level affirmations using "I am" or "I choose" language. Use embedded commands naturally. Connect the affirmation to the visualization scene.`,
              `5. GENTLE RETURN (2-3 sentences): Slowly guide them back to their surroundings. Include a physical cue like "wiggle your fingers" or "notice the sounds around you." Then invite them to open their eyes when ready — never rush this transition. Add a pause ("...") before the final line.`,
              `6. WARM SEND-OFF (1-2 complete sentences): This is the most important part to get right. Always end with a complete, warm farewell that matches the time of day. Use phrases like: morning→"Have a wonderful morning" or "Carry this light into your day," afternoon→"Have a beautiful afternoon" or "Let this fuel the rest of your day," evening→"Have a peaceful evening" or "Take this warmth into your night," night→"Have a restful night" or "Sleep well tonight." The send-off MUST be a fully finished sentence — never trail off or leave a thought incomplete. This is the last thing the listener hears, so it must land with warmth and finality.`,
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
              `- CRITICAL: The very last sentence must always be a complete send-off wish (e.g., "Have a peaceful evening" or "Enjoy the rest of your day"). Never end mid-thought or with an ellipsis.`,
              `- Reference accessible neuroscience concepts naturally (e.g., "your nervous system settles," "each breath sends a signal of safety")`,
              `- Mood-specific emphasis: stressed→release/safety, anxious→grounding/presence, tired→vitality/awakening, sad→warmth/comfort, overwhelmed→simplicity/clarity, calm→deepening/peace, energized→momentum/vitality, grateful→appreciation/connection, confident→strength/self-trust, focused→clarity/precision, joyful→celebration/lightness`,
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
      const { script, usePersonalVoice, voiceId: rawVoiceId, mood, vibeId: audioVibeId } = req.body;
      let moodConfig = mood ? (MEDITATION_MOOD_CONFIG[mood] || MEDITATION_MOOD_CONFIG.calm) : MEDITATION_MOOD_CONFIG.calm;
      if (audioVibeId && VIBE_LIST.includes(audioVibeId)) {
        const vibeRouting = routeVibe(audioVibeId);
        if (vibeRouting) {
          moodConfig = {
            scriptTone: vibeRouting.vibe.meditation.ttsConfig.scriptTone,
            humeSpeed: vibeRouting.vibe.meditation.ttsConfig.humeSpeed,
            pauseSeconds: vibeRouting.vibe.meditation.ttsConfig.pauseSeconds,
            elevenLabsStability: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStability,
            elevenLabsStyle: vibeRouting.vibe.meditation.ttsConfig.elevenLabsStyle,
          };
        }
      }

      if (!script || typeof script !== "string" || script.trim().length === 0) {
        return res.status(400).json({ error: "script is required and must be a non-empty string" });
      }

      const userId = req.userId!;
      const [userTtsSettings] = await db.select({ 
        ttsProvider: users.ttsProvider,
        voiceId: users.voiceId,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId,
      }).from(users).where(eq(users.id, userId));

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
        console.log(`Client disconnected before TTS, aborting`);
        return;
      }

      let audioBuffer: ArrayBuffer;
      let wordTimings: WordTiming[] = [];
      let audioDuration = 0;

      try {
        if (usePersonalVoice && voiceId) {
          const result = await generateAudio(script, voiceId, true, moodConfig, undefined, true);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        } else {
          const stockVoiceId = voiceId && isHumeVoice(voiceId) ? voiceId : "hume_lotus";
          const result = await generateAudio(script, stockVoiceId, false, moodConfig, undefined, true);
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

      const validMoods = ["calm", "stressed", "tired", "anxious", "sad", "overwhelmed", "energized", "grateful", "confident", "focused", "joyful", "wired", "frustrated", "scattered", "good", "locked_in", "grounded", "lit_up"];
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
      const maxTokensMap: Record<number, number> = { 1: 250, 2: 450, 3: 600 };
      const wordCount = wordCountMap[duration] || wordCountMap[1];
      const maxTokens = maxTokensMap[duration] || 350;

      const durationLabel = duration === 1 ? "60-90 seconds" : `${duration} minutes`;

      const userId = req.userId!;
      const [userTtsSettings2] = await db.select({ 
        ttsProvider: users.ttsProvider,
        voiceId: users.voiceId,
        elevenLabsVoiceId: users.elevenLabsVoiceId,
        cartesiaVoiceId: users.cartesiaVoiceId,
      }).from(users).where(eq(users.id, userId));

      const [userResult] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);

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
      const dayOfWeek = (clientDayOfWeekLegacy && validDaysLegacy.includes(clientDayOfWeekLegacy)) ? clientDayOfWeekLegacy : validDaysLegacy[new Date().getDay()];

      if (clientDisconnected) {
        console.log(`Client disconnected before script generation (${duration}min), aborting`);
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
              `1. OPENING (1-2 sentences): Begin with a brief, natural acknowledgment of where they are in their week and day — weave the day and time of day into a warm, conversational greeting before the grounding cue. Keep it effortless, never forced. Then invite them to close their eyes, notice their breath, or feel their body.`,
              `2. BREATHING GUIDANCE (2-3 sentences): Lead a brief breathing cycle tailored to their mood. For stressed/anxious/overwhelmed: slow exhales for vagus nerve activation. For tired: energizing breath with counts. For sad: gentle, warming breaths. For calm: simple awareness breath.`,
              `3. VISUALIZATION (3-4 sentences): Paint a vivid, sensory-rich scene using present tense. Include at least 2 senses (sight + touch, or sound + warmth, etc.). Match the imagery to their mood — calming scenes for stress/overwhelm, gentle uplifting scenes for sadness, expansive scenes for energy, warm scenes for gratitude.`,
              `4. AFFIRMATION ANCHORING (2-3 sentences): Weave in identity-level affirmations using "I am" or "I choose" language. Use embedded commands naturally. Connect the affirmation to the visualization scene.`,
              `5. GENTLE RETURN (2-3 sentences): Slowly guide them back to their surroundings. Include a physical cue like "wiggle your fingers" or "notice the sounds around you." Then invite them to open their eyes when ready — never rush this transition. Add a pause ("...") before the final line.`,
              `6. WARM SEND-OFF (1-2 complete sentences): This is the most important part to get right. Always end with a complete, warm farewell that matches the time of day. Use phrases like: morning→"Have a wonderful morning" or "Carry this light into your day," afternoon→"Have a beautiful afternoon" or "Let this fuel the rest of your day," evening→"Have a peaceful evening" or "Take this warmth into your night," night→"Have a restful night" or "Sleep well tonight." The send-off MUST be a fully finished sentence — never trail off or leave a thought incomplete. This is the last thing the listener hears, so it must land with warmth and finality.`,
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
              `- CRITICAL: The very last sentence must always be a complete send-off wish (e.g., "Have a peaceful evening" or "Enjoy the rest of your day"). Never end mid-thought or with an ellipsis.`,
              `- Reference accessible neuroscience concepts naturally (e.g., "your nervous system settles," "each breath sends a signal of safety")`,
              `- Mood-specific emphasis: stressed→release/safety, anxious→grounding/presence, tired→vitality/awakening, sad→warmth/comfort, overwhelmed→simplicity/clarity, calm→deepening/peace, energized→momentum/vitality, grateful→appreciation/connection, confident→strength/self-trust, focused→clarity/precision, joyful→celebration/lightness`,
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

      if (clientDisconnected) {
        console.log(`Client disconnected after script generation (${duration}min), skipping TTS`);
        return;
      }

      let audioBuffer: ArrayBuffer;
      let wordTimings: WordTiming[] = [];
      let audioDuration = 0;

      try {
        if (usePersonalVoice && voiceId) {
          const result = await generateAudio(script, voiceId, true, moodConfig, undefined, true);
          audioBuffer = result.audio;
          wordTimings = result.wordTimings;
          audioDuration = result.duration;
        } else {
          const stockVoiceId = voiceId && isHumeVoice(voiceId) ? voiceId : "hume_lotus";
          const result = await generateAudio(script, stockVoiceId, false, moodConfig, undefined, true);
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
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

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

  registerReminderRoutes(app);

  registerBreathingRoutes(app);

  registerAdminRoutes(app, generateAudio, getPillarVoiceConfig);

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
      await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
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

  registerGithubRoutes(app);

  app.get("/api/daily-greeting", requireAuth, dailyGreetingLimiter, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const timeOfDay = (req.query.timeOfDay as string) || "morning";
    const validTimes = ["morning", "afternoon", "evening", "night"];
    const normalizedTime = validTimes.includes(timeOfDay) ? timeOfDay : "morning";
    const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const clientDayOfWeek = req.query.dayOfWeek as string;
    const dayOfWeek = (clientDayOfWeek && validDays.includes(clientDayOfWeek)) ? clientDayOfWeek : validDays[new Date().getDay()];
    const hoursAway = req.query.hoursAway ? parseInt(req.query.hoursAway as string, 10) : null;
    const isWelcomeBack = hoursAway !== null && hoursAway >= 4;

    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = isWelcomeBack ? `${userId}-${today}-${dayOfWeek}-wb` : `${userId}-${today}-${dayOfWeek}`;

    const cached = dailyGreetingCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    try {
      const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
      const firstName = user?.name?.split(" ")[0] || "";

      const [sessionStats, affirmationCount, voiceCloneStatus, listeningCount, journeyCount, topJourneyMood, lastVibe] = await Promise.all([
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
        db.select({ total: sql<number>`count(*)::int` })
          .from(journeyCompletions)
          .where(eq(journeyCompletions.userId, userId))
          .then(r => r[0]),
        db.select({
          targetMood: journeyCompletions.targetMood,
          count: sql<number>`count(*)::int`,
        })
          .from(journeyCompletions)
          .where(and(eq(journeyCompletions.userId, userId), eq(journeyCompletions.completedFully, true)))
          .groupBy(journeyCompletions.targetMood)
          .orderBy(sql`count(*) desc`)
          .limit(1)
          .then(r => r[0]),
        db.select({ vibeId: journeyCompletions.vibeId })
          .from(journeyCompletions)
          .where(and(eq(journeyCompletions.userId, userId), isNotNull(journeyCompletions.vibeId)))
          .orderBy(desc(journeyCompletions.completedAt))
          .limit(1)
          .then(r => r[0]),
      ]);

      const totalBreathingSessions = sessionStats?.total || 0;
      const totalAffirmations = affirmationCount?.total || 0;
      const hasVoiceClone = !!voiceCloneStatus;
      const totalListens = listeningCount?.total || 0;
      const totalJourneys = journeyCount?.total || 0;

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
      if (totalListens === 0 && totalAffirmations > 0) nudgeOpportunities.push("NO_LISTENS: User has affirmations but hasn't listened to any yet. Use actionType 'listen'.");
      if (totalListens > 0 && totalAffirmations > 0) nudgeOpportunities.push(`LISTEN_AGAIN: User has ${totalListens} listening sessions — encourage them to listen again. Repetition rewires neural pathways. Use actionType 'listen'.`);
      if (totalJourneys === 0) nudgeOpportunities.push("NO_JOURNEYS: User has never tried a mood journey. These are guided wellness paths combining breathing, meditation, and affirmations.");

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
          const vibeConfig = getVibeConfig(lastVibe.vibeId as VibeId);
          if (vibeConfig) parts.push(`last vibe: "${vibeConfig.label}" (${vibeConfig.description})`);
        }
        statsContext = `\nUser activity: ${parts.join(", ")}.`;
      }

      let welcomeBackContext = "";
      if (isWelcomeBack && hoursAway) {
        const awayLabel = hoursAway >= 24
          ? `${Math.round(hoursAway / 24)} day(s)`
          : `${hoursAway} hour(s)`;
        welcomeBackContext = `\nWELCOME BACK: The user is returning after being away for ${awayLabel}. Acknowledge their return warmly but subtly — don't say "welcome back" literally. Instead, reference the time away naturally: "Your ${normalizedTime} reset awaits" or "picking up right where you left off" or weave their streak/stats into a return-flavored message. Make it feel like the app noticed them and is glad they're here.`;
      }

      const lastNudge = lastNudgeTypeByUser.get(userId);
      let filteredNudges = nudgeOpportunities;
      if (lastNudge && nudgeOpportunities.length > 1) {
        filteredNudges = nudgeOpportunities.filter(n => {
          const tag = n.split(":")[0];
          if (lastNudge === "listen" && (tag === "LISTEN_AGAIN" || tag === "NO_LISTENS")) return false;
          if (lastNudge === "create" && (tag === "NO_AFFIRMATIONS" || tag === "FEW_AFFIRMATIONS")) return false;
          if (lastNudge === "clone" && tag === "NO_VOICE_CLONE") return false;
          if (lastNudge === "breathe" && tag === "NO_BREATHING") return false;
          if (lastNudge === "journey" && tag === "NO_JOURNEYS") return false;
          return true;
        });
        if (filteredNudges.length === 0) filteredNudges = nudgeOpportunities;
      }

      let nudgeContext = "";
      if (filteredNudges.length > 0) {
        nudgeContext = `\nNudge opportunities (pick ONE randomly if you want to nudge, or skip if you prefer pure encouragement):\n${filteredNudges.join("\n")}`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              `You write ultra-short empowering sub-messages for the Retuned wellness app. The greeting line ("Good ${normalizedTime}, ${firstName}") is already shown above your message — you only write the sub-message below it.`,
              ``,
              `CONTEXT: It is ${dayOfWeek} ${normalizedTime}. Weave the day or time naturally into the message when it feels right — like a friend who knows what part of the week it is. Don't force it. Examples: "Thursday nights were made for rewiring...", "${dayOfWeek}s hit different when your mind is clear", "midweek — the perfect reset point". Sometimes skip the day entirely and just be encouraging.`,
              ``,
              `TONE: Warm, not cheery. Like a knowing friend. Be creative, witty, surprising — users should look forward to what it says next. No quotation marks, no exclamation marks.`,
              ``,
              `THEMES to weave in (pick one per message): neural pathways strengthening, brain rewiring for confidence, neuroplasticity shaping beliefs, amygdala calming through breathwork, prefrontal cortex activation, mood journeys building emotional resilience pathways. Use accessible language — no jargon.`,
              `${statsContext}`,
              `${welcomeBackContext}`,
              `${nudgeContext}`,
              ``,
              `RESPONSE FORMAT: Return valid JSON only. No markdown, no code fences.`,
              `{`,
              `  "message": "Your main message text here (max 12 words)",`,
              `  "actionText": "tappable link text (2-5 words, optional — omit key if no nudge)",`,
              `  "actionType": "create | breathe | meditate | clone | listen (only if actionText is provided)"`,
              `}`,
              ``,
              `RULES:`,
              `- "message" is the full visible text INCLUDING a natural lead-in to the action. Max 12 words total.`,
              `- If nudging, end "message" with a dash or ellipsis, then put the call-to-action in "actionText". The actionText is rendered as a tappable link right after the message.`,
              `  Example: { "message": "Your mind is ready for something new —", "actionText": "create your first affirmation", "actionType": "create" }`,
              `  Example: { "message": "Imagine hearing these words in your voice —", "actionText": "try Inner Voice", "actionType": "clone" }`,
              `  Example: { "message": "A 60-second reset could change your day —", "actionText": "breathe now", "actionType": "breathe" }`,
              `  Example: { "message": "Let stillness find you —", "actionText": "start a guided moment", "actionType": "meditate" }`,
              `  Example: { "message": "Your mind knows the path to ${topJourneyMood?.targetMood || 'calm'} now —", "actionText": "start a mood journey", "actionType": "journey" }`,
              `  Example: { "message": "Your neural pathways are ready to absorb —", "actionText": "listen now", "actionType": "listen" }`,
              `- If no nudge fits, just return { "message": "..." } with pure encouragement (max 10 words).`,
              `- actionType mapping: "create" = create new affirmation, "breathe" = breathing exercise, "meditate" = guided meditation, "clone" = voice cloning setup, "journey" = mood check-in/journey, "listen" = play an affirmation.`,
              `- About 60% of the time, include a nudge when opportunities exist. 40% pure encouragement.`,
              `- Never nag. Be curious, inviting, playful. Each message should feel fresh.`,
              `- NEVER use first-person "I" (e.g., "I know you can do it", "I believe in you"). Always address the user directly with "you/your".`,
            ].join("\n"),
          },
          {
            role: "user",
            content: isWelcomeBack
              ? `Generate a ${dayOfWeek} ${normalizedTime} welcome-back sub-message for a user returning after ${hoursAway} hours.`
              : `Generate a ${dayOfWeek} ${normalizedTime} sub-message.`,
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
        const validActions = ["create", "breathe", "meditate", "clone", "journey", "listen"];
        if (parsed.actionType && !validActions.includes(parsed.actionType)) {
          delete parsed.actionText;
          delete parsed.actionType;
        }
      } catch {
        parsed = { message: raw.replace(/["""''!]/g, "").substring(0, 80) || dailyGreetingFallbacks[normalizedTime] };
      }

      dailyGreetingCache.set(cacheKey, parsed);
      if (parsed.actionType) {
        lastNudgeTypeByUser.set(userId, parsed.actionType);
      }
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
        console.log(`[Voice Expiry] Sent ${expiryResult.warned} expiry warnings`);
      }
    } catch (expiryError) {
      console.error("[Voice Expiry] Warning check failed:", expiryError);
    }

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

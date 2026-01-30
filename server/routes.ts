import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { affirmations, voiceSamples, categories, users, collections, customCategories, notificationSettings } from "@shared/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";
import {
  cloneVoice,
  textToSpeech as elevenLabsTTS,
  type WordTiming,
} from "./replit_integrations/elevenlabs/client";
import { setupAuth, requireAuth, optionalAuth, AuthenticatedRequest } from "./auth";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
async function generateScript(goal: string, category?: string, length?: string): Promise<string> {
  const lengthConfig = {
    short: { sentences: 2, tokens: 80, description: "exactly 2 sentences" },
    medium: { sentences: 5, tokens: 200, description: "exactly 5 sentences" },
    long: { sentences: 10, tokens: 400, description: "exactly 10 sentences" },
  };
  
  // Category-specific tone and style instructions
  const categoryTones: Record<string, string> = {
    Confidence: "Use bold, assertive, and powerful language. Write as someone who is unstoppable and radiates self-assurance. Use strong declarative statements like 'I am powerful', 'I command respect', 'I own my greatness'.",
    Career: "Use professional, ambitious, and driven language. Write as someone who is a high achiever destined for success. Focus on leadership, excellence, and professional growth.",
    Health: "Use nurturing, calming, and wellness-focused language. Write as someone who deeply cares for their body and mind. Focus on vitality, energy, healing, and holistic well-being.",
    Wealth: "Use abundant, prosperous, and magnetic language. Write as someone who naturally attracts wealth and opportunities. Focus on financial freedom, abundance mindset, and prosperity consciousness.",
    Relationships: "Use warm, soft, loving, and gentle language. Write as someone who is deeply connected and emotionally open. Focus on love, connection, harmony, and meaningful bonds.",
    Sleep: "Use peaceful, soothing, dreamy, and tranquil language. Write as someone drifting into deep rest. Focus on relaxation, surrender, serenity, and restorative sleep.",
  };
  
  const config = lengthConfig[length as keyof typeof lengthConfig] || lengthConfig.medium;
  console.log(`Generating script with length: ${length}, category: ${category}, using config:`, config);
  
  // Get category-specific tone or use neutral tone
  const toneInstruction = category && categoryTones[category] 
    ? categoryTones[category] 
    : "Use positive, empowering, and uplifting language.";
  
  const systemPrompt = `Write ${config.sentences} affirmation sentences. First person, present tense. No titles, no instructions, no numbering. Just ${config.sentences} sentences.

TONE AND STYLE: ${toneInstruction}`;

  const userPrompt = `${config.sentences} affirmations for: ${goal}. Only ${config.sentences} sentences total.`;

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
  app.options("/uploads/:filename", (req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Encoding');
    res.status(204).end();
  });

  // Serve uploaded audio files (public access with security validations)
  // Audio files use random filenames making them hard to guess
  // Security is enforced through: filename pattern validation + path traversal prevention
  app.get("/uploads/:filename", async (req: Request, res: Response) => {
    try {
      const rawFilename = req.params.filename;
      
      // SECURITY: Sanitize filename to prevent path traversal attacks (e.g., ../../etc/passwd)
      const filename = path.basename(rawFilename);
      
      // SECURITY: Reject any filename that doesn't match expected pattern
      if (!/^(affirmation|voice)-\d+(-\d+)?\.(mp3|m4a|wav|webm)$/.test(filename)) {
        console.log(`SECURITY: Rejected malformed filename: ${rawFilename}`);
        return res.status(400).json({ error: "Invalid filename format" });
      }
      
      const filePath = path.join(uploadDir, filename);
      
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
      
      // Set CORS headers for mobile audio playback
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Encoding');
      
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

  // Generate script using AI (requires auth)
  app.post("/api/affirmations/generate-script", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { goal, category, length } = req.body;

      if (!goal) {
        return res.status(400).json({ error: "Goal is required" });
      }

      const script = await generateScript(goal, category, length);
      res.json({ script });
    } catch (error) {
      console.error("Error generating script:", error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });

  // Create affirmation with voice synthesis (requires auth)
  app.post("/api/affirmations/create-with-voice", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, script, category, isManual } = req.body;

      if (!script) {
        return res.status(400).json({ error: "Script is required" });
      }

      // Auto-categorize if no category provided
      let categoryName = category;
      if (!categoryName) {
        console.log("No category provided, auto-categorizing...");
        categoryName = await autoCategorizе(script);
        console.log("Auto-categorized as:", categoryName);
      }

      // Simply use the category name directly - no complex lookups needed
      console.log("Saving affirmation with category:", categoryName);

      // Get user's voice ID if available (specific to this user)
      const [voiceSample] = await db
        .select()
        .from(voiceSamples)
        .where(and(
          eq(voiceSamples.userId, req.userId!),
          eq(voiceSamples.status, "ready")
        ))
        .orderBy(desc(voiceSamples.createdAt))
        .limit(1);

      console.log("Voice sample found:", voiceSample);
      console.log("Using voiceId:", voiceSample?.voiceId);

      // Generate audio with word timings
      const audioResult = await generateAudio(
        script,
        voiceSample?.voiceId || undefined
      );

      // Save audio file
      const audioFilename = `affirmation-${Date.now()}.mp3`;
      const audioPath = path.join(uploadDir, audioFilename);
      fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));

      // Create affirmation record (associated with user)
      const [newAffirmation] = await db
        .insert(affirmations)
        .values({
          userId: req.userId!,
          title: title || "My Affirmation",
          script,
          categoryName: categoryName || null, // Store category name directly
          audioUrl: `/uploads/${audioFilename}`,
          duration: audioResult.duration,
          wordTimings: JSON.stringify(audioResult.wordTimings),
          isManual: isManual || false,
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

  // Increment play count (requires auth)
  app.post("/api/affirmations/:id/play", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

      const [updated] = await db
        .update(affirmations)
        .set({
          playCount: (affirmation.playCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(affirmations.id, parseInt(id)))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating play count:", error);
      res.status(500).json({ error: "Failed to update play count" });
    }
  });

  // Upload voice sample and clone voice (requires auth)
  app.post(
    "/api/voice-samples",
    requireAuth,
    audioUpload.single("audio"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        // Create voice sample record (associated with user)
        const [sample] = await db
          .insert(voiceSamples)
          .values({
            userId: req.userId!,
            audioUrl: `/uploads/${file.filename}`,
            status: "processing",
          })
          .returning();

        // Clone voice with ElevenLabs
        try {
          const voiceId = await cloneVoice(file.path, "My Affirmation Voice");

          // Update sample with voice ID
          const [updatedSample] = await db
            .update(voiceSamples)
            .set({ voiceId, status: "ready" })
            .where(eq(voiceSamples.id, sample.id))
            .returning();

          // Also update the user's voiceId and hasVoiceSample flag
          await db
            .update(users)
            .set({ voiceId, hasVoiceSample: true })
            .where(eq(users.id, req.userId!));

          res.json(updatedSample);
        } catch (cloneError) {
          console.error("Voice cloning error:", cloneError);

          // Update status to failed
          await db
            .update(voiceSamples)
            .set({ status: "failed" })
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

      res.json({
        hasVoiceSample: !!sample && sample.status === "ready",
        status: sample?.status || null,
      });
    } catch (error) {
      console.error("Error fetching voice sample status:", error);
      res.status(500).json({ error: "Failed to fetch voice sample status" });
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

      res.json({
        totalListens,
        streak: 0,
        affirmationsCount: allAffirmations.length,
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

      const createdAffirmations = [];

      for (const sample of sampleAffirmations) {
        try {
          // Generate audio with default voice (Rachel)
          const audioResult = await generateAudio(sample.script);
          
          // Save audio file
          const audioFilename = `affirmation-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
          const audioPath = path.join(uploadDir, audioFilename);
          fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));

          // Create affirmation record
          const [newAffirmation] = await db
            .insert(affirmations)
            .values({
              userId: req.userId!,
              title: sample.title,
              script: sample.script,
              categoryId: sample.categoryId,
              audioUrl: `/uploads/${audioFilename}`,
              duration: audioResult.duration,
              wordTimings: JSON.stringify(audioResult.wordTimings),
              isManual: false,
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

  const httpServer = createServer(app);

  return httpServer;
}

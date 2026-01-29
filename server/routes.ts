import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { affirmations, voiceSamples, categories } from "@shared/schema";
import { eq, desc, asc } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";
import {
  cloneVoice,
  textToSpeech as elevenLabsTTS,
} from "./replit_integrations/elevenlabs/client";

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
async function generateScript(goal: string, category?: string): Promise<string> {
  const systemPrompt = `You are an expert in creating powerful, personalized affirmations that rewire subconscious beliefs. Create affirmations that are:
- Written in first person ("I am", "I have", "I attract")
- Present tense, as if already achieved
- Positive and empowering
- Specific and emotionally resonant
- 30-60 seconds when read aloud (approximately 75-150 words)

The affirmations should flow naturally as if speaking to oneself, building in emotional intensity.`;

  const userPrompt = `Create a powerful affirmation script for someone who wants to: ${goal}${category ? ` (Focus area: ${category})` : ""}.

The script should be a continuous, flowing set of affirmations that build upon each other, creating a powerful subconscious reprogramming experience.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || "";
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
): Promise<{ audio: ArrayBuffer; duration: number }> {
  try {
    // Try ElevenLabs first (for cloned voices or better quality)
    console.log("Attempting ElevenLabs TTS with voiceId:", voiceId);
    const result = await elevenLabsTTS(script, voiceId);
    console.log("ElevenLabs TTS succeeded");
    return result;
  } catch (error) {
    console.error("ElevenLabs TTS failed, falling back to OpenAI:", error);
    
    // Fallback to OpenAI TTS if ElevenLabs fails
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: script,
    });

    const audioBuffer = await response.arrayBuffer();
    const wordCount = script.split(/\s+/).length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);

    return {
      audio: audioBuffer,
      duration: estimatedDuration,
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded audio files
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
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

  // Get all affirmations
  app.get("/api/affirmations", async (req: Request, res: Response) => {
    try {
      const allAffirmations = await db
        .select()
        .from(affirmations)
        .orderBy(asc(affirmations.displayOrder), desc(affirmations.createdAt));
      res.json(allAffirmations);
    } catch (error) {
      console.error("Error fetching affirmations:", error);
      res.status(500).json({ error: "Failed to fetch affirmations" });
    }
  });

  // Get single affirmation
  app.get("/api/affirmations/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.id, parseInt(id)));

      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      res.json(affirmation);
    } catch (error) {
      console.error("Error fetching affirmation:", error);
      res.status(500).json({ error: "Failed to fetch affirmation" });
    }
  });

  // Generate script using AI
  app.post("/api/affirmations/generate-script", async (req: Request, res: Response) => {
    try {
      const { goal, category } = req.body;

      if (!goal) {
        return res.status(400).json({ error: "Goal is required" });
      }

      const script = await generateScript(goal, category);
      res.json({ script });
    } catch (error) {
      console.error("Error generating script:", error);
      res.status(500).json({ error: "Failed to generate script" });
    }
  });

  // Create affirmation with voice synthesis
  app.post("/api/affirmations/create-with-voice", async (req: Request, res: Response) => {
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

      // Look up category ID
      let categoryId: number | null = null;
      if (categoryName) {
        const [cat] = await db
          .select()
          .from(categories)
          .where(eq(categories.name, categoryName))
          .limit(1);
        if (cat) {
          categoryId = cat.id;
        }
      }

      // Get user's voice ID if available
      const [voiceSample] = await db
        .select()
        .from(voiceSamples)
        .where(eq(voiceSamples.status, "ready"))
        .orderBy(desc(voiceSamples.createdAt))
        .limit(1);

      console.log("Voice sample found:", voiceSample);
      console.log("Using voiceId:", voiceSample?.voiceId);

      // Generate audio
      const audioResult = await generateAudio(
        script,
        voiceSample?.voiceId || undefined
      );

      // Save audio file
      const audioFilename = `affirmation-${Date.now()}.mp3`;
      const audioPath = path.join(uploadDir, audioFilename);
      fs.writeFileSync(audioPath, Buffer.from(audioResult.audio));

      // Create affirmation record
      const [newAffirmation] = await db
        .insert(affirmations)
        .values({
          title: title || "My Affirmation",
          script,
          categoryId,
          audioUrl: `/uploads/${audioFilename}`,
          duration: audioResult.duration,
          isManual: isManual || false,
        })
        .returning();

      res.json(newAffirmation);
    } catch (error) {
      console.error("Error creating affirmation:", error);
      res.status(500).json({ error: "Failed to create affirmation" });
    }
  });

  // Delete affirmation
  app.delete("/api/affirmations/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the affirmation to delete the audio file
      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.id, parseInt(id)));
      
      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }
      
      // Delete audio file if exists
      if (affirmation.audioUrl) {
        const audioPath = path.join(process.cwd(), affirmation.audioUrl);
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
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

  // Update favorite status
  app.patch("/api/affirmations/:id/favorite", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isFavorite } = req.body;

      const [updated] = await db
        .update(affirmations)
        .set({ isFavorite, updatedAt: new Date() })
        .where(eq(affirmations.id, parseInt(id)))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating favorite:", error);
      res.status(500).json({ error: "Failed to update favorite" });
    }
  });

  // Auto-save affirmation with AI-generated title and category
  app.post("/api/affirmations/:id/auto-save", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.id, parseInt(id)));

      if (!affirmation) {
        return res.status(404).json({ error: "Affirmation not found" });
      }

      const script = affirmation.script || affirmation.title || "";
      
      // Generate AI title and category in parallel
      const [generatedTitle, categoryName] = await Promise.all([
        autoGenerateTitle(script),
        affirmation.categoryId ? Promise.resolve(null) : autoCategorizе(script),
      ]);

      // Find category ID if we need to update it
      let categoryId = affirmation.categoryId;
      if (categoryName) {
        const [category] = await db
          .select()
          .from(categories)
          .where(eq(categories.name, categoryName));
        if (category) {
          categoryId = category.id;
        }
      }

      // Update the affirmation
      const [updated] = await db
        .update(affirmations)
        .set({
          title: generatedTitle,
          categoryId: categoryId,
          updatedAt: new Date(),
        })
        .where(eq(affirmations.id, parseInt(id)))
        .returning();

      console.log(`Auto-saved affirmation ${id}: title="${generatedTitle}", categoryId=${categoryId}`);
      res.json(updated);
    } catch (error) {
      console.error("Error auto-saving affirmation:", error);
      res.status(500).json({ error: "Failed to auto-save affirmation" });
    }
  });

  // Increment play count
  app.post("/api/affirmations/:id/play", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [affirmation] = await db
        .select()
        .from(affirmations)
        .where(eq(affirmations.id, parseInt(id)));

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

  // Upload voice sample and clone voice
  app.post(
    "/api/voice-samples",
    audioUpload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        // Create voice sample record
        const [sample] = await db
          .insert(voiceSamples)
          .values({
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

  // Get user's voice sample status
  app.get("/api/voice-samples/status", async (req: Request, res: Response) => {
    try {
      const [sample] = await db
        .select()
        .from(voiceSamples)
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

  // Get user stats
  app.get("/api/user/stats", async (req: Request, res: Response) => {
    try {
      const allAffirmations = await db.select().from(affirmations);

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

  // Reorder affirmations
  app.put("/api/affirmations/reorder", async (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      
      if (!orderedIds || !Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds array is required" });
      }

      // Update each affirmation's display order
      for (let i = 0; i < orderedIds.length; i++) {
        await db
          .update(affirmations)
          .set({ displayOrder: i })
          .where(eq(affirmations.id, orderedIds[i]));
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

  const httpServer = createServer(app);

  return httpServer;
}

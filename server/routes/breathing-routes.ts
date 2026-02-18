import type { Express, Request, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth";
import { db } from "../db";
import { breathingSessions } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { openai } from "../replit_integrations/audio/client";

const breathingWisdomCache = new Map<string, { wisdom: string[]; timestamp: number }>();

const breathingWisdomFallbacks: Record<string, string[]> = {
  box: [
    "Navy SEALs use this exact pattern to stay sharp under pressure",
    "Your cortisol is dropping with every cycle you complete",
    "This is literally retraining your stress response right now",
    "Equal inhale-hold-exhale timing synchronizes your autonomic nervous system",
    "You're strengthening your vagus nerve — your body's calm switch",
    "Each cycle improves your heart rate variability — that's real progress",
    "This rhythm is resetting your baroreceptors — your blood pressure is evening out",
    "You're building stress resilience that carries into your whole day"
  ],
  "478": [
    "That long exhale is activating your parasympathetic nervous system",
    "The extended exhale slows your heart rate — your body is downshifting right now",
    "Your brain waves are shifting from stress mode to calm mode right now",
    "The 7-second hold boosts oxygen absorption — your cells are thanking you",
    "Your prefrontal cortex is coming back online as your breathing slows",
    "You're doing something measurable for your nervous system right now",
    "Each cycle is reducing your heart rate by a few beats per minute",
    "That 8-second exhale is twice as long as the inhale — the ratio is what calms you"
  ],
  coherent: [
    "Five breaths per minute is the optimal rate for heart-brain coherence",
    "Your heart and brain are literally synchronizing right now",
    "This balanced rhythm is the sweet spot for maximum HRV improvement",
    "Olympic athletes use this exact rhythm for peak performance",
    "At this pace your respiratory and cardiovascular rhythms lock together",
    "Your heart rate variability is improving with each breath you take",
    "Consistent practice here compounds — you're investing in yourself",
    "This rhythm brings your entire autonomic nervous system into balance"
  ],
  energizing: [
    "You're flooding your prefrontal cortex with oxygen right now",
    "This pattern increases norepinephrine — your natural focus chemical",
    "Your mitochondria are producing more energy with each fast breath",
    "Rapid breathing drives your sympathetic nervous system — natural alertness kicking in",
    "You're activating your body's natural energy system — no caffeine needed",
    "Your brain uses 20% of your total oxygen — you're giving it a boost",
    "This rhythm is spiking your adrenaline just enough to sharpen your focus",
    "Every round is sharpening your mental clarity for the hours ahead"
  ],
  alternate: [
    "Alternating nostrils balances your left and right brain hemispheres",
    "Your nasal cycle naturally shifts every 90 minutes — you're harmonizing it",
    "This technique lowers your heart rate and blood pressure simultaneously",
    "Each nostril connects to opposite brain hemispheres — you're activating both",
    "Yogic practitioners have used this for thousands of years to center the mind",
    "Your autonomic nervous system is rebalancing with every switch",
    "Right nostril breathing activates your sympathetic system, left calms it — you're doing both",
    "This is one of the fastest ways to bring your nervous system into equilibrium"
  ]
};

export function registerBreathingRoutes(app: Express): void {
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

  // Get breathing wisdom tips for a technique (cached daily)
  app.get("/api/breathing-wisdom", async (req: Request, res: Response) => {
    try {
      const techniqueId = req.query.techniqueId as string;

      // Validate technique ID
      if (!techniqueId || !["box", "478", "coherent", "energizing", "alternate"].includes(techniqueId)) {
        return res.status(400).json({ error: "Invalid technique ID. Must be one of: box, 478, coherent, energizing, alternate" });
      }

      // Create cache key: techniqueId + today's date
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const cacheKey = `${techniqueId}-${today}`;

      // Check cache first
      const cached = breathingWisdomCache.get(cacheKey);
      if (cached) {
        const cacheAge = Date.now() - cached.timestamp;
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (cacheAge < twentyFourHours) {
          return res.json({ wisdom: cached.wisdom });
        }
      }

      // Generate new wisdom tips using OpenAI
      let wisdom: string[];

      try {
        // Technique descriptions for context
        const techniqueDescriptions: Record<string, { name: string; pattern: string; focus: string }> = {
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
- Half should be positive reinforcement — tell them they're doing something real and measurable for themselves
- State everything as direct fact. You KNOW the science — say it with confidence, no hedging
- Examples of GOOD tips:
  * "Your cortisol is dropping with every exhale right now"
  * "That extended exhale just activated your parasympathetic nervous system"
  * "Each cycle strengthens the connection between your prefrontal cortex and amygdala"
  * "Your baroreceptors are syncing to this rhythm — that's your blood pressure calming down"
  * "You're building real stress resilience that lasts beyond this session"
  * "Right now your vagus nerve is sending slow-down signals to your heart"
  * "This rhythm is shifting your brainwaves from beta toward alpha"
- Examples of BAD tips (too flowery/poetic — NEVER write these):
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
- Keep it grounded, factual, and encouraging — like a confident coach who knows the science cold

RESPONSE FORMAT:
Return ONLY the 8 tips, one per line. No numbering, no titles, no extra text.`;

        const userPrompt = `Generate 8 unique breathing wisdom tips for ${technique.name}. Today is ${today} — use this date to ensure tips feel fresh and varied each day.`;

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
        wisdom = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('*'))
          .slice(0, 8); // Ensure exactly 8 tips

        // If we didn't get 8 tips, pad with fallback
        if (wisdom.length < 8) {
          const fallback = breathingWisdomFallbacks[techniqueId] || [];
          wisdom = [...wisdom, ...fallback].slice(0, 8);
        }
      } catch (aiError) {
        console.error("OpenAI error generating breathing wisdom:", aiError);
        // Fall back to hardcoded tips
        wisdom = breathingWisdomFallbacks[techniqueId] || [];
      }

      // Cache the result
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
}

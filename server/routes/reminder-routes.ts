import type { Express, Request, Response } from "express";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "../auth";
import { db } from "../db";
import { reminders, supportRequests, users, notificationSettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { openai } from "../replit_integrations/audio/client";

export function registerReminderRoutes(app: Express): void {
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
}

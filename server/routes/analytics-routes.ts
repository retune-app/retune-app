import type { Express, Request, Response } from "express";
import { type AuthenticatedRequest, optionalAuth } from "../auth";
import { db } from "../db";
import { analyticsEvents, users } from "@shared/schema";
import { sql, gte, eq } from "drizzle-orm";

export function registerAnalyticsRoutes(app: Express) {
  app.post("/api/analytics/events", optionalAuth as any, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.userId || null;

      const { events } = req.body;

      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "events array is required" });
      }

      if (events.length > 50) {
        return res.status(400).json({ error: "Maximum 50 events per batch" });
      }

      const rows = events.map((event: any) => ({
        userId: userId || event.userId || null,
        sessionId: event.sessionId || null,
        eventName: event.eventName,
        properties: event.properties || null,
        screenName: event.screenName || null,
        platform: event.platform || null,
        appVersion: event.appVersion || null,
      }));

      await db.insert(analyticsEvents).values(rows);

      res.json({ success: true, count: rows.length });
    } catch (error) {
      console.error("[analytics] Failed to record events:", error);
      res.status(500).json({ error: "Failed to record events" });
    }
  });

  app.get("/api/admin/analytics/summary", async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, authReq.userId));
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const days = parseInt(req.query.days as string) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [eventCounts, uniqueUsers, topEvents] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, since)),

        db.select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, since)),

        db.select({
          eventName: analyticsEvents.eventName,
          count: sql<number>`count(*)`,
        })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, since))
          .groupBy(analyticsEvents.eventName)
          .orderBy(sql`count(*) desc`)
          .limit(20),
      ]);

      res.json({
        period: `${days} days`,
        totalEvents: eventCounts[0]?.count || 0,
        uniqueUsers: uniqueUsers[0]?.count || 0,
        topEvents,
      });
    } catch (error) {
      console.error("[analytics] Failed to get summary:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });
}

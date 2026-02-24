import { db } from "./db";
import { serverErrors } from "@shared/schema";

export async function trackError(component: string, message: string, error?: any, metadata?: Record<string, any>) {
  try {
    await db.insert(serverErrors).values({
      level: "error",
      component,
      message,
      stack: error?.stack || null,
      metadata: metadata || null,
    });
  } catch (e) {
    console.error("[error-tracker] Failed to log error:", e);
  }
}

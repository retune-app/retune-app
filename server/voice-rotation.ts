import { db } from "./db";
import { users, voiceSamples } from "@shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { deleteVoice, listVoices } from "./replit_integrations/elevenlabs/client";

const VOICE_SLOT_WARNING_THRESHOLD = 0.83;
const ELEVENLABS_PLAN_VOICE_LIMIT = 30;

export async function findInactiveVoices(inactiveDays: number = 60) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

  const inactiveUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      voiceId: users.voiceId,
      voiceLastUsedAt: users.voiceLastUsedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.voiceId),
        sql`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) < ${cutoffDate.toISOString()}`
      )
    );

  return inactiveUsers;
}

export async function rotateUserVoice(userId: string, voiceId: string) {
  try {
    await deleteVoice(voiceId);
    console.log(`Deleted voice ${voiceId} from ElevenLabs for user ${userId}`);
  } catch (error: any) {
    console.error(`Failed to delete voice ${voiceId} from ElevenLabs:`, error?.message);
  }

  await db
    .update(users)
    .set({
      voiceId: null,
      hasVoiceSample: false,
      preferredVoiceType: "ai",
      voiceLastUsedAt: null,
    })
    .where(eq(users.id, userId));

  await db
    .update(voiceSamples)
    .set({ status: "rotated" })
    .where(eq(voiceSamples.userId, userId));

  return { userId, voiceId, rotated: true };
}

export async function runVoiceRotation(inactiveDays: number = 60) {
  const inactiveVoices = await findInactiveVoices(inactiveDays);

  const results = [];
  for (const user of inactiveVoices) {
    if (user.voiceId) {
      const result = await rotateUserVoice(user.id, user.voiceId);
      results.push(result);
    }
  }

  return {
    totalChecked: inactiveVoices.length,
    rotated: results.length,
    results,
  };
}

export async function getVoiceSlotStats() {
  const [activeVoicesDb] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(isNotNull(users.voiceId));

  const [totalUsers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recentlyActive] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        isNotNull(users.voiceId),
        sql`${users.voiceLastUsedAt} > ${thirtyDaysAgo.toISOString()}`
      )
    );

  let elevenLabsSlots = { used: 0, total: 0, warning: false, warningMessage: "" };
  try {
    const allVoices = await listVoices();
    const clonedVoices = allVoices.filter((v: any) => v.category === "cloned");
    const used = clonedVoices.length;

    const total = ELEVENLABS_PLAN_VOICE_LIMIT;

    const usageRatio = used / total;
    const warning = usageRatio >= VOICE_SLOT_WARNING_THRESHOLD;
    const warningMessage = warning
      ? `WARNING: ElevenLabs voice slots at ${used}/${total} (${Math.round(usageRatio * 100)}%). Consider upgrading your plan or running voice rotation.`
      : "";

    if (warning) {
      console.warn(`[Voice Slots] ${warningMessage}`);
    }

    elevenLabsSlots = { used, total, warning, warningMessage };
  } catch (error: any) {
    console.error("[Voice Slots] Failed to fetch ElevenLabs voice data:", error?.message);
    elevenLabsSlots = { used: 0, total: 0, warning: false, warningMessage: "Failed to fetch live ElevenLabs data" };
  }

  return {
    database: {
      activeVoiceSlots: Number(activeVoicesDb?.count || 0),
      totalUsers: Number(totalUsers?.count || 0),
      recentlyActiveVoices: Number(recentlyActive?.count || 0),
    },
    elevenLabs: elevenLabsSlots,
  };
}

export async function checkVoiceSlotWarning(): Promise<string | null> {
  try {
    const allVoices = await listVoices();
    const clonedVoices = allVoices.filter((v: any) => v.category === "cloned");
    const used = clonedVoices.length;
    const total = ELEVENLABS_PLAN_VOICE_LIMIT;
    const usageRatio = used / total;

    if (usageRatio >= VOICE_SLOT_WARNING_THRESHOLD) {
      const msg = `[Voice Slots WARNING] ${used}/${total} slots used (${Math.round(usageRatio * 100)}%). Running auto-cleanup...`;
      console.warn(msg);
      return msg;
    }
    return null;
  } catch (error: any) {
    console.error("[Voice Slots] Warning check failed:", error?.message);
    return null;
  }
}

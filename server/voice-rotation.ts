import { db } from "./db";
import { users, voiceSamples } from "@shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { deleteVoice } from "./replit_integrations/elevenlabs/client";

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
  const [activeVoices] = await db
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

  return {
    activeVoiceSlots: Number(activeVoices?.count || 0),
    totalUsers: Number(totalUsers?.count || 0),
    recentlyActiveVoices: Number(recentlyActive?.count || 0),
  };
}

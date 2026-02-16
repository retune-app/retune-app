import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { db } from "./db";
import { pushTokens, users } from "@shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

const expo = new Expo();

export async function sendPushNotifications(messages: ExpoPushMessage[]) {
  const validMessages = messages.filter(m => {
    const token = Array.isArray(m.to) ? m.to[0] : m.to;
    return Expo.isExpoPushToken(token);
  });

  if (validMessages.length === 0) return [];

  const chunks = expo.chunkPushNotifications(validMessages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("[Push] Error sending chunk:", error);
    }
  }

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      const token = Array.isArray(validMessages[i].to) ? validMessages[i].to[0] : validMessages[i].to;
      if (typeof token === "string") {
        try {
          await db.delete(pushTokens).where(eq(pushTokens.token, token));
          console.log(`[Push] Removed invalid token: ${token.substring(0, 20)}...`);
        } catch (err) {
          console.error("[Push] Failed to remove invalid token:", err);
        }
      }
    }
  }

  return tickets;
}

export async function sendVoiceExpiryWarnings() {
  const WARNING_DAYS_FIRST = 53;
  const ROTATION_DAYS = 60;

  const now = new Date();
  const firstWarningCutoff = new Date();
  firstWarningCutoff.setDate(now.getDate() - WARNING_DAYS_FIRST);

  const rotationCutoff = new Date();
  rotationCutoff.setDate(now.getDate() - ROTATION_DAYS);

  const atRiskUsers = await db
    .select({
      id: users.id,
      name: users.name,
      voiceId: users.voiceId,
      voiceLastUsedAt: users.voiceLastUsedAt,
      voiceExpiryWarningAt: users.voiceExpiryWarningAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.voiceId),
        sql`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) <= ${firstWarningCutoff.toISOString()}`,
        sql`COALESCE(${users.voiceLastUsedAt}, ${users.createdAt}) > ${rotationCutoff.toISOString()}`
      )
    );

  if (atRiskUsers.length === 0) {
    console.log("[Voice Expiry] No users with expiring voice clones");
    return { warned: 0 };
  }

  let totalWarned = 0;

  for (const user of atRiskUsers) {
    const lastUsed = user.voiceLastUsedAt || user.createdAt;
    const daysSinceUse = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilExpiry = ROTATION_DAYS - daysSinceUse;

    const lastWarning = user.voiceExpiryWarningAt;
    const daysSinceLastWarning = lastWarning
      ? Math.floor((now.getTime() - lastWarning.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    if (daysSinceLastWarning < 3) {
      continue;
    }

    const userTokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, user.id));

    if (userTokens.length === 0) {
      continue;
    }

    const isUrgent = daysUntilExpiry <= 2;
    const title = isUrgent
      ? "Your Inner Voice expires tomorrow"
      : "Your Inner Voice is expiring soon";
    const body = isUrgent
      ? "Tap to keep your voice clone active before it's removed."
      : `Your voice clone expires in ${daysUntilExpiry} days. Tap to keep it active.`;

    const messages: ExpoPushMessage[] = userTokens.map(t => ({
      to: t.token,
      title,
      body,
      data: { type: "voice_expiry", screen: "VoiceSettings" },
      sound: "default" as const,
      priority: isUrgent ? "high" as const : "default" as const,
    }));

    await sendPushNotifications(messages);

    await db
      .update(users)
      .set({ voiceExpiryWarningAt: now })
      .where(eq(users.id, user.id));

    totalWarned++;
    console.log(`[Voice Expiry] Warned user ${user.id} (${user.name}) — ${daysUntilExpiry} days until expiry`);
  }

  console.log(`[Voice Expiry] Sent warnings to ${totalWarned} users`);
  return { warned: totalWarned };
}

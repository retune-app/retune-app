import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/auth-token";
import Constants from "expo-constants";

const EVENT_QUEUE: AnalyticsEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 10000;
const MAX_BATCH_SIZE = 25;

let currentSessionId: string | null = null;

interface AnalyticsEventPayload {
  eventName: string;
  properties?: Record<string, any> | null;
  screenName?: string | null;
  sessionId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function startSession(): string {
  currentSessionId = generateSessionId();
  return currentSessionId;
}

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
  }
  return currentSessionId;
}

export function trackEvent(
  eventName: string,
  properties?: Record<string, any>,
  screenName?: string
) {
  const event: AnalyticsEventPayload = {
    eventName,
    properties: properties || null,
    screenName: screenName || null,
    sessionId: getSessionId(),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version || null,
  };

  EVENT_QUEUE.push(event);

  if (EVENT_QUEUE.length >= MAX_BATCH_SIZE) {
    flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL);
  }
}

async function flushEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (EVENT_QUEUE.length === 0) return;

  const batch = EVENT_QUEUE.splice(0, MAX_BATCH_SIZE);

  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${getApiUrl()}/api/analytics/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({ events: batch }),
      credentials: "include",
    });

    if (!response.ok) {
      EVENT_QUEUE.unshift(...batch);
    }
  } catch {
    EVENT_QUEUE.unshift(...batch);
  }
}

export function trackScreenView(screenName: string) {
  trackEvent("screen_view", { screen: screenName }, screenName);
}

export function trackAppOpen() {
  startSession();
  trackEvent("app_open");
}

export function trackMoodCheckin(startingMood: string) {
  trackEvent("mood_checkin_start", { startingMood }, "MoodCheckin");
}

export function trackMoodCheckinComplete(startingMood: string, targetMood: string) {
  trackEvent("mood_checkin_complete", { startingMood, targetMood }, "MoodCheckin");
}

export function trackJourneyStart(journeyType: string, mood?: string) {
  trackEvent("journey_start", { journeyType, mood }, "MoodJourney");
}

export function trackJourneyStepComplete(step: string, journeyType: string) {
  trackEvent("journey_step_complete", { step, journeyType }, "MoodJourney");
}

export function trackJourneyComplete(journeyType: string, durationSeconds?: number) {
  trackEvent("journey_complete", { journeyType, durationSeconds }, "MoodJourney");
}

export function trackJourneyExit(journeyType: string, exitStep: string) {
  trackEvent("journey_exit", { journeyType, exitStep }, "MoodJourney");
}

export function trackBreathingStart(technique: string, durationMinutes: number) {
  trackEvent("breathing_start", { technique, durationMinutes }, "Breathing");
}

export function trackBreathingComplete(technique: string, durationMinutes: number) {
  trackEvent("breathing_complete", { technique, durationMinutes }, "Breathing");
}

export function trackAffirmationCreate(pillar: string, method: string) {
  trackEvent("affirmation_create", { pillar, method }, "CreateAffirmation");
}

export function trackAffirmationPlay(affirmationId: number, pillar: string) {
  trackEvent("affirmation_play", { affirmationId, pillar }, "Player");
}

export function trackVoiceCloningStart() {
  trackEvent("voice_cloning_start", undefined, "VoiceCloning");
}

export function trackVoiceCloningComplete(success: boolean) {
  trackEvent("voice_cloning_complete", { success }, "VoiceCloning");
}

export function trackMeditationStart(mood?: string) {
  trackEvent("meditation_start", { mood }, "Meditation");
}

export function trackMeditationComplete(durationSeconds?: number) {
  trackEvent("meditation_complete", { durationSeconds }, "Meditation");
}

# Retuned

## Overview
Retuned is an application designed to help users reprogram their subconscious minds through personalized audio affirmations. It leverages AI to generate affirmation scripts based on user goals, which can then be played in the user's cloned voice or a selection of curated AI voices. The project aims to provide a powerful tool for personal growth and mental well-being, focusing on subconscious language patterns to maximize effectiveness. Key features include voice cloning, guided breathing exercises, AI-powered mood check-ins with personalized wellness paths, micro-meditations, and a comprehensive ambient sound library.

## Recent Changes
- **v1.7.3 Breathing Library Expansion (Feb 19, 2026)**: Expanded from 5 to 10 breathing techniques with category/difficulty system. New techniques: Triangle (4-4-4, Balance/Beginner), Physiological Sigh (4+1-6, Balance/Intermediate), 2:1 Calming (4-8, Sleep/Beginner), 7-2-11 Deep Relaxation (7-2-11, Sleep/Advanced), Vishama Vritti (4-8-6, Focus/Intermediate). Technique selector UI groups by goal category (Balance, Focus, Sleep, Energy) with category headers and difficulty badges. Vibe system updated: chill→2:1 Calming primary, in_my_head→Physiological Sigh primary + Triangle fallback, locked_in→Vishama Vritti fallback, heavy→7-2-11 fallback.
- **v1.7.3 Vibe-Powered Mood Journey (Feb 19, 2026)**: Expanded mood check-in to 10 starting moods (added Good, Wired, Frustrated, Scattered) and 9 target moods (added Locked In, Grounded, Lit Up). Full vibe integration: `resolveVibeFromMoodPair()` auto-maps 90 mood pair combinations to vibeId. Server `/api/mood-checkin` now uses vibe system for all personalization — breathing technique selection (via `vibeRouting.breathingTechniqueId`), affirmation matching (via `pickBestAffirmation` with vibe's boostTags/boostPillars/penaltyTags), creation theme suggestions (via `getSuggestedCreationTheme`), and meditation config (style, focusArea, ttsConfig passed to journey steps). Old hardcoded `moodPairBreathMap`, `moodOnlyBreathFallback`, inline affirmation scoring, and inline themeMap all replaced by vibe-engine. Vibe tone context injected into GPT journey prompt. Guided-moments endpoints also accept new mood IDs. Inner Voice affirmation TTS unchanged (Spirit pillar: stability 0.6, style 0.25, 1.8s pause). Architecture: `shared/vibes.ts` (config + resolveVibeFromMoodPair), `server/vibe-engine.ts` (routeVibe, pickBestAffirmation, scoreAffirmationForVibe, getSuggestedCreationTheme, getVibeJourneyPromptContext), `client/components/MoodCheckin.tsx` (2-step UI with mood pair display).
- **v1.7.2 Build 5 Icon Update (Feb 18, 2026)**: Updated to icon-light-v9 (more rings variant). Applied across landing page logo, all static pages (support, science, terms, privacy), and app icon for next EAS build.
- **v1.7.2 Build 4 App Icon & Landing Page (Feb 18, 2026)**: Switched app icon to light rings design (gold rings on white/grey, no play button). Updated landing page logo to match and enlarged nav logo from 38px to 46px.
- **v1.7.2 Build 3 Affirmation Humanizer (Feb 18, 2026)**: Two-pass humanizer system for affirmations. Option A: Enhanced system prompt with rules 10 (HUMAN VOICE) and 11 (AVOID AI-ISMS) for natural language generation. Option B: Post-processing `humanizeScript` pass via GPT-4o-mini rewrites stiff AI phrasing into private-thought tone with contractions, varied rhythm, and dashes. Falls back to original script on failure.
- **v1.7.2 Build 2 Code Optimization (Feb 18, 2026)**: Removed 43 debug console.logs from server, 14 unused imports across 11 client files. Modularized server/routes.ts (5,143→4,050 lines) by extracting GitHub, breathing, reminder, and admin routes into `server/routes/` modules.
- **v1.7.2 Build 2 Auth Screen Redesign (Feb 2026)**: Removed circular logo, restructured to fixed flex layout with RETUNED wordmark (Outfit_500Medium) at top and login card at bottom. Unified sign-in button heights to 48px.
- **v1.7.2 Build 2 Landing Page Typography (Feb 2026)**: Cormorant Garamond (serif) for h1/h2, Outfit (sans-serif) for h3/h4/body/UI. Nav branding: Outfit 500, 17px, 4.5px letter-spacing.
- **v1.7.2 Build 2 Font Cleanup (Feb 2026)**: Removed Poppins, Montserrat, Space Grotesk. App loads only Nunito (primary) + Outfit (brand/auth).

## User Preferences
- Preferred communication style: Simple, everyday language.
- Design approach: Conservative, iterative improvements over major redesigns.
- UI naming conventions: "AI-Powered" vs "Write Your Own", "Set your intention", "Write My Affirmation", "NOTIFICATIONS", "Inner Voice".
- Gold gradient styling: #E5C95C to #C9A227 (light), #C9A227 to #8A6D1A (dark).
- Button states on gold: Active = white semi-transparent bg (0.85), Inactive = frosted white bg (0.2) with white text.
- Pill buttons: Fixed height of 36px for visual consistency.
- Auth button height: Fixed 48px for Apple and Google sign-in buttons.

## System Architecture

### Core Technologies
- **Frontend**: React Native with Expo SDK 54 (iOS, Android, web).
- **Backend**: Express 5 (Node.js). Routes modularized: `server/routes.ts` (core 51 endpoints) + `server/routes/` modules (github, breathing, reminders, admin — 34 endpoints).
- **Database**: PostgreSQL with Drizzle ORM.
- **State Management**: TanStack Query.
- **Styling**: Custom theme with light/dark mode. Nunito font family (primary), Outfit (brand/auth screen). Landing pages use Cormorant Garamond + Outfit.
- **Animations**: React Native Reanimated.
- **Audio**: `expo-av` for recording and playback.

### UI/UX Decisions
The application follows a "Serene Empowerment" aesthetic, utilizing Primary Gold and Navy colors, Nunito typography, and custom components like `GoldShimmer` and `BreathingPulse`. It features a 2-tab navigation structure (Breathe, Believe) with a central "Create" button, and integrates haptic feedback and custom screen transitions for an enhanced user experience.

### Technical Implementations
- **Personalized Affirmations**: AI generates scripts incorporating Subconscious Language Patterns, organized by 5 Life Pillars (Mind, Body, Spirit, Connection, Achievement), each with distinct Text-to-Speech (TTS) treatments for optimal delivery.
- **Voice Management**: A hybrid TTS system uses Hume AI for stock voices, ElevenLabs for cloned voices (Inner Voice), and OpenAI as a fallback. An automated voice rotation system manages inactive ElevenLabs cloned voices. Journey voice consistency ensures a single voice is used across all journey steps. Inner Voice affirmations use fixed Spirit pillar TTS settings (stability 0.6, style 0.25, 1.8s pause) for consistent, contemplative delivery regardless of pillar. AI Voice affirmations use pillar-specific Hume speed/pause configs. **Note**: Cartesia integration code is preserved in `server/cartesia-tts.ts` but is fully disabled — no Cartesia API calls are made during normal operation. The `ttsProvider` field in the users table and admin provider-switch endpoint exist but are inactive. Cartesia can be re-enabled for A/B testing at a later date.
- **Global Audio Player**: Ensures consistent audio playback across the application.
- **RSVP Mode**: Displays word-synced text for visual reinforcement during affirmations. Uses 200ms forward offset (scaled by playback speed), 50ms audio progress updates, ORP (Optimal Recognition Point) character highlighting, and XL font size. ElevenLabs word timings use re-encoded ffmpeg segments for sample-accurate sync. Full configuration reference: `docs/voice-cloning/10-tts-rsvp-reference.md`.
- **Breathing Mode**: Offers science-backed techniques with animated visualizations, customizable durations, and ambient soundscapes, including mood-matched recommendations. Controls (Duration/Audio) are grouped in a themed card with technique-colored border and subtle shadow.
- **AI Mood Check-in**: An ephemeral system that analyzes user mood to recommend personalized wellness paths: breathing, meditating, or listening/creating affirmations, utilizing multi-layer scoring for smart affirmation matching.
- **Mood Journey Personalization**: Tracks journey completions and feeds this history into AI daily greetings and mood check-in prompts for deeper personalization. Ambient sounds persist seamlessly across step transitions.
- **Micro-Meditations**: Ephemeral, AI-generated guided meditations tailored to current mood and available in varying durations.
- **AI Daily Greetings**: Context-aware, personalized messages based on user activity.
- **User Analytics**: Tracks listening sessions, streaks, and category breakdowns.
- **Sound Library**: A collection of 25 seamless ambient sound loops across 7 categories.
- **Authentication**: Session-based for web, token-based for mobile.
- **Daily Reminders**: A flexible notification system for breathing or affirmation sessions, with AI-generated messages.
- **Voice Clone Expiry Warnings**: Server-side push notifications warn users at ~53 and ~58 days of voice inactivity before the 60-day rotation. Users can tap to keep their voice active via a lightweight `/api/voice/keep-active` endpoint. Push tokens stored in `push_tokens` table, sent via Expo push notification service (`expo-server-sdk`).
- **Security & Privacy**: Features explicit voice consent, immediate deletion of voice recordings post-cloning, usage limits, rate limiting, and GDPR-compliant data deletion.
- **First-Time User Experience (FTUE)**: Includes onboarding, deferred voice setup, first-play celebrations, and contextual hints.
- **Server Resilience (v1.7.2)**: Structured JSON logging (level/timestamp/component), process-level crash handlers (uncaughtException/unhandledRejection), try/catch isolation around each startup subsystem so partial failures don't crash the server, `/api/health` endpoint for monitoring (checks server + DB), client-side API error logging with HTML-detection for misconfiguration alerts, and API catch-all for unknown endpoints returning proper JSON.

## External Dependencies

### AI Services
- **OpenAI API**: Affirmation script generation, micro-meditation script generation, daily greeting generation, and TTS fallback.
- **Hume AI API**: Primary TTS for stock AI voices (with word-level timestamps) and micro-meditations.
- **ElevenLabs API**: Voice cloning and TTS for personal cloned voices.
- **Cartesia API**: *Currently disabled*. Code preserved in `server/cartesia-tts.ts` for future A/B testing. Uses Sonic-3 model, embedding-based cloning (3-second samples), no slot limits.

### Database
- **PostgreSQL**: Primary database for application data.

### Key npm Packages
- `expo-av`, `expo-file-system`, `drizzle-orm`, `pg`, `multer`, `elevenlabs`, `hume`, `@cartesia/cartesia-js`, `@tanstack/react-query`, `expo-linear-gradient`, `@expo-google-fonts/outfit`.

### Environment Variables
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `HUME_API_KEY`
- `REPLIT_CONNECTORS_HOSTNAME`
- `EXPO_PUBLIC_DOMAIN`
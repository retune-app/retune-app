# Retuned

## Overview
Retuned is an application designed to help users reprogram their subconscious minds through personalized audio affirmations. It leverages AI to generate affirmation scripts based on user goals, which can then be played in the user's cloned voice or a selection of curated AI voices. The project aims to provide a powerful tool for personal growth and mental well-being, focusing on subconscious language patterns to maximize effectiveness. Key features include voice cloning, guided breathing exercises, AI-powered mood check-ins with personalized wellness paths, micro-meditations, and a comprehensive ambient sound library.

## User Preferences
- Preferred communication style: Simple, everyday language.
- Design approach: Conservative, iterative improvements over major redesigns.
- UI naming conventions: "AI-Powered" vs "Write Your Own", "Set your intention", "Write My Affirmation", "NOTIFICATIONS", "Inner Voice".
- Gold gradient styling: #E5C95C to #C9A227 (light), #C9A227 to #8A6D1A (dark).
- Button states on gold: Active = white semi-transparent bg (0.85), Inactive = frosted white bg (0.2) with white text.
- Pill buttons: Fixed height of 36px for visual consistency.
- Brand logo: "Resonance Rings" — concentric gold rings with gold core. Light version (grey bg) is primary, dark version (navy bg) for dark mode. See `docs/rebrand.md` for full details.
- Landing page fonts: Instrument Serif (headlines), DM Sans (body), Nunito (accents). In-app font: Nunito (unchanged).

## System Architecture

### Core Technologies
- **Frontend**: React Native with Expo SDK 54 (iOS, Android, web).
- **Backend**: Express 5 (Node.js).
- **Database**: PostgreSQL with Drizzle ORM.
- **State Management**: TanStack Query.
- **Styling**: Custom theme with light/dark mode and Nunito font family.
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
- `expo-av`, `expo-file-system`, `drizzle-orm`, `pg`, `multer`, `elevenlabs`, `hume`, `@cartesia/cartesia-js`, `@tanstack/react-query`, `expo-linear-gradient`.

### Environment Variables
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `HUME_API_KEY`
- `REPLIT_CONNECTORS_HOSTNAME`
- `EXPO_PUBLIC_DOMAIN`
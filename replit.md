# Retuned

## Overview
Retuned is an application designed to help users reprogram their subconscious minds through personalized audio affirmations. It leverages AI to generate affirmation scripts based on user goals, which can then be played in the user's cloned voice or a selection of curated AI voices. The project aims to provide a powerful tool for personal growth and mental well-being, focusing on subconscious language patterns to maximize effectiveness. Key features include voice cloning, guided breathing exercises, AI-powered mood check-ins with personalized wellness paths, micro-meditations, and a comprehensive ambient sound library.

## Recent Changes (v1.6 Build 2 — February 14, 2026)
- **Alternate Nostril Breathing (Nadi Shodhana)**: New breathing technique with 4-phase cycle (inhale left → exhale right → inhale right → exhale left, 4s each = 16s cycle). Uses optional `instruction` field on phases to show nostril-specific guidance in BreathingCircle. Teal color (#4ECDC4). Added to breathing wisdom endpoint validation, fallback tips, technique descriptions, and mood journey mappings (anxious→focused, overwhelmed→focused).
- **Blue Recommendation Glow**: "Listen again" nudge now picks a different affirmation (not last-played) and highlights it with a blue glow (#4A9EDE) in the library. Gold glow remains for last-played. Separate `recommendedAffirmationId` state in AudioContext. Falls back to gold highlight on current affirmation if only one exists.
- **Breathing Wisdom Timing**: Added 25-second minimum interval (`MIN_BETWEEN_TIPS_MS`) between wisdom tips to prevent spam on fast techniques like 2-1 (3s cycles). Both cycle count (>=2) and time gap must be met.
- **Return-to-App Welcome Back**: Tracks last app open via AsyncStorage. When user returns after 4+ hours, passes `hoursAway` to `/api/daily-greeting` which generates a time-gap-aware AI message (e.g., referencing their streak or encouraging their return). Cache key separates welcome-back from regular greetings. Query staleTime set to 0 for welcome-back to always fetch fresh. AppState listener invalidates greeting cache on foreground return.
- **Library Hints Frequency**: Swipe tip and first-play hint auto-hide after 3 library visits (AsyncStorage view counts). Swipe tip moved to FlatList ListFooterComponent.
- **Tilt-to-Immersive Hint**: During mood journey affirmation playback, a recurring tilt hint fades in/out every ~15s in portrait mode, nudging users to rotate their phone for fullscreen RSVP. Stops after 4 shows or once the user enters landscape/fullscreen. Uses Reanimated withSequence for smooth fade. Positioned between visualizer and track info with a subtle pill-shaped background.

## Previous Changes (v1.6 Build 1 — February 13, 2026)
- **Breathing Wisdom**: AI-generated science-based wisdom tips during breathing sessions (standalone and mood journey). Factual, encouraging tone. Tips appear after 10s + 1 completed cycle, display 3 lines, fade in/out subtly. API: `GET /api/breathing-wisdom?techniqueId={id}` with 24h in-memory cache and hardcoded fallbacks.
- **Breathing Timer Fix**: Moved handleStop to separate useEffect watching elapsedTime (prevents stale closures). Timer increments even at completion so useEffect triggers properly (fixes freeze at 1 second remaining).
- **Portrait Breathing Circle**: Now purely decorative (no functional breathing). All breathing happens in fullscreen only.
- **Duration Default**: Defaults to 60s on app load and resets to 60s after every breathing session completes.
- **Journey Breathing Wisdom**: Wisdom tips now appear during mood journey breathing steps.
- **Journey Prompt Intelligence**: Rewritten with neuroscience/spirituality knowledge base and 4 rotating acknowledgment angles.
- **Performance**: React.memo on BreathingCircle, useCallback fixes on HomeScreen FlatList handlers, memoized journeyStepLabels, extracted module-level utilities in PlayerScreen.
- **Code Cleanup**: Removed 15+ debug console.log statements, unused imports, and all attached screenshot assets.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- **Voice Management**: A hybrid TTS system uses Hume AI for stock voices and ElevenLabs for cloned voices, with OpenAI as a fallback. An automated voice rotation system manages inactive cloned voices. Journey voice consistency ensures a single voice is used across all journey steps (breathe, meditate, listen): defaults to Inner Voice if user has one, falls back to their AI voice preference from settings. The `JourneyContext` carries `journeyVoiceId` and `journeyVoiceType` to all steps. Server-side affirmation matching adds a +2 score bonus for affirmations matching the user's preferred voice type. PlayerScreen auto-regenerates voice if the affirmation's current voice doesn't match the journey voice preference.
- **Global Audio Player**: Ensures consistent audio playback across the application.
- **RSVP Mode**: Displays word-synced text for visual reinforcement during affirmations.
- **Breathing Mode**: Offers science-backed techniques with animated visualizations, customizable durations, and ambient soundscapes. Includes mood-matched technique recommendations.
- **AI Mood Check-in**: An ephemeral system that analyzes user mood to recommend personalized wellness paths: breathing, meditating, or listening/creating affirmations, utilizing multi-layer scoring for smart affirmation matching. Includes mood memory (last-used moods highlighted with gold border via AsyncStorage) and journey history context in AI-generated acknowledgments.
- **Mood Journey Personalization**: Tracks journey completions in `journeyCompletions` DB table (mood paths, step completion rates, skip rates, duration). Journey history feeds into AI daily greetings and mood check-in prompts for deeper personalization. Ambient sounds persist seamlessly across step transitions (only stop on journey end). Smart transition messages reference the user's specific mood transition. Client records completions via POST `/api/journey-completions`; stats available via GET `/api/journey-stats`.
- **Micro-Meditations**: Ephemeral, AI-generated guided meditations tailored to current mood and available in varying durations. These use mood-specific voice delivery configurations and include word-by-word RSVP display.
- **AI Daily Greetings**: Context-aware, personalized messages based on user activity, providing encouragement and smart nudges for feature engagement.
- **User Analytics**: Tracks listening sessions, streaks, and category breakdowns.
- **Sound Library**: A collection of 25 seamless ambient sound loops across 7 categories.
- **Authentication**: Session-based for web, token-based for mobile.
- **Daily Reminders**: A flexible notification system for breathing or affirmation sessions, with AI-generated messages.
- **Security & Privacy**: Features explicit voice consent, immediate deletion of voice recordings post-cloning, usage limits, rate limiting, and GDPR-compliant data deletion.
- **First-Time User Experience (FTUE)**: Includes onboarding, deferred voice setup, first-play celebrations, and contextual hints.

## External Dependencies

### AI Services
- **OpenAI API**: Affirmation script generation, micro-meditation script generation, daily greeting generation, and TTS fallback.
- **Hume AI API**: Primary TTS for stock AI voices (with word-level timestamps) and micro-meditations.
- **ElevenLabs API**: Voice cloning and TTS for personal cloned voices.

### Database
- **PostgreSQL**: Primary database for application data.

### Key npm Packages
- `expo-av`, `expo-file-system`, `drizzle-orm`, `pg`, `multer`, `elevenlabs`, `hume`, `@tanstack/react-query`, `expo-linear-gradient`.

### Environment Variables
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `HUME_API_KEY`
- `REPLIT_CONNECTORS_HOSTNAME`
- `EXPO_PUBLIC_DOMAIN`
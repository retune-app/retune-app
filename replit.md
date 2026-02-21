# Retuned

## Overview
Retuned is an application designed to help users reprogram their subconscious minds through personalized audio affirmations. It leverages AI to generate affirmation scripts based on user goals, which can then be played in the user's cloned voice or a selection of curated AI voices. The project aims to provide a powerful tool for personal growth and mental well-being, focusing on subconscious language patterns to maximize effectiveness. Key capabilities include voice cloning, guided breathing exercises, AI-powered mood check-ins with personalized wellness paths, micro-meditations, and an extensive ambient sound library.

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
- **Backend**: Express 5 (Node.js).
- **Database**: PostgreSQL with Drizzle ORM.
- **State Management**: TanStack Query.
- **Styling**: Custom theme with light/dark mode, Nunito (primary) and Outfit (brand/auth) font families. Landing pages use Cormorant Garamond + Outfit.
- **Animations**: React Native Reanimated.
- **Audio**: `expo-av` for recording and playback.

### UI/UX Decisions
The application employs a "Serene Empowerment" aesthetic, featuring Primary Gold and Navy colors, Nunito typography, and custom components like `GoldShimmer` and `BreathingPulse`. It utilizes a 2-tab navigation structure (Breathe, Believe) with a central "Create" button, and incorporates haptic feedback and custom screen transitions for an enhanced user experience. Icons are updated to a light rings design.

### Technical Implementations
- **Personalized Affirmations**: AI-generated scripts incorporating Subconscious Language Patterns, categorized by 5 Life Pillars (Mind, Body, Spirit, Connection, Achievement), each with distinct Text-to-Speech (TTS) treatments. A two-pass humanizer system refines AI phrasing for natural language.
- **Voice Management**: A hybrid TTS system uses Hume AI for stock voices, ElevenLabs for cloned voices (Inner Voice), and OpenAI as a fallback. An automated rotation system manages inactive ElevenLabs cloned voices, with server-side push notifications warning users of expiry. Journey voice consistency ensures a single voice throughout.
- **Global Audio Player**: Ensures consistent audio playback across the application, with seamless ambient sound persistence during mood journey step transitions.
- **RSVP Mode**: Displays word-synced text for visual reinforcement during affirmations with ORP character highlighting and scaled timings for ElevenLabs.
- **Breathing Mode**: Offers 10 science-backed techniques grouped by goal category and difficulty, with animated visualizations, customizable durations, and ambient soundscapes. Smart sound matching auto-selects ambient sounds based on mood, breathing technique, and time of day.
- **AI Mood Check-in**: An ephemeral system that analyzes user mood across 10 starting moods and 9 target moods to recommend personalized wellness paths (breathing, meditating, affirmations) using a vibe-powered multi-layer scoring engine for affirmation matching and creation theme suggestions.
- **Micro-Meditations**: Ephemeral, AI-generated guided meditations tailored to current mood.
- **AI Daily Greetings**: Context-aware, personalized messages based on user activity and mood journey history.
- **User Analytics**: Tracks listening sessions, streaks, and category breakdowns.
- **Sound Library**: A collection of 25 seamless ambient sound loops across 7 categories.
- **Authentication**: Session-based for web, token-based for mobile. Redesigned auth screens feature a fixed flex layout, wordmark, and unified button heights.
- **Daily Reminders**: A flexible notification system for breathing or affirmation sessions, with AI-generated messages.
- **Security & Privacy**: Explicit voice consent, immediate deletion of voice recordings post-cloning, usage limits, rate limiting, and GDPR-compliant data deletion.
- **First-Time User Experience (FTUE)**: Includes onboarding, deferred voice setup, first-play celebrations, and contextual hints.
- **Server Resilience**: Structured JSON logging, process-level crash handlers, subsystem isolation, `/api/health` endpoint, client-side API error logging, and API catch-all. Server starts accepting connections before database verification, uses connection pooling with timeouts, and provides a friendly user-facing error message during outages.

## External Dependencies

### AI Services
- **OpenAI API**: Affirmation script generation, micro-meditation script generation, daily greeting generation, and TTS fallback.
- **Hume AI API**: Primary TTS for stock AI voices and micro-meditations.
- **ElevenLabs API**: Voice cloning and TTS for personal cloned voices.
- **Cartesia API**: Code preserved in `server/cartesia-tts.ts` but currently disabled.

### Database
- **PostgreSQL**: Primary database for application data.

### Key npm Packages
- `expo-av`, `expo-file-system`, `drizzle-orm`, `pg`, `multer`, `elevenlabs`, `hume`, `@tanstack/react-query`, `expo-linear-gradient`, `@expo-google-fonts/outfit`.

### Environment Variables
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `HUME_API_KEY`
- `REPLIT_CONNECTORS_HOSTNAME`
- `EXPO_PUBLIC_DOMAIN`
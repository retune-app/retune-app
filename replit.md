# Retuned

## Overview
Retuned is an application designed to help users reprogram their subconscious minds through personalized audio affirmations. It leverages AI to generate affirmation scripts based on user goals, which can then be played in the user's cloned voice or a selection of curated AI voices. The project aims to provide a powerful tool for personal growth and mental well-being, focusing on subconscious language patterns to maximize effectiveness. Key features include voice cloning, guided breathing exercises, AI-powered mood check-ins with personalized wellness paths, micro-meditations, and a comprehensive ambient sound library.

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
- **Voice Management**: A hybrid TTS system uses Hume AI for stock voices and ElevenLabs for cloned voices, with OpenAI as a fallback. An automated voice rotation system manages inactive cloned voices. Journey voice consistency ensures a single voice is used across all journey steps.
- **Global Audio Player**: Ensures consistent audio playback across the application.
- **RSVP Mode**: Displays word-synced text for visual reinforcement during affirmations.
- **Breathing Mode**: Offers science-backed techniques with animated visualizations, customizable durations, and ambient soundscapes, including mood-matched recommendations.
- **AI Mood Check-in**: An ephemeral system that analyzes user mood to recommend personalized wellness paths: breathing, meditating, or listening/creating affirmations, utilizing multi-layer scoring for smart affirmation matching.
- **Mood Journey Personalization**: Tracks journey completions and feeds this history into AI daily greetings and mood check-in prompts for deeper personalization. Ambient sounds persist seamlessly across step transitions.
- **Micro-Meditations**: Ephemeral, AI-generated guided meditations tailored to current mood and available in varying durations.
- **AI Daily Greetings**: Context-aware, personalized messages based on user activity.
- **User Analytics**: Tracks listening sessions, streaks, and category breakdowns.
- **Sound Library**: A collection of 25 seamless ambient sound loops across 7 categories.
- **Authentication**: Session-based for web, token-based for mobile.
- **Daily Reminders**: A flexible notification system for breathing or affirmation sessions, with AI-generated messages.
- **Security & Privacy**: Features explicit voice consent, immediate deletion of voice recordings post-cloning, usage limits, rate limiting, and GDPR-compliant data deletion.
- **First-Time User Experience (FTUE)**: Includes onboarding, deferred voice setup, first-play celebrations, and contextual hints.
- **Server Resilience (v1.7.2)**: Structured JSON logging (level/timestamp/component), process-level crash handlers (uncaughtException/unhandledRejection), try/catch isolation around each startup subsystem so partial failures don't crash the server, `/api/health` endpoint for monitoring (checks server + DB), client-side API error logging with HTML-detection for misconfiguration alerts, and API catch-all for unknown endpoints returning proper JSON.

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
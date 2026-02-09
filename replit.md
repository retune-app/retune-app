# Retuned

## Overview
Retuned is a mobile application (React Native/Expo) that enables users to reprogram their subconscious mind using personalized audio affirmations. It achieves this by generating AI-powered affirmation scripts based on user goals and delivering them in the user's own cloned voice. The app aims to offer a blend of therapeutic tranquility and motivational energy with a "Serene Empowerment" aesthetic, serving as an accessible tool for mental well-being and personal growth.

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

### Key Features
- **Personalized Affirmations**: AI generates scripts with Subconscious Language Patterns, optimized for present tense, positive language, sensory imagery, identity-level statements, progressive believability, embedded commands, rhythmic flow, and emotional anchoring. Affirmations are organized by 5 Life Pillars (Mind, Body, Spirit, Connection, Achievement), with optional subcategory and custom tags.
- **Smart TTS Routing**: Hybrid system using Hume AI (Octave 2) for stock AI voices (with word-level timestamps for RSVP) and ElevenLabs for personal cloned voices. OpenAI serves as a fallback.
- **Voice Rotation System**: Automatically cleans up inactive cloned voices (60+ days unused) to free ElevenLabs slots, with a re-cloning prompt for affected users.
- **Audio Pipeline**: Covers user voice sample recording, ElevenLabs cloning, AI script generation, TTS (Hume AI/ElevenLabs), and audio streaming.
- **Global Audio Player**: A single-instance player for consistent playback.
- **RSVP Mode**: Rapid Serial Visual Presentation of affirmation text synchronized with audio.
- **Breathing Mode**: Offers various breathing techniques (Box, 4-7-8, Coherent, Energizing) with animated visuals, duration selection, binaural beats. Each technique has a subtle info icon that opens a detailed modal with description, science tip, and benefits list with icons. Breathe reminders include time-of-day-specific technique recommendations.
- **AI Mood Check-in**: Ephemeral (no data stored) mood-based personalized wellness routing. Users tap one of 6 mood icons (Calm, Stressed, Tired, Energized, Anxious, Grateful) on the Breathe tab. The server queries user context (affirmation library, voice clone status, listening history) and AI generates a warm, non-generic acknowledgment plus personalized notes for 3 pathways: Breathe (mood-matched technique with neuroscience note), Meditate (AI Guided Moment), and Listen/Create. **Smart Affirmation Matching**: Uses multi-layer scoring — tag match (3pts), pillar match (2/1pts), favorite bonus (1pt) — with `MOOD_TAG_PREFERENCES` from `shared/pillars.ts` mapping each mood×timeOfDay to preferred tags and pillars. Example: tired+night prefers Sleep, Healing, Calm, Comfort tags in Body/Home pillars. When no affirmation exists, contextual creation prompts suggest specific themes (e.g. "peaceful sleep and body restoration" for tired+night). Response includes `suggestedTheme` for the Create pathway. Endpoint: `POST /api/mood-checkin` (body: `{mood, timeOfDay}`) returns `{acknowledgment, breathe: {techniqueId, techniqueName, note}, meditate: {note}, listen: {hasAffirmation, affirmationId, affirmationTitle, isInnerVoice, hasClonedVoice, hasAnyAffirmations, note, suggestedTheme}}`.
- **Micro-Meditations**: Ephemeral AI-generated personalized meditation audio with selectable durations (1, 2, or 3 minutes) triggered after mood check-in. Uses OpenAI gpt-4o-mini for script generation with structured mindfulness format (opening, breathing guidance, visualization, affirmation anchoring, closing). Script length scales with duration (~70-75 words/minute for slower meditation pace). Audio generated via Hume AI (Lotus voice, Female Meditation Guide) by default, with ElevenLabs for personal cloned voices (branded as "Inner Voice"). Includes word-by-word RSVP display (font size "S"/24px, standalone punctuation filtered) synchronized with audio inside breathing rings, safety disclaimer, and replay option. RSVP sync uses per-utterance timestamp offset correction (`fixPerUtteranceTimestamps` in `hume-client.ts`) to account for trailing_silence gaps between Hume TTS sentences. Rate limited to 5/day per user. No database storage — fully ephemeral. Component: `client/screens/GuidedMomentScreen.tsx`. Endpoint: `POST /api/guided-moments/generate` (body: `{mood, timeOfDay, duration?, usePersonalVoice?, voiceId?}`). Duration selector: pill-shaped buttons (1/2/3 min) shown above breathing rings, hidden during playback. Fully immersive single-phase experience: mood-matched background music prepared but defaults to OFF (user can enable via sound switcher), concentric breathing rings with mood-themed colors (Calm=teal, Stressed=red, Tired=purple, Energized=amber, Anxious=blue, Grateful=gold) and RSVP words displayed inside the ring center, voice selector (Lotus/Sage/Inner Voice), animated breathing pulse during loading (replaces spinner), sound switcher modal, auto-hiding controls after 3s of playback (tap to reveal), responsive portrait/landscape layout. Status text shows "Breathe and Listen" during playback. Voice preference persisted via AsyncStorage. Server-side performance logging (script time, TTS time, total time) for generation optimization. Duration change mid-generation cancels in-flight request (AbortController) and regenerates with new duration. Server-side early termination on client disconnect prevents wasted API calls.
- **AI Daily Greetings**: Personalized empowering sub-messages generated by OpenAI (gpt-4o-mini), cached daily per user, with time-of-day context and real user stats (streak, total sessions, favorite technique). Max 10 words. Endpoint: `GET /api/daily-greeting?timeOfDay=morning|afternoon|evening|night`.
- **User Analytics**: Tracks listening sessions, streaks, and category breakdowns, including meditation KPIs.
- **Sound Library**: 25-track ambient sound library across 7 categories (Rain, Ocean, Forest & Birds, Meditation, Solfeggio, Binaural, Noise). Nature tracks sourced from Internet Archive (CC0), synthetic tracks generated with ffmpeg/Node.js. All tracks are 60-second seamless loops (meditation: 180 sec) with 2-second crossfade. Meditation category includes: Forest Melody, Morning Mist, Singing Bowls, Gentle Chimes, Deep Drone. Category colors: Rain (#4FC3F7), Ocean (#29B6F6), Forest (#66BB6A), Meditation (#E040FB), Solfeggio (#C9A227), Binaural (#9C27B0), Noise (#78909C). Default sound: forest-rain-birds (Forest Rain).
- **Authentication**: Session-based for web, token-based for mobile.
- **Daily Reminders**: Flexible notification system (max 5 per user) with two activity types: Breathe (meditation) and Believe (affirmations). Each reminder has a custom time and AI-generated notification message via gpt-4o-mini. Dedicated RemindersScreen sub-page accessible from Settings. Unique notification identifiers per reminder for correct scheduling. Auto-migrates from legacy morning/afternoon/evening notification settings. CRUD API: `GET/POST /api/reminders`, `PUT/DELETE /api/reminders/:id`, `POST /api/reminders/:id/regenerate-message`.
- **Voice Selection System**: Allows users to choose AI voices or clone their own, with UI for management and comparison.
- **Security & Privacy**: Explicit voice consent, immediate deletion of voice recording files post-cloning, usage limits (5 voice clones, 20 AI affirmations/month), rate limiting on AI endpoints, and GDPR-compliant "Delete My Data" functionality.
- **First-Time User Experience (FTUE)**: Onboarding slides, default landing on Believe tab, deferred voice setup with a nudge, first-play celebration, and contextual hints/tooltips.
- **Navigation**: 2-tab structure (Breathe, Believe) with a central Create (+) button. Floating settings button. Default landing tab is Breathe for all users (including first-time).
- **UI/UX Design**: "Serene Empowerment" theme with Primary Gold and Navy colors, Nunito typography, and custom components for enhanced experience (e.g., `GoldShimmer`, `BreathingPulse`, `MiniPlayer`). Haptic feedback and custom screen transitions are integrated.

## External Dependencies

### AI Services
- **OpenAI API**: Affirmation script generation and TTS fallback.
- **Hume AI API**: Primary TTS for stock AI voices, providing word-level timestamps.
- **ElevenLabs API**: Voice cloning and TTS for personal cloned voices.

### GitHub Integration
- **Connection**: Replit GitHub connector.
- **Library**: `@octokit/rest`.
- **Service Module**: `server/github.ts` for issue comments, label management, project board updates, and coordination file management.
- **Agent Coordination**: Manages agent status, blockers, priorities, and acknowledgments via files in `.retuned/coordination/` in the GitHub repository.
- **Document Sharing**: System for proposals, decisions, changelogs (`.retuned/docs/`) and inbox messages for agent-team communication (`.retuned/inbox/`) stored in the `retune-app/retune-app` repository.

### Database
- **PostgreSQL**: Primary database.

### Key npm Packages
- `expo-av`, `expo-file-system`, `drizzle-orm`, `pg`, `multer`, `elevenlabs`, `hume`, `@tanstack/react-query`, `expo-linear-gradient`.

### Environment Variables
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `HUME_API_KEY`
- `REPLIT_CONNECTORS_HOSTNAME`
- `EXPO_PUBLIC_DOMAIN`
# Subconscious Rewire

## Overview

Subconscious Rewire is a mobile app (React Native/Expo) that helps users rewire their subconscious mind through personalized audio affirmations. Users describe their goals, AI generates affirmation scripts, and the app uses voice cloning technology to play the affirmations back in the user's own voice. The app follows a "Serene Empowerment" design aesthetic that blends therapeutic tranquility with motivational energy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native + Expo)
- **Framework**: Expo SDK 54 with React Native, targeting iOS, Android, and web
- **Navigation**: React Navigation with native stack and bottom tabs (3 tabs: Library, Create +, Profile)
- **State Management**: TanStack Query for server state and caching
- **Styling**: Custom theme system with light/dark mode support, Nunito font family
- **Animations**: React Native Reanimated for fluid UI animations
- **Audio**: expo-av for recording voice samples and playing affirmations

### Backend (Express + Node.js)
- **API Server**: Express 5 running on port 5000
- **Database**: PostgreSQL with Drizzle ORM for schema management and queries
- **File Uploads**: Multer for handling audio file uploads (voice samples)
- **AI Integration**: OpenAI API for generating affirmation scripts from user goals
- **Voice Cloning**: ElevenLabs API for cloning user voices and text-to-speech synthesis

### Key Data Models
- **Users**: Basic auth with voice sample tracking and cloned voice ID storage
- **Affirmations**: User-created affirmations with title, script text, audio URL, category, and play count
- **Voice Samples**: Uploaded voice recordings used for voice cloning
- **Categories**: Affirmation categories (Career, Health, Confidence, Wealth, Relationships, Sleep)

### API Endpoints
- `GET /api/affirmations` - List all affirmations
- `GET /api/affirmations/:id` - Get single affirmation
- `POST /api/affirmations/generate-script` - Generate AI script from goal
- `POST /api/affirmations/create-with-voice` - Create affirmation with TTS audio
- `PATCH /api/affirmations/:id/favorite` - Toggle favorite status
- `POST /api/voice-samples` - Upload voice sample for cloning
- `GET /api/voice-samples/status` - Check if user has a cloned voice
- `GET /api/user/stats` - Get user statistics

### Audio Pipeline
1. User records 30-60 second voice sample during onboarding
2. Sample uploaded to server and sent to ElevenLabs for voice cloning
3. Cloned voice ID stored in database
4. When creating affirmations, AI generates script from goal description
5. Script synthesized to audio using cloned voice (or default voice)
6. Audio stored and streamed for playback

### Global Audio Player (AudioContext)
- **AudioContext Provider**: Centralized audio state management wrapping the entire app
- **Single-instance playback**: Only one affirmation can play at a time; starting new playback automatically stops previous
- **MiniPlayer**: Floating bar above tab navigation showing current track with play/pause, progress, and tap-to-navigate
- **State sharing**: All screens (HomeScreen, PlayerScreen) share playback state via useAudio hook
- **Key files**: `client/contexts/AudioContext.tsx`, `client/components/MiniPlayer.tsx`

## Screen Structure

- **HomeScreen**: Library of affirmations with search and category filters
- **CreateScreen**: Create new affirmation (AI Generate or Manual mode)
- **PlayerScreen**: Audio player with waveform visualization, playback controls
- **VoiceSetupScreen**: Record voice sample for cloning (fullscreen modal)
- **ProfileScreen**: User settings, stats, voice sample management

## Design System

- **Primary Blue**: #4A90E2
- **Accent Purple**: #7B61FF
- **Success Teal**: #50E3C2
- **Typography**: Nunito font family (Regular, Medium, SemiBold, Bold)
- **Border Radius**: Full rounded buttons and chips, rounded cards

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o for generating affirmation scripts from user goals. Accessed via Replit AI Integrations connector.
- **ElevenLabs API**: Voice cloning (Instant Voice Cloning) and text-to-speech synthesis. Accessed via Replit Connectors for credential management.

### Database
- **PostgreSQL**: Primary database provisioned through Replit. Connection via `DATABASE_URL` environment variable. Schema managed with Drizzle Kit.

### Key npm Packages
- `expo-av`: Audio recording and playback
- `expo-file-system`: File handling for audio uploads
- `drizzle-orm` + `pg`: Database ORM and PostgreSQL driver
- `multer`: Multipart form handling for file uploads
- `elevenlabs`: Official ElevenLabs SDK
- `@tanstack/react-query`: Data fetching and caching
- `expo-linear-gradient`: Gradient backgrounds and buttons

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key via Replit
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: Replit AI proxy URL
- `REPLIT_CONNECTORS_HOSTNAME`: For ElevenLabs credential fetching
- `EXPO_PUBLIC_DOMAIN`: API server domain for mobile client

## Development Commands
- `npm run dev` - Start both frontend and backend
- `npm run server:dev` - Start backend only
- `npm run expo:dev` - Start Expo dev server
- `npm run db:push` - Push schema changes to database

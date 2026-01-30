# Rewired

## Overview

Rewired is a mobile app (React Native/Expo) that helps users rewire their subconscious mind through personalized audio affirmations. Users describe their goals, AI generates affirmation scripts, and the app uses voice cloning technology to play the affirmations back in the user's own voice. The app follows a "Serene Empowerment" design aesthetic that blends therapeutic tranquility with motivational energy.

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
- **Notification Settings**: Daily reminder settings with 3 time slots (morning, afternoon, evening) - each with enabled toggle and customizable time

### Authentication
- **Session-based auth**: Express-session with secure HTTP-only cookies (web)
- **Token-based auth**: Database-backed auth tokens for mobile apps (X-Auth-Token header)
- **Password hashing**: bcrypt with 12 salt rounds
- **Data isolation**: All user data (affirmations, voice samples) is associated with user IDs
- **Frontend AuthContext**: React context for auth state management with login, signup, logout functions
- **Auth tokens table**: `auth_tokens` table stores persistent tokens for mobile auth across server restarts

### API Endpoints

#### Authentication
- `POST /api/auth/signup` - Register new user (expects name, email, password)
- `POST /api/auth/login` - Login user (expects email, password)
- `POST /api/auth/logout` - Logout current user
- `GET /api/auth/me` - Get current authenticated user

#### Affirmations (all require auth)
- `GET /api/affirmations` - List all affirmations
- `GET /api/affirmations/:id` - Get single affirmation
- `POST /api/affirmations/generate-script` - Generate AI script from goal
- `POST /api/affirmations/create-with-voice` - Create affirmation with TTS audio
- `POST /api/affirmations/samples` - Create sample affirmations with default voice (for new users)
- `PATCH /api/affirmations/:id/favorite` - Toggle favorite status
- `PATCH /api/affirmations/:id/rename` - Rename an affirmation (body: { title })
- `DELETE /api/affirmations/:id` - Delete an affirmation
- `POST /api/voice-samples` - Upload voice sample for cloning
- `GET /api/voice-samples/status` - Check if user has a cloned voice
- `GET /api/user/stats` - Get user statistics

#### User Data Management (all require auth)
- `POST /api/user/reset` - Reset all user data (affirmations, voice samples, cloned voice) while keeping account
- `POST /api/user/account/delete` - Permanently delete user account and all associated data

#### Notification Settings (all require auth)
- `GET /api/notifications/settings` - Get current notification reminder settings
- `PUT /api/notifications/settings` - Update notification settings (morningEnabled, morningTime, afternoonEnabled, afternoonTime, eveningEnabled, eveningTime)

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

### RSVP Mode (Rapid Serial Visual Presentation)
- **Word-by-word display**: Shows one word at a time synchronized with audio playback
- **Word timings from ElevenLabs**: Uses `/with-timestamps` endpoint to get character-level timing, parsed into word-level data
- **Fallback timing**: For legacy affirmations without timestamps, generates approximate timing based on word length
- **ORP highlighting**: Optional highlighting of Optimal Recognition Point (center letter of each word)
- **Customizable settings**: Font size (S/M/L/XL), highlight toggle, RSVP on/off - all persisted to AsyncStorage
- **Key files**: `client/components/RSVPDisplay.tsx`, `server/replit_integrations/elevenlabs/client.ts`

## Screen Structure

- **HomeScreen**: Library of affirmations with search and category filters
- **CreateScreen**: Create new affirmation (AI Generate or Manual mode)
- **PlayerScreen**: Audio player with waveform visualization, playback controls, and RSVP mode for synchronized word display
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

### API URL Configuration
The frontend uses `getApiUrl()` from `client/lib/query-client.ts` to determine the backend URL:
- **Web on localhost**: Uses `http://localhost:5000` directly
- **Web on Replit domain**: Uses `https://domain.replit.dev:5000` (port 5000 explicitly)
- **Native apps (iOS/Android)**: Uses `https://domain.replit.dev:5000`

This is necessary because Replit's port configuration maps port 80 to the Expo dev server (8081), while port 5000 routes to the Express backend.

### Default Voice for New Users
- Users can skip voice setup and immediately use sample affirmations
- Default ElevenLabs voice: "Rachel" (voiceId: 21m00Tcm4TlvDq8ikWAM)
- POST /api/affirmations/samples creates 3 starter affirmations:
  - "Morning Confidence" (Confidence category)
  - "Abundance Mindset" (Wealth category)
  - "Inner Peace" (Health category)

## Development Commands
- `npm run dev` - Start both frontend and backend
- `npm run server:dev` - Start backend only
- `npm run expo:dev` - Start Expo dev server
- `npm run db:push` - Push schema changes to database

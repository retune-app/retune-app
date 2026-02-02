# InnerTune

## Overview
InnerTune is a mobile application (React Native/Expo) designed to help users reprogram their subconscious mind through personalized audio affirmations. Users define their goals, and an AI generates affirmation scripts. The app then utilizes voice cloning technology to play these affirmations back in the user's own voice. The project aims to blend therapeutic tranquility with motivational energy, offering a "Serene Empowerment" aesthetic. The business vision is to provide an accessible and personalized tool for mental well-being and personal growth.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Technologies
- **Frontend**: React Native with Expo SDK 54, targeting iOS, Android, and web.
- **Backend**: Express 5 (Node.js) server.
- **Database**: PostgreSQL with Drizzle ORM.
- **State Management**: TanStack Query for server state and caching.
- **Styling**: Custom theme system with light/dark mode and Nunito font family.
- **Animations**: React Native Reanimated for fluid UI.
- **Audio**: `expo-av` for recording and playback.

### Key Features
- **Personalized Affirmations**: Users input goals, AI generates scripts, and voice cloning plays them in the user's voice.
- **Audio Pipeline**: Involves user voice sample recording, ElevenLabs voice cloning, AI script generation, text-to-speech synthesis, and audio streaming.
- **Global Audio Player**: A single-instance audio player for consistent playback control across the app.
- **RSVP Mode**: Rapid Serial Visual Presentation of affirmation text, synchronized with audio playback, using word timing data from ElevenLabs.
- **Breathing Mode**: A dedicated feature offering various breathing techniques (Box, 4-7-8, Coherent) with animated visuals, duration selection, and binaural beats integration.
- **User Analytics**: Tracks listening sessions, streaks, and category breakdowns to provide insights into user progress. Includes meditation KPIs (breathing streaks, mindful minutes, technique breakdown, weekly breathing charts).
- **Sound Library**: Dedicated screen for browsing ambient sounds categorized into Nature, Solfeggio, and Binaural categories with auto-play on selection.
- **Authentication**: Session-based for web, token-based for mobile, secured with bcrypt and data isolation.
- **Notification Settings**: Customizable daily reminder settings for affirmations.
- **Voice Selection System**: Users can choose from various AI voices or clone their own voice, with preferences stored and manageable through a dedicated UI.

### Navigation Structure
- **2-Tab Navigation**: Breathe (left), Affirm (right) with middle Create (+) button
- **Settings Access**: Floating settings button (gear icon) on Breathe and Affirm screens, positioned bottom-right above tab bar
- **Affirmation Selection**: Swipe left on affirmation cards to "Set for Breathing" - persisted in AsyncStorage with key `@breathing/selectedAffirmation`
- **Breathing Priority**: Selected breathing affirmation takes precedence over time-based suggestions

### UI/UX Design
- **Theme**: "Serene Empowerment" with a color palette of Primary Gold (#C9A227) and Navy backgrounds (#0F1C3F, #1A2D4F, #243656).
- **Color Hierarchy**: Gold (#C9A227) for breathing metrics, Purple (#9C27B0) for affirmation metrics.
- **Typography**: Nunito font family.
- **Components**: Includes `GoldShimmer`, `BreathingPulse`, `GradientCard`, `WelcomeSection`, `AmbientSoundMixer`, `ProgressVisualization`, `FloatingSettingsButton`, `SwipeableAffirmationCard`, and `MiniPlayer` for enhanced user experience.
- **Mini Player**: Compact pill-shaped design with blur effect, waveform indicator when playing, positioned 94px + insets.bottom from screen bottom.
- **Haptic Feedback**: Integrated for key interactions and milestones.
- **Screen Transitions**: Default fade for iOS, fade_from_bottom for Android, slide_from_bottom for modals.
- **Background Wallpaper**: Optional meditation-themed background images (disabled by default). Stored in AsyncStorage with key `@settings/backgroundWallpaper`. When enabled, shows `library-background.png` (dark) or `library-background-light.png` (light). When disabled, uses solid colors: #0F1C3F (dark) or #F8FAFB (light).

## External Dependencies

### AI Services
- **OpenAI API**: Used for generating affirmation scripts.
- **ElevenLabs API**: Used for voice cloning (Instant Voice Cloning) and text-to-speech synthesis.

### Database
- **PostgreSQL**: The primary database, managed with Drizzle ORM.

### Key npm Packages
- `expo-av`: Audio recording and playback.
- `expo-file-system`: File handling.
- `drizzle-orm` + `pg`: Database ORM and driver.
- `multer`: Multipart form data handling.
- `elevenlabs`: Official ElevenLabs SDK.
- `@tanstack/react-query`: Data fetching and caching.
- `expo-linear-gradient`: Gradient backgrounds.

### Environment Variables
- `DATABASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `REPLIT_CONNECTORS_HOSTNAME`
- `EXPO_PUBLIC_DOMAIN`
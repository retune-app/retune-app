# RETUNED Changelog

## February 7, 2026

### First-Time User Experience (FTUE)
- Added 3-screen animated onboarding flow (Breathe, Believe, Become) shown only on first login, with pulsing icons, dot indicators, and skip/next/get-started buttons. Tracked via AsyncStorage `@onboarding/completed`.
- New users now land on the Believe tab (affirmations) instead of Breathe, so they see content immediately. Tracked via AsyncStorage `@navigation/firstTabVisit`.
- Replaced auto-triggered voice cloning prompt with a dismissible gold-accented nudge card ("Hear these in your voice") on the Believe tab header. Tracked via AsyncStorage `@nudge/voiceCloneDismissed`.
- First-ever affirmation play now triggers a celebratory haptic success notification. Tracked via AsyncStorage `@play/firstPlay`.
- Added "Tap the play button to hear your first affirmation" hint for new users who haven't played yet.
- Added swipe tooltip (LibraryTip) showing swipe gestures (delete left, breathing/rename right) with animated icons. Tracked via AsyncStorage `@tips/librarySwipe`.
- Server now seeds 6 sample affirmations across all 5 life pillars on first login/signup so new users have content immediately.

### Voice Cloning & Recording
- Redesigned VoiceSetupScreen with a unified record button featuring an integrated progress ring and milestone indicators.
- Improved voice cloning error messages: ElevenLabs API errors are now parsed and returned as user-friendly messages for duration issues, rate limiting, and service unavailability.
- Updated voice clone rate limit to 6 attempts per hour (more forgiving), and failed attempts no longer consume user retries.
- Improved error display for voice upload failures: JSON error responses are parsed for cleaner messages with fallback to raw text or a default message.

### AI Affirmation Generation
- Enhanced AI prompt with Subconscious Language Patterns (SLP) for greater psychological effectiveness: present tense framing, positive-only language, sensory-rich imagery, identity-level statements, progressive believability, embedded commands, rhythmic flow, and emotional anchoring.
- Increased token limits to support longer, more detailed affirmation scripts.
- Improved error handling: server-side error messages (e.g., "Monthly AI affirmation limit reached") now surface to the user instead of showing generic failure messages.

### Create Screen
- Refactored into a guided step-by-step workflow with animated transitions.
- Added dynamic placeholder examples that update based on selected pillar and subcategory tags (e.g., selecting "Sleep" shows sleep-specific prompt examples).
- Script box height now dynamically adjusts based on affirmation length (short/medium/long).
- Added animated script generation experience with glowing, scaling, and fading effects on the script card, plus a delayed animation for the "Create" button.
- Keyboard now automatically hides when a script is generated.

### Breathing Screen
- Portrait-locked on main view; orientation unlocks only when entering focus mode via the expand button.
- Improved visual design of breathing controls: gold borders on secondary buttons, adjusted background colors for selected states, updated start/play button sizes and border radius.

### Audio & Voices
- Removed legacy AI voices (Rachel, Charlotte, Antoni).
- Set Bella (female, `hpp4J3VqNfWAUOO0d1Us`) and Daniel (male, `onwK4e9ZLuTAKqWW03F9`) as defaults for all new users.
- Applied exponential volume curve (x cubed) for background music, providing finer control at quiet levels.
- Set forest sound at 50% volume as the default ambient sound for new users.

### Authentication & Security
- Improved web login persistence with updated cookie settings for cross-environment compatibility.
- Enhanced `/api/auth/me` endpoint to support token-based authentication alongside sessions.
- Fixed rate limiting errors caused by proxy headers by adding `validate: false` to bypass X-Forwarded-For header validation.
- Increased monthly AI affirmation generation limit to 20 per month for regular users.
- Admin account now has unlimited generations and voice clones.

### GitHub Integration
- Added GitHub integration via Replit connector for project management automation.
- Created `server/github.ts` service module with functions for issue comments, label management, and project board card updates.
- New API endpoints:
  - `GET /api/github/repos` — list repositories
  - `GET /api/github/issues/:owner/:repo` — get assigned issues
  - `POST .../comment` — post status comments on issues
  - `POST .../label` — set status labels (in-progress, blocked, completed) with auto-creation and color coding
  - `POST .../status` — combined endpoint: sets label + posts comment + optionally moves project board card
  - `POST /api/github/project/:owner/:projectNumber/move` — move project board cards via GraphQL API
- Labels auto-created with colors: in-progress (yellow), blocked (red), completed (green).
- Status comments include emoji prefixes for visual scanning.
- Project board updates use GitHub Projects V2 GraphQL API, supporting both user and org projects.

### Code Cleanup & Maintenance
- Removed ~15 unnecessary `console.log` statements from server routes.
- Deleted unused imports (`runOnJS`, `Dimensions`) from client code.
- Removed dead code (unused version constants in `BackgroundMusicContext`).
- Deleted 60 conversation screenshot files (24MB) from `attached_assets/` folder.
- Deleted leftover `uploads/test.txt` test file.

### Files Changed
- `client/screens/VoiceSetupScreen.tsx` - Unified record button with progress ring
- `client/screens/CreateScreen.tsx` - Step-by-step workflow, dynamic placeholders, animations
- `client/screens/BreathingScreen.tsx` - Portrait lock, visual design improvements
- `client/screens/PlayerScreen.tsx` - Audio voice updates
- `client/screens/OnboardingScreen.tsx` - New onboarding flow
- `client/screens/HomeScreen.tsx` - FTUE nudge card, first-play celebration, tap hint
- `client/contexts/AuthContext.tsx` - Sample affirmation seeding, web auth improvements
- `client/contexts/BackgroundMusicContext.tsx` - Exponential volume curve, default settings
- `client/navigation/MainTabNavigator.tsx` - Default tab for new users
- `client/lib/auth-token.ts` - Token-based auth support
- `server/routes.ts` - Voice cloning errors, rate limiting, sample affirmations, console.log cleanup
- `server/elevenlabs.ts` - Parsed error details from ElevenLabs API
- `replit.md` - Updated documentation for all new features

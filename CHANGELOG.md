# RETUNED Changelog

## Version 1.5 (Build 1) — February 9, 2026

### Breathing Screen Layout Overhaul
- Restructured fullscreen breathing UI with a clear visual hierarchy: top bar (technique badge, audio controls, close button), centered breathing rings, and bottom control area.
- Moved play/pause button to the true center-bottom of the screen using absolute positioning, ensuring it never shifts off-center regardless of other elements.
- Stop button positioned to the right of the play/pause button, out of the way but easily accessible.
- Replaced rigid transition animations with organic spring-based physics (damping: 20, stiffness: 60) for smoother fullscreen modal entrance/exit.

### Always-Visible Audio Controls
- Music and voice audio buttons now always appear in the top bar during breathing sessions, even when no sound or voice is active.
- When not enabled for the session, buttons appear dimmed (40% opacity) and are disabled to prevent accidental taps.
- Fixed z-index layering so breathing rings no longer overlap the top bar controls (center section z-index: 1, top controls z-index: 10).

### Meditation Landscape Controls
- In landscape mode on the Guided Moment (meditation) screen, the play/pause button now appears in the top-right control bar alongside voice selector, music, and close buttons.
- Bottom-center play/pause button hidden in landscape to avoid duplication and keep the breathing rings clean.
- Portrait mode retains the bottom-center play/pause button as before.

### Haptic Feedback Cleanup
- Removed in-session haptic toggle button from the breathing screen; haptic preference now reads from global Settings via AsyncStorage (`@settings/hapticFeedback`).

### Code Cleanup
- Cleaned up ~100+ lines of dead code from BreathingScreen.tsx (removed unused playing-state branches, duplicate progress ring, 12 unused styles).
- Deleted all conversation screenshots from attached_assets/.
- Version bumped to 1.5 Build 1.

### Files Changed
- `client/screens/BreathingScreen.tsx` — Fullscreen layout overhaul, audio button visibility, z-index fixes, play/pause centering
- `client/screens/GuidedMomentScreen.tsx` — Landscape play/pause button in top-right controls
- `app.json` — Version bump to 1.5
- `CHANGELOG.md` — Comprehensive change documentation
- `replit.md` — Updated documentation

---

## Version 1.3 (Build 3) — February 8, 2026

### Technique Info Modal
- Added a subtle info icon (circle with "i") positioned to the upper-right of the breathing circle.
- Tapping the icon opens a polished modal showing the selected technique's full details: name, breathing pattern, description, science-backed explanation, and a list of specific benefits — each with its own icon.
- Added `detailedBenefits` data to all 4 breathing techniques (Box, 4-7-8, Coherent, Energizing) with unique Feather icons per benefit.
- Removed inline science tips from the technique selector menu — that info now lives in the dedicated modal for a cleaner picker experience.
- Info icon only appears when a session is not active, uses technique color at subtle opacity.

### Personalized AI Daily Greetings
- Daily greeting endpoint now queries the user's real stats from the database: current streak, total breathing sessions, and favorite technique.
- Stats are passed as context to the AI prompt so each greeting feels genuinely personal (e.g., referencing a user's streak or preferred practice).
- AI prompt now enforces a strict 10-word maximum, single sentence, no exclamation marks — preventing long messages that push the breathing circle off-screen.
- Reduced OpenAI max_tokens from 50 to 30 to enforce brevity.

### Compact Welcome Banner
- Reduced greeting title font from h2 heading to 16px bold body text.
- Reduced sub-message font to 13px small text.
- Reduced time-of-day icon from 20px to 16px.
- Tightened banner padding (vertical and horizontal) and reduced internal spacing between title and sub-message.
- Breathing circle — the main feature — is now fully visible without scrolling on all screen sizes.

### Energizing Breath Technique
- Added new quick 2-1 breathing pattern (2s inhale, 1s exhale) for energy and alertness.
- Coral red color (#E85D5D), zap icon, with science tip and detailed benefits.
- Integrated into analytics screen for session tracking.

### Sound Library UX Redesign
- Replaced volume bar with native slider control for more precise volume adjustment.
- Tap any sound row to preview it (5-second auto-play with auto-stop).
- Enlarged radio button (28x28) is now the only selection method for choosing sounds.
- Marked Meditation category as "Coming Soon" in the Sound Library.

### Audio Ducking System
- Background music automatically reduces to 40% of set volume when voice affirmation plays during breathing sessions.
- Volume restores smoothly when voice stops or session ends.

### Breathing Screen Improvements
- Added volume slider to portrait breathing screen (positioned below play/stop buttons, subtle white styling, only visible when music/voice is enabled).
- Moved X close button higher on screen (closer to top of safe area) for better accessibility.

### RSVP Focus Mode
- Adjusted all RSVP font sizes for better fit in portrait mode (S: 24, M: 32, L: 40, XL: 52).
- Added larger landscape-only font size (72px) for immersive fullscreen focus mode.
- Default font size for new users is Medium (M).

### Player Screen
- Reduced affirmation title font size for better visual balance.
- Added extra top spacing to RSVP/visualizer area so content doesn't feel cramped near the header.

### Code Cleanup
- Removed conversation screenshots and unnecessary files from attached_assets/.
- Removed debug console.log statements from client code.
- Version bumped to 1.3 Build 3.

---

## Version 1.3 (Build 2) — February 7, 2026

### Agent Coordination System
- Built a real-time coordination system for multi-agent collaboration via GitHub repo (`retune-app/retune-app`).
- Coordination data stored in `.retuned/coordination/` folder as JSON files with automatic Git commits for full audit trail.
- **Status tracking**: Agents update their current work, status (idle/in_progress/completed), estimated completion time, and blockers.
- **Priority management**: Team lead sets daily priorities in `priorities.json`; agents check and acknowledge them.
- **Blocker flagging**: Agents can flag blockers immediately so the team can unblock them.
- New API endpoints (all require authentication):
  - `POST /api/github/coordination/:owner/:repo/init` — Initialize coordination folder
  - `GET /api/github/coordination/:owner/:repo/status` — Get current agent status
  - `POST /api/github/coordination/:owner/:repo/status` — Update agent status
  - `POST /api/github/coordination/:owner/:repo/blocker` — Flag a blocker
  - `GET /api/github/coordination/:owner/:repo/priorities` — Get daily priorities
  - `POST /api/github/coordination/:owner/:repo/acknowledge` — Acknowledge priorities
- Helper functions in `server/github.ts`: `getFileContent`, `createOrUpdateFile` for reading/writing GitHub repo files via API.

### GitHub Issue Management (v1.2 carry-forward)
- 6 API endpoints for managing GitHub issues: list repos, get assigned issues, post comments, set status labels, move project board cards, and combined status updates.
- Auto-created color-coded labels: in-progress (yellow), blocked (red), completed (green).
- Status comments include emoji prefixes for visual scanning.
- Project board updates via GitHub Projects V2 GraphQL API.

### Code Cleanup (v1.3)
- Removed 13 debug `console.log` statements from `server/routes.ts` (generation logging) and `client/contexts/AuthContext.tsx` (auth debugging).
- Retained security-related logs (path traversal blocking, secure file deletion, privacy compliance).
- Deleted 24MB of conversation screenshots from `attached_assets/`.
- Removed leftover test files.

---

## Version 1.2 (Build 1) — February 7, 2026

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
- `server/github.ts` - GitHub integration service module
- `replit.md` - Updated documentation for all new features
- `CHANGELOG.md` - Comprehensive change documentation

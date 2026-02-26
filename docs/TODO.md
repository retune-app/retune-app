# Retuned — Performance & Uptime To-Do List

## Priority 1: Database Indexes

Missing indexes on frequently queried columns. Every query filtering by `user_id` on core tables is currently doing a full table scan. Safe to add at any time — no downtime required.

- [ ] `affirmations.user_id` — Most critical. Every library load, playback, and management query filters on this.
- [ ] `affirmations(user_id, is_favorite)` — Compound index for favorites view filtering.
- [ ] `listening_sessions(user_id, date_key)` — Analytics and streak calculations.
- [ ] `breathing_sessions(user_id, date_key)` — Daily goal tracking.
- [ ] `journey_completions(user_id, completed_fully)` — Habit tracking and journey history.
- [ ] `analytics_events.created_at` — Time-range reporting in admin dashboard.
- [ ] `auth_tokens.expires_at` — Efficient cleanup of expired tokens (runs every 6 hours).
- [ ] `users.last_active_at` — Admin dashboard active user reporting.
- [ ] `voice_samples.user_id` — Voice synthesis and profile cleanup.

## Priority 2: Response Compression

The server does not compress HTTP responses. Adding gzip/brotli compression would reduce JSON payload sizes by 60-80%, improving load times especially on mobile data connections.

- [ ] Add `compression` middleware to Express server.

## Priority 3: Static Asset Cache Headers

Static files (ambient sounds, images) are served without explicit cache headers, so browsers re-download them on every visit. Returning users would benefit from long-lived cache headers on immutable assets.

- [ ] Add `maxAge` to `express.static()` for audio/image assets.
- [ ] Use content-hashed filenames or cache-busting query params for assets that may change.

## Priority 4: Bulk Update Optimization

The `POST /api/affirmations/backfill-descriptions` endpoint has an N+1 query pattern — it fires one UPDATE per affirmation in a loop instead of batching. Low urgency (rarely called), but worth fixing.

- [ ] Batch the updates using `Promise.all` with chunked concurrency instead of sequential awaits.

---

## Feature: Sleep Mode / Bedtime Affirmations

A dedicated sleep experience where affirmations play in the user's cloned voice with gradually decreasing volume, layered over ambient sleep sounds. Targets the hypnagogic state (the drowsy window before sleep when the subconscious is most receptive).

### Entry Point

- [ ] Add moon icon to the Breathe tab (top-right area) that opens Sleep Mode as a full-screen modal.

### Screen 1: Sleep Setup

Dark navy background, minimal, dimmed UI. The only screen the user actively interacts with.

- [ ] "Wind Down" header in subtle gold text.
- [ ] Timer selector — pill buttons (15 / 30 / 45 / 60 min, default 30 min). Reuse existing 36px pill style.
- [ ] Content picker toggle (reuse AI-Powered / Write Your Own pattern from Create screen):
  - "Affirmations" — loops user's saved affirmations in Inner Voice with sleep-optimized pacing (slower, softer).
  - "Sleep Story" — AI generates a guided narrative for the hypnagogic state.
- [ ] Affirmation selector (Affirmations mode) — compact list of saved affirmations with checkboxes, pick one or multiple to loop.
- [ ] Ambient sound — pre-selected via Smart Sound Matching keyed to "sleep" context. Tappable to change.
- [ ] "Begin" button — gold gradient CTA, triggers 3-2-1 countdown (reuse existing countdown component).

### Screen 2: Sleep Playback (passive — phone goes on nightstand)

Nearly black screen designed so the phone doesn't light up the room.

- [ ] Minimal clock — current time in very dim, thin white text. Tap screen to toggle visibility.
- [ ] Faint breathing pulse — subtle, slow BreathingCircle at ~10% opacity, pulsing at 4-7-8 rhythm.
- [ ] Auto-hide controls — tap screen to reveal pause and stop buttons, fade after 3 seconds (reuse breathing fullscreen auto-hide pattern).
- [ ] Volume fade curve — audio starts at current volume, gradually decreases over timer duration. At 75% mark: ~50% volume. At 90%: ~20%. At 100%: fade to silence and stop. Ambient sound fades on same curve.
- [ ] Screen dim — after 30 seconds of no interaction, drop screen brightness to minimum (expo-brightness).
- [ ] Auto-stop — when timer ends, all audio stops, screen goes fully dark, session is logged.

### Sleep Story Content (AI-generated)

- [ ] New AI prompt for ~5-8 minute guided sleep scripts:
  - Second person ("You feel your body sinking into the mattress...").
  - Progressive muscle relaxation cues woven into gentle narrative.
  - No plot tension, no stimulating imagery — monotone emotional arc.
- [ ] Spoken in Inner Voice (cloned voice) at 0.85x speed with extended pauses (3-4 seconds between paragraphs).
- [ ] Story loops with volume fade — if user is still awake, they hear it again quieter each time.

### Completion (next morning)

- [ ] No completion screen — user fell asleep, don't wake them.
- [ ] Silently log session to `listening_sessions` with `type: "sleep"`.
- [ ] AI Daily Greeting acknowledges sleep session naturally: "You put in 45 minutes of sleep affirmations last night — your subconscious was busy."
- [ ] Analytics screen counts sleep sessions toward Mindful Minutes.

### Reusable Components

- FullscreenBreathingLayout pattern for immersive dark UI.
- BackgroundMusicContext for ambient sounds.
- AudioContext for affirmation playback with auto-replay.
- Smart Sound Matching (new "sleep" context).
- 3-2-1 countdown component.
- Duration pill selector pattern.
- AI script generation pipeline (new "sleep story" prompt).
- Inner Voice / AI Voice TTS pipeline.
- Analytics tracking.

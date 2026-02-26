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

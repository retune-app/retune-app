# Retune - App Store Listing

## App Name
**Retune**

## Subtitle (30 characters max)
Transform Your Mind Daily

## Category
Primary: Health & Fitness
Secondary: Lifestyle

---

## App Icon

**Your Logo:** `assets/images/rewired-logo.png`

This is your beautiful spiral ball logo with navy blue swirls and a warm golden center - representing transformation and inner light.

### App Store Icon Requirements
- **Size:** 1024 x 1024 pixels (required for App Store Connect)
- **Format:** PNG
- **No transparency:** iOS requires a solid background (your logo has a light background, which is perfect)
- **No rounded corners:** Apple automatically applies the rounded corner mask

### Preparing Your Icon
Your current logo may need to be resized to exactly 1024x1024. You can do this with:
- **Figma:** Import → resize canvas to 1024x1024 → export as PNG
- **Canva:** Create 1024x1024 canvas → upload logo → download
- **macOS Preview:** Open image → Tools → Adjust Size → 1024x1024

---

## Description

**Rewire your mind with the power of your own voice.**

Retune is a revolutionary personal growth app that combines AI-generated affirmations with voice cloning technology. Hear positive affirmations spoken in YOUR voice — the most persuasive voice your subconscious knows.

### Why Your Own Voice?
Research shows we respond more powerfully to our own voice. Retune clones your voice from a short sample, then generates personalized affirmations tailored to your goals — all played back as if you're speaking directly to yourself.

### Features

**Personalized Affirmations**
- Define your goals and intentions
- AI generates custom affirmation scripts
- Hear them in your cloned voice for maximum impact

**Guided Breathing Exercises**
- Box Breathing for focus and calm
- 4-7-8 Technique for relaxation and sleep
- Coherent Breathing for heart-mind balance
- Beautiful animated visual guides

**Ambient Sound Library**
- Nature sounds for peaceful meditation
- Solfeggio frequencies for healing
- Binaural beats for deep focus

**Track Your Progress**
- Daily streaks to build consistency
- Session analytics and insights
- Mindful minutes tracking

**Designed for Tranquility**
- Calming ethereal aesthetic
- Dark and light modes
- Gentle haptic feedback

**Your Privacy Matters**
- Voice recordings deleted immediately after processing
- Full control to delete all your data anytime
- Transparent about what data we collect and why
- No selling or sharing of personal information

Transform negative self-talk into empowering beliefs. Start your journey of self-discovery today.

---

## Keywords (100 characters max)
affirmations,meditation,breathing,mindfulness,voice,self-help,anxiety,sleep,wellness,mental health

## Promotional Text (170 characters max)
Hear affirmations in YOUR voice. Retune uses AI and voice cloning to create personalized meditation experiences that speak directly to your subconscious mind.

## What's New (for updates)
- Enhanced breathing exercises with progress indicators
- Improved audio playback with natural pauses
- Bug fixes and performance improvements

---

## App Information

**Age Rating:** 4+
**Price:** Free (with optional premium features)
**Languages:** English

## Privacy Policy URL
https://[your-domain]/privacy-policy

## Support URL
https://[your-domain]/support

## Marketing URL (optional)
https://[your-domain]

---

## Screenshot Requirements

### Required Device Sizes

| Device | Resolution | Required? |
|--------|-----------|-----------|
| iPhone 15 Pro Max (6.7") | 1290 x 2796 | Yes |
| iPhone 15 Plus (6.5") | 1242 x 2688 | Yes |
| iPhone 8 Plus (5.5") | 1242 x 2208 | Optional |
| iPad Pro 12.9" (6th gen) | 2048 x 2732 | If supporting iPad |

### Recommended Screenshots (in order)

1. **Hero/Welcome Screen**
   - Show the auth screen with meditation background
   - Highlight: "Transform your mind through the power of affirmations"

2. **Breathing Exercise in Action**
   - Capture during active breathing animation (circle expanding/contracting)
   - Show technique selection at bottom
   - Highlight: "Guided breathing for calm & focus"

3. **Affirmation Library**
   - Show 3-4 affirmation cards with different categories
   - Highlight: "Your personal affirmation library"

4. **Voice Cloning Feature**
   - Show the voice setup or selection screen
   - Highlight: "Hear affirmations in YOUR voice"

5. **Audio Player**
   - Show affirmation playing with waveform or RSVP text
   - Highlight: "Meditative listening experience"

6. **Progress & Streaks**
   - Show stats dashboard with streak count
   - Highlight: "Track your mindfulness journey"

### Screenshot Best Practices

**Do:**
- Use dark mode (more dramatic, shows the gold accents beautifully)
- Capture during animations (breathing circle expanding)
- Add minimal text overlays (headline + 1-line benefit)
- Use consistent fonts for overlays (match app style)
- Show real content, not placeholder text

**Don't:**
- Include status bar with personal info (use clean status bar)
- Show error states or loading screens
- Overcrowd with too much text
- Use blurry or low-resolution images

### Tools for Creating App Store Screenshots
- **Figma**: Free, great for adding text overlays and device frames
- **App Mockup (appmockup.io)**: Easy device frame generator
- **Screenshots Pro**: Mac app for App Store screenshots
- **Canva**: Simple option for quick mockups

---

## App Review Notes

### Demo Account for Apple Review

**Email:** appreview@retuneappdev.com
**Password:** RetuneReview2024!

**This account has:**
- 23 pre-loaded affirmations across all 5 Life Pillars (Mind, Body, Spirit, Connection, Achievement)
- Fresh usage limits: 0/2 voice clones used, 0/10 AI affirmations used this month
- Voice consent not yet given (allows testing the full consent flow)
- No voice clone set up (allows testing the complete voice recording experience)

**Testing Suggestions:**
1. **Browse Affirmations:** Go to the Believe tab to see sample affirmations organized by pillar color
2. **Voice Recording Flow:** Tap "Record My Voice" in Voice Settings to test the consent modal and recording flow
3. **Create Affirmation:** Use the + button to create a new AI affirmation and test the generation feature
4. **Breathing Exercises:** Try the breathing exercises in the Breathe tab with different techniques
5. **Privacy Controls:** Test "Delete My Data" in Settings → Security & Privacy (type "delete" to confirm - do not complete with demo account)
6. **View Usage Limits:** Settings → scroll to "USAGE LIMITS" section to see remaining quotas

---

### Permissions Used

| Permission | Purpose | User Consent |
|------------|---------|--------------|
| **Microphone** | Voice sample recording for voice cloning | Explicit consent modal required before first recording |
| **Apple Sign In** | User authentication | Standard iOS flow |
| **Background Audio** | Meditation and affirmation playback | System default |

### Privacy & Security Features

**Voice Data Handling:**
- Voice samples are processed securely through ElevenLabs API
- **Voice files are automatically deleted from our server immediately after successful cloning** (PII protection)
- Users must provide explicit consent via in-app modal before any voice recording
- Consent explains: data processing, third-party involvement, and deletion rights

**User Data Control (GDPR Compliance):**
- Users can delete ALL their data via Settings → Security & Privacy → "Delete My Data"
- Deletion is permanent and includes: account, affirmations, voice clones, audio files, and history
- Voice clones are also deleted from ElevenLabs via their API
- Requires typing "delete" to confirm (prevents accidental deletion)

**Usage Limits (Prevents Abuse):**
- Maximum 2 voice clones per user (lifetime)
- Maximum 10 AI-generated affirmations per month (auto-resets)
- Limits are visible to users in Settings under "USAGE LIMITS"
- Listening to existing affirmations is unlimited

**Rate Limiting (Abuse Prevention):**
- AI generation: 5 requests per minute
- Text-to-speech: 10 requests per minute  
- Voice cloning: 3 attempts per hour

### Testing the Security Features

To verify security features with the demo account:

1. **View Usage Limits:** Settings → scroll to "USAGE LIMITS" section
2. **View Privacy Info:** Settings → Security & Privacy
3. **Test Delete Flow:** Settings → Security & Privacy → scroll to "Delete All My Data" (do not complete with demo account)

### Third-Party Services

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| **ElevenLabs** | Voice cloning & text-to-speech | Voice samples (deleted after processing), affirmation text |
| **OpenAI** | AI affirmation script generation | User's goal text (no PII) |
| **PostgreSQL (Replit)** | User data storage | Account info, affirmations, preferences |

All third-party services are accessed via secure HTTPS connections.

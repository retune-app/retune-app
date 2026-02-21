# RETUNED — Brand Guide (February 2026)

A comprehensive reference for anyone creating marketing collateral, social media assets, presentations, or any visual material for RETUNED.

---

## 1. Brand Identity

### Brand Name
- **Full name**: RETUNED (always uppercase in logos and headlines)
- **Tagline**: "The First Wellness App with a Positive Feedback Loop"
- **Description**: RETUNED creates a personalized wellness journey where affirmations, breathing, and meditation flow seamlessly into each other. Your words. Your voice. One continuous experience.
- **Website**: https://retuned.app

### Brand Personality
- Serene Empowerment aesthetic
- Calm, supportive, and grounding
- Premium but accessible
- Science-backed wellness, not mystical or "woo"

---

## 2. Logo — Resonance Rings

The logo features concentric gold rings radiating outward from a glowing core. It represents the ripple effect of positive inner change.

### Design Details
- 5 concentric rings, opacity progression from subtle outer (6%) to bold inner (78%)
- Gold core with radial gradient (#E5C95C to #C9A227) with subtle glow
- Light version: gold rings on white/transparent background (used for web, marketing on light backgrounds)
- Dark version: gold rings on navy gradient background (#1A1A2E to #0F1C3F), rounded square (22% radius)

### Current Logo Files in the Codebase

| Context | File Path | Notes |
|---------|-----------|-------|
| **App icon (iOS/Android/Web)** | `assets/images/icon-light-1024x1024.png` | Light rings on white, 1024x1024. Used for iOS icon, Android adaptive icon, and web favicon |
| **Splash screen** | `assets/images/icon-light-1024x1024.png` | Same light icon, displayed at 200px width on #E8EDF2 background (light mode) or #1A1A2E (dark mode) |
| **Landing page nav bar** | `server/templates/landing-assets/logo.png` | Gold rings on white, 46x46px display size |
| **Landing page screenshots** | `server/templates/landing-assets/` | Contains various app screenshots used on retuned.app |

### Logo Usage Rules
- Always maintain clear space around the logo (minimum: half the logo width on all sides)
- Do not stretch, rotate, or distort the rings
- On dark backgrounds, use the light version (gold rings, no background shape)
- On light backgrounds, use the light version as-is
- Do not place the logo on busy or multicolored backgrounds
- Minimum display size: 32x32px

---

## 3. Color Palette

### Primary Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Gold** (Primary) | `#C9A227` | Primary brand color, CTA buttons, active states, links, logo rings |
| **Gold Light** | `#E5C95C` | Highlights, gradients, core glow, dark mode primary |
| **Navy Dark** | `#0F1C3F` | Deep navy, primary text, dark mode background, overlays |
| **Navy Mid** | `#1A2D4F` | Dark mode surfaces, gradient endpoints |

### Gold Gradient (for buttons, accents, hero elements)
- **Light direction**: #E5C95C to #C9A227
- **Dark direction**: #C9A227 to #8A6D1A

### In-App Color System — Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| Text | `#0F1C3F` | Primary text (navy) |
| Text Secondary | `#5A6A7E` | Subtitles, captions |
| Background Root | `#F5F7FA` | Page background |
| Background Default | `#FFFFFF` | Cards, surfaces |
| Background Secondary | `#EEF1F5` | Secondary surfaces |
| Background Tertiary | `#E0E4EB` | Tertiary surfaces |
| Border | `#E0E4EB` | Dividers, input borders |
| Success | `#50C9B0` | Teal, success states |
| Error | `#E74C3C` | Error states |
| Warning | `#F39C12` | Warning states |

### In-App Color System — Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| Text | `#F5F7FA` | Primary text |
| Text Secondary | `#8A9AAE` | Subtitles, captions |
| Background Root | `#0F1C3F` | Page background (navy, never black) |
| Background Default | `#1A2D4F` | Cards, surfaces |
| Background Secondary | `#243656` | Secondary surfaces |
| Background Tertiary | `#2E4166` | Tertiary surfaces |
| Border | `#2A3D5F` | Dividers |
| Gold | `#E5C95C` | Primary accent in dark mode |
| Gold Light | `#F0D878` | Extra-light gold for dark mode highlights |
| Success | `#6BE9D2` | Success states |
| Error | `#FF6B6B` | Error states |

### Landing Page Colors

| CSS Variable | Hex | Usage |
|--------------|-----|-------|
| `--bg` | `#FAFAFA` | Page background |
| `--bg-warm` | `#F7F4EF` | Warm background sections |
| `--text` | `#2C2C2C` | Headlines |
| `--text-muted` | `#6B6B6B` | Body paragraphs |
| `--text-light` | `#8A8A8A` | Captions, timestamps |
| `--believe` | `#C9A227` | Believe/Affirmation accent (gold) |
| `--believe-light` | `#D4B545` | Light gold hover |
| `--breathe` | `#2EC4B6` | Breathe accent (teal) |
| `--meditate` | `#7C3AED` | Meditate accent (purple) |
| `--white` | `#FFFFFF` | Card backgrounds |
| `--border` | `rgba(44, 44, 44, 0.1)` | Subtle borders |

### Pillar Colors (for marketing the three core features)

| Pillar | Color | Hex |
|--------|-------|-----|
| **Believe** (Affirmations) | Gold | `#C9A227` |
| **Breathe** (Breathing) | Teal | `#2EC4B6` |
| **Meditate** (Meditation) | Purple | `#7C3AED` |

### Important Color Rules
- Dark mode uses **navy tones only** — never pure black (#000000)
- The brand palette is Gold + Navy — **no purple in the app itself** (purple is only for the "Meditate" pillar on the landing page)
- Button text on gold backgrounds: Navy Dark (#0F1C3F)
- Active button states on gold: white semi-transparent background (0.85 opacity)
- Inactive button states on gold: frosted white background (0.2 opacity) with white text

---

## 4. Typography

### In-App Fonts (iOS/Android)

| Font Family | Weights Used | Role |
|-------------|-------------|------|
| **Nunito** (Google Fonts) | Regular 400, SemiBold 600, Bold 700 | Primary app font — all headings, body text, UI elements |
| **Outfit** (Google Fonts) | Regular 400, Medium 500, SemiBold 600, Bold 700 | Brand/auth screens, wordmark |

#### In-App Type Scale

| Style | Font | Weight | Size | Line Height |
|-------|------|--------|------|-------------|
| Hero | Nunito | 700 Bold | 34px | 42px |
| h1 | Nunito | 700 Bold | 28px | 36px |
| h2 | Nunito | 700 Bold | 24px | 32px |
| h3 | Nunito | 600 SemiBold | 20px | 28px |
| h4 | Nunito | 600 SemiBold | 18px | 26px |
| Body | Nunito | 400 Regular | 16px | 24px |
| Small | Nunito | 400 Regular | 14px | 20px |
| Caption | Nunito | 400 Regular | 12px | 16px |
| Link | Nunito | 500 Medium | 16px | 24px |

### Landing Page / Web Fonts (retuned.app)

| Font Family | Weights Used | Role |
|-------------|-------------|------|
| **Cormorant Garamond** (Google Fonts) | 400, 500, 600, 700 | Elegant serif for big statement headlines (h1, h2) |
| **Outfit** (Google Fonts) | 300, 400, 500, 600, 700 | Sans-serif for action headings (h3, h4), body text, buttons, nav |

#### Landing Page Type Scale

| Element | Font | Weight | Size (Mobile) | Size (Desktop) |
|---------|------|--------|---------------|----------------|
| Nav wordmark | Outfit | 500 | 17px | 17px |
| h1 | Cormorant Garamond | 600 | 32px | 48px |
| h2 | Cormorant Garamond | 600 | 26px | 36px |
| h3 | Outfit | 700 | 20px | 24px |
| h4 | Outfit | 600 | 18px | 20px |
| Body (p) | Outfit | 400 | 16px | 16px |
| Buttons | Outfit | 500 | 14px | 14px |
| Pills/tags | Outfit | 400 | 12px | 12px |

### Typography Rules for Marketing
- Use **Cormorant Garamond** for big, emotional headlines in marketing materials (ads, social, print)
- Use **Outfit** for everything else (subheads, body, CTAs, captions)
- Never use more than two font families in a single piece
- Minimum body text size: 14px
- Headlines should breathe — use generous line height (1.15x for headlines, 1.5x for body)

### Nav Wordmark
- Text: "RETUNED"
- Font: Outfit Medium (500)
- Size: 17px
- Letter spacing: 4.5px
- Uppercase, no underline accent

---

## 5. UI Component Styling

### Buttons
- Pill buttons: fixed height of 36px
- Auth buttons (Apple/Google sign-in): fixed height of 48px
- Primary CTA: gold gradient background (#E5C95C to #C9A227), navy text
- Secondary: white/transparent background with gold border

### Cards
- Light mode: white background with subtle navy shadow
- Dark mode: navy surface (#1A2D4F) background
- Use background colors for elevation, not heavy shadows
- Border radius: 12-20px depending on size

### Spacing Scale
- xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, xxl: 24px, 3xl: 32px, 4xl: 40px, 5xl: 48px, 6xl: 64px

### Border Radius Scale
- xs: 8px, sm: 12px, md: 16px, lg: 20px, xl: 24px, 2xl: 32px, full: 9999px (pill)

---

## 6. Imagery and Icons

### Icon Style
- Feather icon set (line icons, consistent stroke width)
- Icon color follows text color in context (navy on light, white/gold on dark)

### Photography / Imagery Guidelines
- Calm, serene tones — golden hour warmth, soft focus
- Nature-inspired: water, sky, breath, light
- Avoid stock-photo cliches (forced smiles, corporate settings)
- Prefer abstract or environmental over literal depictions

### App Screenshots
App Store and marketing screenshots are located in:
- `server/templates/landing-assets/` — current landing page screenshots
- `docs/screenshots/` — additional screenshot archive

---

## 7. Voice and Tone (for copy)

- **Calm and grounding** — not hyped or salesy
- **Empowering** — "you can" not "you should"
- **Simple language** — everyday words, no jargon
- **Personal** — speak directly to the reader ("your journey", "your voice")
- **Science-informed** — reference research without being clinical
- Avoid: "unlock your potential", "manifest your dreams", motivational poster language

---

## 8. Brand Assets Quick Reference

### Files Currently in the Codebase

| Asset | Path | Dimensions |
|-------|------|------------|
| App icon (production) | `assets/images/icon-light-1024x1024.png` | 1024x1024 |
| Landing page logo | `server/templates/landing-assets/logo.png` | 192x192 (displayed at 46x46) |
| Library background (light) | `assets/images/library-background-light.png` | — |
| Library background (dark) | `assets/images/library-background.png` | — |
| Landing page hero (light) | `server/templates/landing-assets/hero-light.jpg` | — |
| Landing page hero (dark) | `server/templates/landing-assets/hero-dark.jpg` | — |

### Design Reference File
- `attached_assets/icon-light-v15-1024_1771474122418.png` — latest icon design reference

### Social / OG Image
- OG image for link previews: `server/templates/landing-assets/logo.png`
- OG title: "RETUNED - The First Wellness App with a Positive Feedback Loop"
- OG description: "RETUNED creates a personalized wellness journey where affirmations, breathing, and meditation flow seamlessly into each other. Your words. Your voice. One continuous experience."

---

## 9. Do's and Don'ts

### Do
- Use the gold/navy palette consistently
- Pair Cormorant Garamond headlines with Outfit body text
- Keep designs clean and spacious
- Use the Resonance Rings logo at appropriate sizes
- Maintain the calm, empowering tone

### Don't
- Use pure black — always use navy tones
- Use purple in app-related materials (reserved for landing page "Meditate" pillar only)
- Place the logo on busy backgrounds
- Use motivational poster language or AI cliches
- Mix more than two font families in one piece
- Use emojis in the app or formal materials

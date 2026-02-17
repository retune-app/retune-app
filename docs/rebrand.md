# RETUNED — Rebrand Log (February 2026)

## Previous State (Pre-Rebrand)

### Logo
- **App icon**: `assets/images/rewired-logo.png` — AI-generated dark mode icon with deep navy background, gold concentric elements
- **Dark variant**: `assets/images/rewired-logo-dark.png` — darker variant for specific uses
- **Landing page logo**: `server/templates/landing-assets/logo.png` — same icon used as favicon, OG image, apple-touch-icon, and inline header logo across all landing pages
- **app.json references**: `icon`, `android.adaptiveIcon.foregroundImage`, `web.favicon`, `splash.image` all pointed to `./assets/images/rewired-logo.png`

### Typography
- **In-app**: Nunito (400 Regular, 700 Bold) — primary font for all React Native screens
- **Landing page headlines**: Space Grotesk (400-700) — geometric sans-serif
- **Landing page body**: Inter (400-600) — neutral sans-serif
- **Landing page accents**: Nunito (400, 700) — bridge to in-app feel

### Landing Pages Using These Assets
- Main landing page (`/`) — `server/templates/landing-page.html`
- Science page (`/science`) — `server/templates/science.html`
- Support page (`/support`) — `server/templates/support.html`
- Privacy Policy (`/privacy`) — `server/templates/privacy-policy.html`
- Terms of Service (`/terms`) — `server/templates/terms-of-service.html`

---

## New State (Post-Rebrand)

### Logo — "Resonance Rings"
Design: Concentric gold rings radiating from a warm gold core, representing frequency, vibration, and the ripple effect of positive affirmations. Echoes the in-app breathing ring animation.

**Primary (Light version)** — soft grey/white background:
- `assets/images/icon-light-1024x1024.png` — App Store / Master
- `assets/images/icon-light-512x512.png` — Marketing / Web
- `assets/images/icon-light-180x180.png` — iPhone @3x

**Dark version** — navy background:
- `assets/images/icon-dark-1024x1024.png` — App Store / Master
- `assets/images/icon-dark-512x512.png` — Marketing / Web
- `assets/images/icon-dark-180x180.png` — iPhone @3x

**Expo drop-in files** (in `assets/images/`):
- `icon.png` — Light 1024x1024 (primary, used in app.json)
- `adaptive-icon.png` — Dark 1024x1024 (Android adaptive)
- `splash-icon.png` — Dark 512x512 (splash screen)
- `favicon.png` — Dark 256x256 (web favicon)

**Landing page**:
- `server/templates/landing-assets/logo.png` — Light 512x512 (primary logo across all pages)

**Old logo files preserved** (not deleted):
- `assets/images/rewired-logo.png`
- `assets/images/rewired-logo-dark.png`

### app.json Configuration
```json
{
  "icon": "./assets/images/icon.png",
  "ios": {
    "icon": {
      "light": "./assets/images/icon-light-1024x1024.png",
      "dark": "./assets/images/icon-dark-1024x1024.png"
    }
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/adaptive-icon.png",
      "backgroundColor": "#0F1C3F"
    }
  },
  "splash": {
    "image": "./assets/images/splash-icon.png",
    "backgroundColor": "#1A1A2E"
  },
  "web": {
    "favicon": "./assets/images/favicon.png"
  }
}
```

### Typography (Landing Page Only)
| Context | Old Font | New Font | Google Fonts |
|---------|----------|----------|--------------|
| Headlines (h1, h2, h3) | Space Grotesk | Instrument Serif | `Instrument+Serif:ital@0;1` |
| Body (p, li, nav, buttons) | Inter | DM Sans | `DM+Sans:wght@400;500;600;700` |
| Accents (bridge to app) | Nunito | Nunito (unchanged) | `Nunito:wght@400;700` |

**In-app fonts unchanged** — Nunito remains the sole app font.

### Brand Colors Reference
| Token | Value | Usage |
|-------|-------|-------|
| Dark bg gradient start | `#1A1A2E` | Icon, splash background |
| Dark bg gradient end / Navy | `#0F1C3F` | Icon, Android adaptive bg |
| Light bg gradient start | `#F0F2F6` | Light icon top |
| Light bg gradient end | `#E0E5EC` | Light icon bottom |
| Gold primary | `#C9A227` | Ring color, accents |
| Gold light | `#E5C95C` | Light mode ring color |
| Gold deep | `#8A6D1A` | Dark mode deep gold |

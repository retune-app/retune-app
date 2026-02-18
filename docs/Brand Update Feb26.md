# RETUNED — Brand Update Package (February 2026)

## Summary of Changes

This package contains everything needed to update RETUNED's visual identity across the landing page (retuned.app) and app store assets. Three areas were updated:

1. **Logo** — New "Resonance Rings" icon with play button core
2. **Typography** — Hybrid Cormorant Garamond + Outfit system
3. **Nav Wordmark** — Outfit Medium, 17px, clean (no underline)

---

## 1. Logo — Resonance Rings

The new logo features concentric gold rings radiating outward from a glowing core with a subtle white play triangle. Two versions: **dark** (navy background, for app icon) and **light** (gold rings on white, for web nav).

### Design Details
- 5 concentric rings, opacity progression from subtle outer (6%) to bold inner (78%)
- Gold core with radial gradient (#E5C95C → #C9A227) + subtle glow
- White play triangle (85% opacity) seated inside the core circle
- Dark version: navy gradient background (#1A1A2E → #0F1C3F), rounded square (22% radius)
- Light version: rings on white/transparent, no background shape

### What to Use Where

| Context | File | Notes |
|---------|------|-------|
| **Landing page nav bar** | `logo.png` (192px) | Gold rings + play on white. Drop-in replacement for `/landing-assets/logo.png` |
| **App icon (iOS/Android)** | `icon.png` (1024px) | Navy dark + play. Drop into Expo `/assets/icon.png` |
| **Adaptive icon (Android)** | `adaptive-icon.png` (1024px) | Same as icon.png |
| **Splash screen** | `splash-icon.png` (512px) | Navy dark + play |
| **Favicon** | `favicon.png` (256px) | Navy dark + play |
| **App Store listing** | `icon-dark-play-1024.png` | Full resolution for store submission |

### app.json Updates
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "backgroundColor": "#1A1A2E"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F1C3F"
      }
    }
  }
}
```

---

## 2. Typography — Hybrid System

### The Rule
```
Big statement headline (h1, h2)  →  Cormorant Garamond 600 (serif)
Action heading (h3, h4, cards)   →  Outfit 700 (bold sans)
Everything else                  →  Outfit 400/500 (regular sans)
```

### Font Import
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Quick Reference

| Element | Font | Weight | Size (mobile) | Size (desktop) |
|---------|------|--------|---------------|----------------|
| Nav wordmark | Outfit | 500 | 17px | 17px |
| h1 | Cormorant Garamond | 600 | 32px | 48px |
| h2 | Cormorant Garamond | 600 | 26px | 36px |
| h3 | Outfit | 700 | 20px | 24px |
| h4 | Outfit | 600 | 18px | 20px |
| Body (p) | Outfit | 400 | 16px | 16px |
| Buttons | Outfit | 500 | 14px | 14px |
| Pills/tags | Outfit | 400 | 12px | 12px |

### Status
✅ **Implemented** on retuned.app (all pages: `/`, `/science`, `/support`)

### Remaining Item
⚠️ **Nav wordmark** — Still showing old heavy font with gold "TU" underline. Should be updated to:
- Font: Outfit 500
- Size: 17px
- Tracking: 4.5px
- Uppercase, no underline accent

---

## 3. Asset Inventory

### App Icons — Dark (Navy) with Play Button ✅ FINAL
Use these for iOS/Android app icon and App Store.

| File | Size |
|------|------|
| `icon-dark-play-1024.png` | 1024×1024 |
| `icon-dark-play-512.png` | 512×512 |
| `icon-dark-play-256.png` | 256×256 |
| `icon-dark-play-192.png` | 192×192 |
| `icon-dark-play-180.png` | 180×180 |
| `icon-dark-play-167.png` | 167×167 |
| `icon-dark-play-152.png` | 152×152 |
| `icon-dark-play-144.png` | 144×144 |
| `icon-dark-play-128.png` | 128×128 |
| `icon-dark-play-120.png` | 120×120 |
| `icon-dark-play-96.png` | 96×96 |
| `icon-dark-play-87.png` | 87×87 |
| `icon-dark-play-80.png` | 80×80 |
| `icon-dark-play-72.png` | 72×72 |
| `icon-dark-play-64.png` | 64×64 |
| `icon-dark-play-60.png` | 60×60 |
| `icon-dark-play-58.png` | 58×58 |
| `icon-dark-play-48.png` | 48×48 |
| `icon-dark-play-40.png` | 40×40 |

### Nav Logo — Gold Rings + Play on White ✅ FINAL
Use for landing page nav bar (`/landing-assets/logo.png`).

| File | Size | Use |
|------|------|-----|
| `nav-logo-play-1024.png` | 1024×1024 | Master |
| `nav-logo-play-512.png` | 512×512 | Marketing |
| `nav-logo-play-256.png` | 256×256 | — |
| `nav-logo-play-192.png` | 192×192 | **Nav bar (3x retina)** |
| `nav-logo-play-144.png` | 144×144 | — |
| `nav-logo-play-128.png` | 128×128 | — |
| `nav-logo-play-96.png` | 96×96 | Nav bar (2x retina) |
| `nav-logo-play-72.png` | 72×72 | — |
| `nav-logo-play-64.png` | 64×64 | — |
| `nav-logo-play-48.png` | 48×48 | — |
| `logo.png` | 192×192 | **Drop-in replacement** for `/landing-assets/logo.png` |

### Expo Convenience Files ✅ FINAL
Drop these directly into your Expo `/assets/` folder.

| File | Size | Replaces |
|------|------|----------|
| `icon.png` | 1024×1024 | `/assets/icon.png` |
| `adaptive-icon.png` | 1024×1024 | `/assets/adaptive-icon.png` |
| `splash-icon.png` | 512×512 | `/assets/splash-icon.png` |
| `favicon.png` | 256×256 | `/assets/favicon.png` |

### Legacy / Alternative Versions (keep for reference)

| Prefix | Description |
|--------|-------------|
| `icon-dark-*` | Navy icon WITHOUT play button (original 6-ring version) |
| `icon-light-*` | Light background icon WITHOUT play button |
| `nav-logo-dark-*` | Navy nav logo (5 rings, no play) |
| `nav-logo-light-*` | Light nav logo (5 rings, no play) |
| `nav-logo-gold-*` | Gold rings on white, thicker, no play |
| `nav-logo-rings-*` | Gold rings on white, larger, no play |

---

## 4. Brand Colors

```
Navy dark:     #1A1A2E     (app icon background top)
Navy deep:     #0F1C3F     (app icon background bottom, splash bg)
Gold:          #C9A227     (primary brand, rings, CTA buttons)
Gold light:    #E5C95C     (core glow, highlights)
Text dark:     #1a1a2e     (headlines)
Text body:     #888888     (body paragraphs)
Text light:    #aaaaaa     (captions, timestamps)
White:         #ffffff     (backgrounds, play triangle)
Off-white:     #faf9f5     (page background gradient)
```

---

## 5. Files in This Package

### Documentation
- `README.md` — This file (complete brand summary)
- `TYPOGRAPHY-UPDATE.md` — Detailed section-by-section typography instructions for Replit agent

### Production Assets (Final)
- `logo.png` — Nav bar logo (drop-in)
- `icon.png` — App icon (drop-in)
- `adaptive-icon.png` — Android adaptive icon (drop-in)
- `splash-icon.png` — Splash screen icon (drop-in)
- `favicon.png` — Web favicon (drop-in)
- `icon-dark-play-*.png` — All iOS/Android icon sizes (19 files)
- `nav-logo-play-*.png` — All nav logo sizes (10 files)

### Alternative Versions (Reference)
- `icon-dark-*.png` — Navy icons without play (14 files)
- `icon-light-*.png` — Light icons without play (14 files)
- `nav-logo-dark-*.png` — Navy nav logos (8 files)
- `nav-logo-light-*.png` — Light nav logos (8 files)
- `nav-logo-gold-*.png` — Gold-on-white nav logos (10 files)
- `nav-logo-rings-*.png` — Larger rings nav logos (10 files)

### Total: ~100 asset files + 2 documentation files

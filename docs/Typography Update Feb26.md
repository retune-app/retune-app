# RETUNED — Typography Update for Replit Agent

## What We're Doing

Replacing Space Grotesk + Inter with a hybrid system: **Cormorant Garamond** (elegant serif for big headlines) + **Outfit** (bold sans for action headings, regular for body). Apply to ALL pages: `/`, `/science`, `/support`.

**Do NOT touch React Native / in-app fonts.**

---

## The Rule

```
Big statement headline (h1, h2)  →  Cormorant Garamond 600 (serif)
Action heading (h3, h4, cards)   →  Outfit 700 (bold sans)
Everything else                  →  Outfit 400/500 (regular sans)
```

---

## Step 1: Replace Font Import

Find the current Google Fonts `<link>` or `@import` in `<head>`. Remove it. Replace with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

---

## Step 2: Global CSS

Add these styles. They override all existing font declarations:

```css
/* === RETUNED TYPOGRAPHY — Hybrid System === */

body {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

/* Big statement headlines — elegant serif */
h1, h2 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-weight: 600;
  line-height: 1.15;
}

/* Action headings — bold punchy sans */
h3, h4, h5, h6 {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  line-height: 1.3;
}

h4, h5, h6 {
  font-weight: 600;
}

/* Everything else */
p, li, td, th, span, a, div, label, input, textarea, select {
  font-family: 'Outfit', sans-serif;
}

button, [class*="btn"], [class*="button"], [class*="cta"] {
  font-family: 'Outfit', sans-serif;
  font-weight: 500;
}
```

---

## Step 3: Find-and-Replace Old Fonts

Search ALL CSS/JS/HTML files:

```
'Space Grotesk'  →  remove (handled by global styles above)
"Space Grotesk"  →  remove
'Inter'          →  'Outfit'
"Inter"          →  "Outfit"
```

Also search for any `font-weight: 700` or `font-weight: 800` on h1/h2 elements and change to `600`.

---

## Step 4: Nav Wordmark

The "RETUNED" text next to the logo in the nav bar. Find its CSS and update:

```css
/* Nav wordmark */
font-family: 'Outfit', sans-serif;
font-size: 17px;
font-weight: 500;
letter-spacing: 4.5px;
text-transform: uppercase;
color: #1a1a2e;
```

**Remove the gold underline** on "TU" — delete any `<span>`, `border-bottom`, or `text-decoration` that creates the accent underline on specific letters. The wordmark should be clean plain text.

---

## Step 5: Responsive Headline Sizes

```css
/* Mobile-first */
h1 { font-size: 32px; letter-spacing: -0.5px; }
h2 { font-size: 26px; letter-spacing: -0.3px; }
h3 { font-size: 20px; letter-spacing: -0.2px; }
h4 { font-size: 18px; }

@media (min-width: 768px) {
  h1 { font-size: 42px; }
  h2 { font-size: 32px; }
  h3 { font-size: 22px; }
  h4 { font-size: 20px; }
}

@media (min-width: 1024px) {
  h1 { font-size: 48px; }
  h2 { font-size: 36px; }
  h3 { font-size: 24px; }
  h4 { font-size: 20px; }
}
```

---

## Step 6: Section-by-Section Guide

Here is exactly what font goes where on retuned.app. Every heading on the site is listed below.

### NAV BAR
```
Logo text "RETUNED"                                             → Outfit 500, 17px, 4.5px tracking, uppercase, NO underline
CTA button "Experience the Flywheel"                            → Outfit 500
```

### HERO SECTION
```
Pill "Personalized Wellness"                                    → Outfit 400, 12px
h1 "The First Wellness App That Meets You Where You Are"        → Cormorant Garamond 600
Body "Tell RETUNED how you feel..."                             → Outfit 400
Button "Experience the Wellness Flywheel →"                     → Outfit 500
Links "See How It Works →" / "The Science Behind It →"          → Outfit 400
```

### "MOST WELLNESS APPS" SECTION
```
h2 "Most Wellness Apps Give You More Choices..."                → Cormorant Garamond 600
Body paragraphs                                                 → Outfit 400
Comparison card labels "Anxious → Calm"                         → Outfit 500
Card items "Breathe · 4 min", "Believe · 5 min"                → Outfit 400
Button "Begin Your Journey"                                     → Outfit 500
```

### "HOW THE FLYWHEEL WORKS" SECTION
```
h2 "How the Breathe-Believe-Meditate Flywheel Works"           → Cormorant Garamond 600
Subtitle "Three modes. One continuous journey..."               → Outfit 400
h3 "A positive feedback loop — in every sense."                 → Outfit 700
Body text                                                       → Outfit 400
Flywheel labels "AFFIRMATIONS", "BREATHWORK", "MEDITATION"     → Outfit 500, uppercase
```

### FLYWHEEL DETAIL CARDS
```
Labels "Believe to Breathe", "Breathe to Meditate", etc.       → Outfit 500
h3 "Your Affirmations Don't Stop—They Transform"               → Outfit 700
h3 "Your Mood Shapes What Comes Next"                           → Outfit 700
h3 "Meditation That Speaks Your Words"                          → Outfit 700
Body descriptions                                               → Outfit 400
```

### "CREATE AFFIRMATIONS" SECTION
```
h2 "Create Affirmations That Speak to You"                     → Cormorant Garamond 600
Subtitle "From choosing your focus..."                          → Outfit 400
Step numbers "1", "2", "3"                                      → Outfit 600
h3 "Choose Your Focus"                                          → Outfit 700
h3 "Share Your Intention"                                       → Outfit 700
h3 "AI Writes Your Script"                                      → Outfit 700
Step descriptions                                               → Outfit 400
```

### "WHAT MAKES IT SEAMLESS" SECTION
```
h2 "What Makes It All Feel Seamless"                            → Cormorant Garamond 600
Subtitle "Six things working quietly..."                        → Outfit 400
h3 "Context-Aware Transitions"                                  → Outfit 700
h3 "Mood-Responsive AI"                                         → Outfit 700
h3 "Smart Affirmation Matching"                                 → Outfit 700
h3 "Your Voice, Everywhere"                                     → Outfit 700
h3 "Progress You Can See"                                       → Outfit 700
h3 "25 Ambient Soundscapes"                                     → Outfit 700
Feature descriptions                                            → Outfit 400
```

### FOCUS READING + LIBRARY CARDS
```
Label "Focus Reading Mode" / "Your Affirmation Library"         → Outfit 500
h3 "Words That Follow Your Voice"                               → Outfit 700
h3 "Every Affirmation, Organized and Ready"                     → Outfit 700
Descriptions                                                    → Outfit 400
```

### COMPARISON TABLE
```
h2 "How RETUNED Compares to Traditional Wellness Apps"          → Cormorant Garamond 600
Subtitle                                                        → Outfit 400
Table headers "Experience", "Traditional", "RETUNED"            → Outfit 500
Table cells                                                     → Outfit 400
Mobile card labels "Navigation", "Voice Consistency" etc.       → Outfit 600
```

### "REAL MOMENTS" TIMELINE
```
h2 "Real Moments. Real Flow."                                   → Cormorant Garamond 600
Subtitle "See how the Breathe-Believe-Meditate..."              → Outfit 400
Timestamps "7:00 AM", "7:05 AM", "7:12 AM"                     → Outfit 400
h3 "Wake Up, Open App"                                          → Outfit 700
h3 "Tap Breathe"                                                → Outfit 700
h3 "Mood Check-In"                                              → Outfit 700
Step descriptions                                               → Outfit 400
Summary "Total time: 12 minutes..."                             → Outfit 500
```

### FINAL CTA
```
h2 "Experience the Wellness Flywheel"                           → Cormorant Garamond 600
Subtitle "See how affirmations, breathing..."                   → Outfit 400
Button "Download for iOS →"                                     → Outfit 500
"Join the Waitlist (Android) →"                                 → Outfit 400
```

### FOOTER
```
Section headers "Product", "Legal", "Connect"                   → Outfit 600
Links                                                           → Outfit 400
"RETUNED" brand text                                            → Outfit 500
Copyright "© 2026 RETUNED..."                                   → Outfit 400
```

---

## Step 7: Apply to Other Pages

### `/science`
- Same global styles apply
- All h1/h2 → Cormorant Garamond 600
- All h3/h4 → Outfit 700
- Body → Outfit 400
- Stat numbers / data callouts → Cormorant Garamond 600
- Blockquotes / citations → Cormorant Garamond 400 italic

### `/support`
- Same global styles apply
- Page title h1 → Cormorant Garamond 600
- FAQ question headings → Outfit 700
- FAQ answers → Outfit 400
- Legal section titles (Privacy Policy, Terms of Service) → Cormorant Garamond 600
- Legal body text → Outfit 400

---

## Verification Checklist

After deployment, verify on mobile + desktop:

- [ ] Google Fonts loads Cormorant Garamond + Outfit (DevTools → Network → Font)
- [ ] Zero references to `Space Grotesk` remain anywhere
- [ ] Zero references to `Inter` remain in landing page files
- [ ] Nav wordmark: Outfit 500, 17px, 4.5px tracking, NO gold underline on TU
- [ ] Hero h1: Cormorant Garamond — serif, elegant, weight 600
- [ ] ALL h2s across site: Cormorant Garamond serif
- [ ] ALL h3s (timeline, features, cards, flywheel): Outfit 700 bold sans — NOT serif
- [ ] Body text everywhere: Outfit 400
- [ ] Buttons: Outfit 500
- [ ] Comparison table: Outfit
- [ ] Footer: Outfit
- [ ] `/science` page: same rules applied
- [ ] `/support` page: same rules applied
- [ ] No flash of unstyled text on load
- [ ] Mobile Safari renders correctly

# Design Guidelines: ReWired

## 1. Brand Identity

**Purpose**: Empower users to rewire their subconscious mind through personalized audio affirmations in their own voice, replacing limiting beliefs with positive programming.

**Aesthetic Direction**: **Ultra-Minimalist Spiritual Growth** - A calm, sophisticated aesthetic emphasizing high negative space, organic growth symbolism (leaf/plant motifs), and AI-powered spiritual renewal. Think meditation app meets elegant luxury brand.

**Brand Name**: "ReWired" (capital R, capital W)

**Core Symbol**: A stylized side-profile human head with a sprouting leaf at the crown, representing mental growth and transformation. A subtle glowing dot at the third-eye position symbolizes the AI core.

## 2. Color Palette

**Primary Gradient (Line/Leaf)**:
- Base: Charcoal Grey #333333 (grounded, stable)
- Crown: Muted Gold #BFAF83 (enlightenment, growth)

**Glowing Dot (AI Core)**: Soft Golden-Yellow #E6B800 with subtle glow halo

**Text Colors**:
- Primary: Dark Charcoal #333333
- Secondary: Warm Grey #666666

**Backgrounds**:
- Primary: Off-White #F5F5F5 (warm ivory canvas)
- Surface: Pure White #FFFFFF (cards, modals)

**Accent Colors**:
- Gold Accent: #BFAF83 (highlights, active states)
- Neutral: Light Grey #E0E0E0 (dividers, borders, inactive)
- Success/Growth: Green-tinged Gold #A8B07D (progress, affirmations)
- AI/Interactive: Soft Blue-Grey #7A8A99 (buttons, prompts)
- Error/Warning: Desaturated Brown-Grey #8B7D6B (gentle alerts)

**Gradients**:
- Hero Gradient: #333333 → #BFAF83 (diagonal 135deg, charcoal to gold)
- Card Gradient: #F5F5F5 → #FFFFFF (vertical)

**Dark Mode**:
- Background: Deep Off-Black #121212
- Surface: Dark Grey #1E1E1E
- Text Primary: Off-White #F5F5F5
- Gold remains #BFAF83

## 3. Typography

**Primary Font**: Inter (Google Font) - Clean, modern, geometric sans-serif with excellent legibility

**Type Scale**:
- Hero: Inter Bold, 34px, charcoal grey
- Title: Inter Bold, 24px, charcoal grey
- Heading: Inter SemiBold, 18px, charcoal grey
- Body: Inter Regular, 16px, charcoal grey
- Caption: Inter Regular, 14px, warm grey
- Tiny: Inter Regular, 12px, light grey

**Spacing**:
- Letter-spacing: 0.05em for elegance
- Line-height: 1.4-1.6 for readability

**Brand Text**: "ReWired" - capital R, capital W (e.g., "ReWired" not "Rewired" or "rewired")

## 4. Navigation Architecture

**Root Navigation**: Tab Navigation (3 tabs)
- Library (affirmation collection)
- Create + (floating action - central position)
- Profile (settings & progress)

**Modal Screens**:
- Voice Setup (onboarding - full screen modal)
- Player (immersive listening)
- Affirmation Editor

## 5. Visual Design Principles

**Minimalism**:
- Embrace whitespace - 70-80% negative space
- Margins/padding: 16-24px minimum
- No heavy shadows or effects
- Subtle, borderless design

**Buttons**:
- Rounded rectangles (8-12px radius)
- Off-white background with charcoal outline (default)
- Gold fill on hover/active states
- Scale to 0.96 on press with 150ms spring animation

**Cards**:
- Borderless or thin grey borders (#E0E0E0)
- 16px border radius
- Very subtle shadow (offset 0,1, opacity 0.03, radius 4)
- High internal negative space

**Icons**: Feather icons from @expo/vector-icons
- Default size: 24px
- Charcoal grey (#333333) for active
- Light grey (#E0E0E0) for inactive

**Animations**:
- Subtle fades and growth animations
- Use ease-in-out curves for calm transitions
- Leaf sprout animation on load events

## 6. Screen Specifications

### Onboarding: Voice Setup
- Transparent header with skip option
- Central microphone icon with animated pulse
- Progress indicator: "30-60 seconds recommended"
- Clean off-white background
- Gold accent on primary action button

### Library: Affirmation Collection
- Off-white background
- Clean search bar with grey border
- Category filter chips (gold when active)
- Grid of minimal affirmation cards
- Subtle charcoal-to-gold gradient on card hover

### Create: Affirmation Generator
- Mode toggle: "AI Generate" vs "Manual"
- Clean input fields with grey borders
- Gold "Generate" button
- Script preview with subtle card styling
- Generous whitespace

### Player: Active Playback
- Full-screen immersive experience
- Large central visualization
- Minimal playback controls
- Focus Mode with word-by-word display
- Tilt-to-enter/exit fullscreen landscape

### Profile: Settings
- User avatar with gold accent ring
- Clean list sections with dividers
- Toggle switches with gold active state
- Account settings in muted styling

## 7. Accessibility

- WCAG AA compliant contrast (4.5:1 minimum)
- Scalable text (min 200%)
- Alt text for all images
- Support for voice-over
- High contrast mode support

## 8. Assets

**App Identity**:
- `icon.jpg` - ReWired logo (head with leaf motif) - App icon
- `splash-icon.jpg` - Same logo - Launch screen

**Color Values Reference**:
```
Charcoal Grey: #333333
Muted Gold: #BFAF83  
Glowing Gold: #E6B800
Off-White: #F5F5F5
Pure White: #FFFFFF
Light Grey: #E0E0E0
Blue-Grey: #7A8A99
Success Green-Gold: #A8B07D
Error Brown-Grey: #8B7D6B
```

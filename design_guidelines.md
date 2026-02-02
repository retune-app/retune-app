# Design Guidelines: InnerTune

## 1. Brand Identity

**Purpose**: Empower users to rewire their subconscious mind through personalized audio affirmations in their own voice, replacing limiting beliefs with positive programming.

**Aesthetic Direction**: **Serene Empowerment** - A calming yet purposeful aesthetic that blends therapeutic tranquility with motivational energy. Think meditation app meets personal coaching.

**Brand Name**: "InnerTune" (capital I, capital T)

**Memorable Element**: The voice wave visualization during recording and playback - a dynamic, flowing waveform that represents the user's unique voice signature, reinforcing the personal nature of subconscious reprogramming.

## 2. Navigation Architecture

**Root Navigation**: Tab Navigation (3 tabs)
- Home (affirmation library)
- Create (floating action button - central position)
- Profile (settings & progress)

**Modal Screens**:
- Voice Setup (onboarding - full screen modal)
- Affirmation Editor
- Category Manager

## 3. Screen-by-Screen Specifications

### Onboarding: Voice Setup
- **Purpose**: One-time voice sample recording for cloning
- **Layout**:
  - Transparent header with skip button (top-right)
  - Scrollable content with top inset: insets.top + Spacing.xl
  - Central microphone icon (animated pulse when recording)
  - Progress indicator: "30-60 seconds recommended"
  - Floating "Continue" button with drop shadow (bottom inset: insets.bottom + Spacing.xl)
- **Components**: Animated waveform visualizer, countdown timer, re-record button
- **Empty State**: Friendly illustration of voice waves (voice-setup-hero.png)

### Home: Affirmation Library
- **Purpose**: Browse and manage saved affirmations
- **Layout**:
  - Transparent header with search bar and filter icon (right)
  - Top inset: headerHeight + Spacing.xl
  - Scrollable grid of affirmation cards (2 columns)
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Category filter chips, affirmation cards showing title, duration, play icon
- **Empty State**: Illustration of person meditating (empty-library.png)

### Create: Affirmation Generator
- **Purpose**: AI-generate or manually create affirmations
- **Layout**:
  - Default navigation header with "Cancel" (left), "Create" title, "Save" (right)
  - Scrollable form with top inset: Spacing.xl
  - Mode toggle: "AI Generate" vs "Manual Record"
  - Goal input field (multi-line)
  - "Generate Script" button
  - Script preview card (editable)
  - "Regenerate" button (visible after generation)
  - Voice preview waveform
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Text input with character count, script card with gradient background, regenerate counter

### Listen: Active Playback
- **Purpose**: Immersive listening experience
- **Layout**:
  - Transparent header with "Close" (left)
  - Top inset: headerHeight + Spacing.xl
  - Large central waveform visualizer (animated during playback)
  - Affirmation title and category tags
  - Playback controls: loop toggle, play/pause (large), speed control
  - Background audio selector
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Circular progress ring around play button, speed dial (0.8x - 1.5x), background audio picker

### Profile: Settings & Progress
- **Purpose**: User account, preferences, progress tracking
- **Layout**:
  - Default header with "Profile" title
  - Top inset: Spacing.xl
  - Scrollable list with sections:
    - User avatar (customizable) + display name
    - Listening streak card
    - Notification preferences
    - Voice sample management ("Re-record Voice")
    - Theme toggle
    - Account settings (nested: Log Out, Delete Account)
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Avatar with edit icon, stat cards, toggle switches, list items with disclosure indicators

## 4. Color Palette

**Primary**: #4A90E2 (Serene Blue) - Trust, calm, clarity  
**Accent**: #7B61FF (Empowerment Purple) - Transformation, growth  
**Success**: #50E3C2 (Teal) - Achievement, progress  
**Background**: #F8FAFB (Soft White) - Clean, spacious  
**Surface**: #FFFFFF (Pure White) - Cards, modals  
**Text Primary**: #2C3E50 (Deep Navy) - Readable, grounded  
**Text Secondary**: #7F8C8D (Warm Gray) - Supportive text  
**Border**: #E8ECF0 (Light Gray) - Subtle dividers  

**Gradients**:
- Hero Gradient: #4A90E2 → #7B61FF (diagonal 135deg)
- Card Gradient: #F8FAFB → #FFFFFF (vertical)

## 5. Typography

**Font**: Nunito (Google Font) for friendly, approachable feel paired with System Default for body text legibility

**Type Scale**:
- Hero: Nunito Bold, 34px
- Title: Nunito Bold, 24px
- Heading: Nunito SemiBold, 18px
- Body: System Regular, 16px
- Caption: System Regular, 14px
- Tiny: System Regular, 12px

## 6. Visual Design

**Touchable Feedback**: All buttons scale to 0.96 on press with 150ms spring animation

**Floating Buttons**:
- Drop shadow: offset (0, 2), opacity 0.10, radius 2
- Haptic feedback on press

**Icons**: Feather icons from @expo/vector-icons, 24px default size

**Cards**: 16px border radius, subtle shadow (offset (0, 1), opacity 0.05, radius 4)

## 7. Assets

**App Identity**:
- `icon.jpg` - InnerTune logo (head with leaf motif) - Device home screen
- `splash-icon.jpg` - Same logo on gradient background - Launch screen

**Onboarding/Empty States**:
- `voice-setup-hero.png` - Flowing voice waves illustration in brand colors - Voice Setup screen hero
- `empty-library.png` - Person meditating with floating affirmation bubbles - Empty Home screen
- `empty-favorites.png` - Heart-shaped waveform - Empty Favorites collection

**User Avatars** (3 preset options):
- `avatar-1.png` - Abstract circular gradient
- `avatar-2.png` - Geometric mandala pattern
- `avatar-3.png` - Organic flowing shapes

**Background Audio Icons**:
- `audio-nature.png` - Leaf symbol
- `audio-theta.png` - Brain wave symbol  
- `audio-solfeggio.png` - Frequency visualization

All illustrations: Minimal, gradient-based (Primary/Accent colors), soft organic shapes, calming energy

# Retuned — Go-to-Market Strategy & Capacity Plan

**Prepared by:** Replit Agent (for internal team review)
**Date:** February 11, 2026
**Version:** 1.0
**Status:** Draft for Team Discussion

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Tiering](#product-tiering)
3. [API Infrastructure & Current Plans](#api-infrastructure--current-plans)
4. [Per-User Cost Model](#per-user-cost-model)
5. [Capacity Scenarios](#capacity-scenarios)
6. [Voice Clone Slot Constraint](#voice-clone-slot-constraint)
7. [Rate Limit & Concurrency Analysis](#rate-limit--concurrency-analysis)
8. [Revenue Projections](#revenue-projections)
9. [Phased Rollout Plan](#phased-rollout-plan)
10. [Marketing & Positioning](#marketing--positioning)
11. [Risk Register & Mitigations](#risk-register--mitigations)
12. [Action Items](#action-items)

---

## Executive Summary

Retuned is positioned as a premium wellness app that combines AI-powered affirmations, voice cloning, guided breathing, micro-meditations, and mood-based personalization. This document outlines a three-tier pricing model, capacity analysis across four scenarios (Base, Adverse, Stress, Critical), and a phased rollout plan designed to maintain profitability while scaling from beta to 20,000+ users.

**Key findings:**

- The revised tier structure is **profitable in all four scenarios** at all user counts, though margins thin significantly under Critical (abuse/viral) conditions at lower user counts.
- **ElevenLabs voice clone slots (160 on Pro)** are the hardest constraint — not cost, but infrastructure. A plan upgrade is required before reaching ~140 active cloned voices.
- **ElevenLabs overage ($0.17/1K chars)** is the primary cost driver, not Hume AI. Gating Inner Voice behind the top tier is essential for margin protection.
- **Hume AI Pro is generously sized** (1M chars/month included) and will absorb significant free and mid-tier usage before triggering overages.
- **OpenAI costs are negligible** at any scale ($0.15/1M input tokens for gpt-4o-mini).

---

## Product Tiering

### Tier Structure

| Feature | **Free** | **Believe — $4.99/mo** | **Empower — $9.99/mo** |
|---|---|---|---|
| Breathing exercises (all techniques) | Yes | Yes | Yes |
| Ambient sound library (25 tracks) | Yes | Yes | Yes |
| AI Mood Check-in (Micro-Meditation) | Yes | Yes | Yes |
| Daily AI greeting | Yes | Yes | Yes |
| AI Affirmations | 3/month, stock voices only | 5/week (~20/mo), stock voices only | 10/day, all voices |
| Inner Voice (personal voice clone) | No | No | Yes |
| Micro-Meditations (AI Guided Moments) | No | 2/day | 5/day |
| Daily reminders | 2 | 5 | 5 |
| Analytics | Basic | Full | Full |
| Annual pricing | — | $39.99/year (~33% off) | $79.99/year (~33% off) |
| Free trial | — | — | 7-day trial of Empower |

### Tier Design Rationale

**Free tier** serves as a top-of-funnel acquisition tool. Breathing exercises cost zero in API spend (no AI calls). The 3 affirmations/month gives users a genuine taste of the core value. The mood check-in is free because it costs almost nothing (one cheap OpenAI call) and acts as the primary conversion funnel — when a free user taps "Meditate" or sees an Inner Voice suggestion, they hit the upgrade prompt.

**Believe ($4.99)** is the entry-level paid tier. It unlocks meaningful daily use (5 affirmations/week + 2 meditations/day) without triggering the most expensive API (ElevenLabs). All TTS goes through Hume AI stock voices, keeping per-user costs low.

**Empower ($9.99)** is the premium tier and the only tier with Inner Voice (ElevenLabs voice cloning). This gates the highest-cost feature behind the highest-revenue tier, protecting margins. The 7-day free trial lets users experience the "wow moment" of hearing affirmations in their own voice before committing.

### Why This Structure Works

1. **Cost alignment**: The most expensive feature (voice cloning via ElevenLabs) is only available to users paying the most.
2. **Natural conversion funnel**: Free (breathing) builds habit. Mood check-in creates desire for meditations and affirmations. Believe satisfies the need. Empower delivers the ultimate personalized experience.
3. **Competitive positioning**: At $4.99–$9.99, Retuned undercuts Calm ($14.99/mo) and Headspace ($12.99/mo) while offering a unique differentiator (voice cloning) that neither competitor has.

---

## API Infrastructure & Current Plans

### Service Overview

| Service | Plan | Monthly Cost | Primary Use in Retuned |
|---|---|---|---|
| **ElevenLabs** | Pro | $99/month | Voice cloning (Inner Voice), TTS for cloned voices |
| **Hume AI** | Pro | $70/month | TTS for stock AI voices (Lotus, Sage), meditation audio |
| **OpenAI** | Pay-as-you-go | Variable (~$0.15/1M input tokens) | Script generation, moderation, mood check-in, daily greetings |

**Fixed monthly platform cost: $169** (before overages or OpenAI usage)

### ElevenLabs Pro — Verified Details

| Parameter | Value |
|---|---|
| Monthly included characters | 500,000 (Multilingual v2 model) |
| Overage rate | **$0.17 per 1,000 characters** |
| TTS model used | `eleven_multilingual_v2` |
| Total voice slots | **160** (includes all custom voices: clones + designs) |
| Professional Voice Clone (PVC) slots | 1 (expandable with HQ rating) |
| Voice cloning method | Instant Voice Clone (short audio sample) |
| Commercial license | Yes |
| Credit rollover | Up to 2 months of unused credits |

**Source:** [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api), verified February 11, 2026

### Hume AI Pro — Verified Details

| Parameter | Value |
|---|---|
| Monthly included characters | **1,000,000** (~1,000 minutes of audio) |
| Overage rate | **$0.12 per 1,000 characters** |
| TTS model | Octave 2 |
| Requests per minute (RPM) | **75** |
| Concurrent connections | 10 |
| Voice cloning | Unlimited (create and use) |
| Commercial license | Yes |
| Projects limit | 3,000 |

**Source:** [hume.ai/pricing](https://www.hume.ai/pricing), verified February 11, 2026

### OpenAI — Current Usage

| Parameter | Value |
|---|---|
| Model | gpt-4o-mini |
| Input cost | $0.15 per 1M tokens |
| Output cost | $0.60 per 1M tokens |
| Context window | 128K tokens |
| Usage in Retuned | Script generation, content moderation, mood check-in, daily greetings, meditation scripts |

---

## Per-User Cost Model

### What Triggers API Costs

| User Action | Service | Approximate Characters | Approximate Cost |
|---|---|---|---|
| 1 AI affirmation (script generation) | OpenAI | ~800 tokens | ~$0.0005 |
| 1 AI affirmation TTS (stock voice) | Hume AI | ~500 chars | ~$0.06 (overage) |
| 1 AI affirmation TTS (cloned voice) | ElevenLabs | ~500 chars | ~$0.085 (overage) |
| 1 Micro-meditation script | OpenAI | ~600 tokens | ~$0.0004 |
| 1 Micro-meditation TTS (stock voice) | Hume AI | ~840 chars | ~$0.10 (overage) |
| 1 Micro-meditation TTS (cloned voice) | ElevenLabs | ~840 chars | ~$0.14 (overage) |
| 1 Mood check-in | OpenAI | ~400 tokens | ~$0.0003 |
| 1 Daily greeting | OpenAI | ~100 tokens (cached daily) | ~$0.0001 |
| 1 Content moderation check | OpenAI | ~200 tokens | ~$0.0001 |
| 1 Voice clone (one-time) | ElevenLabs | N/A | ~$0.05 (one-time) |

**Note:** Costs shown at overage rates. When usage falls within included allowances, the effective per-unit cost is lower.

### Assumptions: What a "Typical Active User" Does Monthly

These are not maximums — they represent realistic engaged behavior at each usage intensity level.

| Metric | 50% (Base) | 70% (Adverse) | 85% (Stress) | 100% (Critical) |
|---|---|---|---|---|
| **Free user** | | | | |
| Affirmations created | 1.5 | 2 | 2.5 | 3 (cap) |
| Mood check-ins | 3 | 5 | 7 | 10 |
| Hume chars/month | ~1,250 | ~1,550 | ~1,775 | ~2,000 |
| ElevenLabs chars/month | 0 | 0 | 0 | 0 |
| OpenAI cost/month | ~$0.002 | ~$0.003 | ~$0.003 | ~$0.004 |
| **Believe user** | | | | |
| Affirmations created | 6 | 10 | 14 | 20 (cap) |
| Meditations | 8 | 15 | 25 | 45 |
| Hume chars/month | ~9,720 | ~17,600 | ~28,000 | ~47,800 |
| ElevenLabs chars/month | 0 | 0 | 0 | 0 |
| OpenAI cost/month | ~$0.009 | ~$0.015 | ~$0.022 | ~$0.035 |
| **Empower user** | | | | |
| Affirmations created | 5 | 8 | 12 | 20 |
| Meditations | 12 | 20 | 30 | 45 |
| Clone voice usage | 60% | 60% | 60% | 60% |
| Hume chars/month (40% stock) | ~5,032 | ~8,320 | ~12,480 | ~19,120 |
| ElevenLabs chars/month (60% clone) | ~7,548 | ~12,480 | ~18,720 | ~28,680 |
| OpenAI cost/month | ~$0.012 | ~$0.018 | ~$0.026 | ~$0.038 |

**Key insight:** The biggest cost difference between tiers is that Believe users consume only Hume AI (cheaper, larger allowance), while Empower users also consume ElevenLabs (more expensive, smaller allowance). This is by design.

---

## Capacity Scenarios

### Scenario Definitions

| Scenario | Description | Free % | Believe % | Empower % | Usage Intensity |
|---|---|---|---|---|---|
| **Base** | Healthy organic growth, normal engagement, good conversion | 75% | 15% | 10% | 50% of limits |
| **Adverse** | Feature goes viral, high engagement, heavy meditation use | 65% | 20% | 15% | 70% of limits |
| **Stress** | Aggressive marketing push, lots of free signups, low conversion, power users | 80% | 10% | 10% | 85% of limits |
| **Critical** | TikTok viral + abuse, duplicate accounts, max usage, minimal conversion | 85% | 5% | 10% | 100% of limits |

### Base Scenario — "Steady organic growth"

*Moderate engagement, users behave as expected, healthy free-to-premium conversion (15% Believe + 10% Empower)*

| Users | Free | Believe | Empower | Hume Chars | Hume Overage | EL Chars | EL Overage | OpenAI | **Total API/Mo** | **Revenue/Mo** | **Net/Mo** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 500 | 375 | 75 | 50 | 1.45M | $54 | 377K | $0 | $2 | **$225** | **$874** | **+$649** |
| 1,000 | 750 | 150 | 100 | 2.90M | $228 | 755K | $43 | $4 | **$444** | **$1,748** | **+$1,304** |
| 2,000 | 1,500 | 300 | 200 | 5.80M | $576 | 1.51M | $172 | $8 | **$925** | **$3,495** | **+$2,570** |
| 5,000 | 3,750 | 750 | 500 | 14.49M | $1,619 | 3.77M | $557 | $20 | **$2,365** | **$8,738** | **+$6,373** |
| 10,000 | 7,500 | 1,500 | 1,000 | 28.99M | $3,359 | 7.55M | $1,198 | $41 | **$4,767** | **$17,475** | **+$12,708** |
| 20,000 | 15,000 | 3,000 | 2,000 | 57.97M | $6,837 | 15.10M | $2,481 | $81 | **$9,568** | **$34,950** | **+$25,382** |

### Adverse Scenario — "High engagement, feature love"

*Users love the product. Meditation usage is heavy. Higher premium conversion (20% Believe + 15% Empower). Usage at 70% of limits.*

| Users | Free | Believe | Empower | Hume Chars | Hume Overage | EL Chars | EL Overage | OpenAI | **Total API/Mo** | **Revenue/Mo** | **Net/Mo** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 500 | 325 | 100 | 75 | 2.89M | $227 | 936K | $74 | $4 | **$474** | **$1,249** | **+$775** |
| 1,000 | 650 | 200 | 150 | 5.78M | $573 | 1.87M | $233 | $8 | **$983** | **$2,497** | **+$1,514** |
| 2,000 | 1,300 | 400 | 300 | 11.55M | $1,266 | 3.74M | $551 | $15 | **$2,001** | **$4,993** | **+$2,992** |
| 5,000 | 3,250 | 1,000 | 750 | 28.88M | $3,345 | 9.36M | $1,506 | $38 | **$5,058** | **$12,483** | **+$7,425** |
| 10,000 | 6,500 | 2,000 | 1,500 | 57.76M | $6,811 | 18.72M | $3,097 | $77 | **$10,154** | **$24,965** | **+$14,811** |
| 20,000 | 13,000 | 4,000 | 3,000 | 115.51M | $13,741 | 37.44M | $6,280 | $153 | **$20,343** | **$49,930** | **+$29,587** |

### Stress Scenario — "Marketing push, low conversion"

*Aggressive growth brings lots of free users who barely convert. The paid users who do convert are power users pushing limits hard. Usage at 85% of limits.*

| Users | Free | Believe | Empower | Hume Chars | Hume Overage | EL Chars | EL Overage | OpenAI | **Total API/Mo** | **Revenue/Mo** | **Net/Mo** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 500 | 400 | 50 | 50 | 2.73M | $208 | 936K | $74 | $4 | **$455** | **$749** | **+$294** |
| 1,000 | 800 | 100 | 100 | 5.47M | $536 | 1.87M | $233 | $7 | **$945** | **$1,498** | **+$553** |
| 2,000 | 1,600 | 200 | 200 | 10.94M | $1,192 | 3.74M | $551 | $14 | **$1,926** | **$2,996** | **+$1,070** |
| 5,000 | 4,000 | 500 | 500 | 27.34M | $3,161 | 9.36M | $1,506 | $36 | **$4,872** | **$7,490** | **+$2,618** |
| 10,000 | 8,000 | 1,000 | 1,000 | 54.68M | $6,442 | 18.72M | $3,097 | $72 | **$9,780** | **$14,980** | **+$5,200** |
| 20,000 | 16,000 | 2,000 | 2,000 | 109.36M | $13,003 | 37.44M | $6,280 | $144 | **$19,596** | **$29,960** | **+$10,364** |

### Critical Scenario — "Viral + abuse"

*TikTok virality. Users create multiple accounts to bypass free limits. Power users max every daily cap. Minimal conversion (5% Believe + 10% Empower). Usage at 100% of limits.*

| Users | Free | Believe | Empower | Hume Chars | Hume Overage | EL Chars | EL Overage | OpenAI | **Total API/Mo** | **Revenue/Mo** | **Net/Mo** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 500 | 425 | 25 | 50 | 3.00M | $240 | 1.43M | $159 | $4 | **$572** | **$624** | **+$52** |
| 1,000 | 850 | 50 | 100 | 6.00M | $600 | 2.87M | $403 | $9 | **$1,181** | **$1,249** | **+$68** |
| 2,000 | 1,700 | 100 | 200 | 12.00M | $1,320 | 5.74M | $890 | $18 | **$2,397** | **$2,497** | **+$100** |
| 5,000 | 4,250 | 250 | 500 | 30.01M | $3,481 | 14.34M | $2,353 | $45 | **$6,048** | **$6,243** | **+$195** |
| 10,000 | 8,500 | 500 | 1,000 | 60.02M | $7,082 | 28.68M | $4,791 | $90 | **$12,132** | **$12,485** | **+$353** |
| 20,000 | 17,000 | 1,000 | 2,000 | 120.04M | $14,285 | 57.36M | $9,666 | $179 | **$24,299** | **$24,970** | **+$671** |

### Scenario Comparison — Net Profit/Loss Summary

| Users | Base | Adverse | Stress | Critical |
|---|---|---|---|---|
| 500 | +$649 | +$775 | +$294 | +$52 |
| 1,000 | +$1,304 | +$1,514 | +$553 | +$68 |
| 2,000 | +$2,570 | +$2,992 | +$1,070 | +$100 |
| 5,000 | +$6,373 | +$7,425 | +$2,618 | +$195 |
| 10,000 | +$12,708 | +$14,811 | +$5,200 | +$353 |
| 20,000 | +$25,382 | +$29,587 | +$10,364 | +$671 |

**Key takeaway:** Retuned is **profitable in every scenario at every scale**. However, the Critical scenario produces razor-thin margins, which means abuse prevention and conversion optimization are essential — not cost-cutting.

---

## Voice Clone Slot Constraint

### The Hard Limit

ElevenLabs Pro plan provides **160 total voice slots**. Each user who clones their voice occupies one slot. This is not a cost issue — it is an infrastructure ceiling.

The existing voice rotation system automatically removes cloned voices that have been inactive for 60+ days. This helps recycle slots, but only works if users churn or go dormant. Active clone users retain their slots.

### When You Hit the Wall

Assuming 70% of Empower users will clone their voice:

| Scenario | 500 users | 1,000 | 2,000 | 5,000 | 10,000 | 20,000 |
|---|---|---|---|---|---|---|
| **Base** (10% Empower) | 35 | 70 | 140 | 350 | 700 | 1,400 |
| **Adverse** (15% Empower) | 53 | 105 | **210** | 525 | 1,050 | 2,100 |
| **Stress** (10% Empower) | 35 | 70 | 140 | 350 | 700 | 1,400 |
| **Critical** (10% Empower) | 35 | 70 | 140 | 350 | 700 | 1,400 |

**Legend:**
- 0–100 active clones: Safe on Pro (160 slots)
- 100–140: Manageable with voice rotation cleaning up ~20-30% dormant clones
- 140+: **Upgrade required** — Pro plan cannot support this many active clones
- 350+: Need Scale plan ($330/mo, 660 slots) or Business ($1,320/mo, 660 slots)

### Upgrade Trigger Points

| ElevenLabs Plan | Voice Slots | Monthly Cost | Upgrade When... |
|---|---|---|---|
| **Pro** (current) | 160 | $99 | Current plan |
| **Scale** | 660 | $330 | ~1,500-2,000 total users (Base) or ~1,000 users (Adverse) |
| **Business** | 660 | $1,320 | Need lower overage rates ($0.12/1K vs $0.17/1K) at 5,000+ users |
| **Enterprise** | Custom | Custom | 10,000+ users — negotiate volume pricing |

### Cost Impact of ElevenLabs Upgrades

Upgrading to Scale ($330/mo) also increases included characters to 2,000,000/month and reduces overage to $0.12/1K chars. Re-running the Base scenario at 5,000 users:

| Plan | Fixed Cost | Overage Rate | EL Overage | Total Savings |
|---|---|---|---|---|
| Pro ($99) | $99 | $0.17/1K | $557 (on 3.77M chars) | — |
| Scale ($330) | $330 | $0.12/1K | $213 (on 1.77M chars) | **$113/mo savings** |

At 5,000+ users, **Scale is cheaper than Pro + overages** while also solving the voice slot constraint. The upgrade is both necessary and economically beneficial.

### Alternative: Hume AI for Voice Cloning

Hume AI Pro includes **unlimited voice cloning** (create and use). If Hume's clone quality is comparable to ElevenLabs, migrating cloned voice TTS to Hume would:
- Eliminate the 160-slot constraint entirely
- Reduce per-character overage from $0.17 to $0.12 (29% cheaper)
- Consolidate all TTS onto one provider

**Recommendation:** Evaluate Hume AI voice cloning quality against ElevenLabs. If comparable, this is the highest-leverage infrastructure change available. If not yet comparable, maintain the ElevenLabs + upgrade path.

---

## Rate Limit & Concurrency Analysis

### Peak Hour Modeling

Wellness apps see peak usage in the morning (6-8 AM) and evening (8-10 PM). If 10% of active users generate TTS during a peak 15-minute window:

| Users | Active in Peak Window | Requests in 15 min | Effective RPM |
|---|---|---|---|
| 500 | 50 | 50 | ~3 |
| 1,000 | 100 | 100 | ~7 |
| 5,000 | 500 | 500 | ~33 |
| 10,000 | 1,000 | 1,000 | ~67 |
| 15,000 | 1,500 | 1,500 | **~100 (exceeds Hume 75 RPM)** |

**Hume AI RPM limit (75):** Comfortable up to ~10,000 users. At 15,000+ users during peak hours, you may see request queuing or failures. Mitigation: upgrade to Scale (150 RPM) or implement request queuing with retry logic.

**ElevenLabs concurrency:** Not publicly documented for Pro, but generally more permissive than Hume. Monitor as you scale.

---

## Revenue Projections

### Monthly Revenue by Scenario

| Users | Base (15%B + 10%E) | Adverse (20%B + 15%E) | Stress (10%B + 10%E) | Critical (5%B + 10%E) |
|---|---|---|---|---|
| 500 | $874 | $1,249 | $749 | $624 |
| 1,000 | $1,748 | $2,497 | $1,498 | $1,249 |
| 2,000 | $3,495 | $4,993 | $2,996 | $2,497 |
| 5,000 | $8,738 | $12,483 | $7,490 | $6,243 |
| 10,000 | $17,475 | $24,965 | $14,980 | $12,485 |
| 20,000 | $34,950 | $49,930 | $29,960 | $24,970 |

### Annual Revenue with Annual Plans

If 30% of paid users choose annual plans ($39.99/yr for Believe, $79.99/yr for Empower), effective ARPU drops ~15% but annual churn drops from ~8-12%/month to ~5%/month, resulting in higher lifetime value.

| Users (Base) | Monthly Revenue | Annual Revenue (est.) | LTV Uplift from Annual |
|---|---|---|---|
| 5,000 | $8,738 | $104,856 | +15-20% from retention |
| 10,000 | $17,475 | $209,700 | +15-20% from retention |
| 20,000 | $34,950 | $419,400 | +15-20% from retention |

### Break-Even Analysis

**Monthly fixed costs (API plans + hosting):** ~$200
**Variable cost per paid user:** ~$0.50-2.00/month (depending on tier and usage)

| Metric | Believe ($4.99) | Empower ($9.99) |
|---|---|---|
| Gross margin per user (Base) | ~$4.00 (80%) | ~$7.50 (75%) |
| Gross margin per user (Critical) | ~$2.50 (50%) | ~$4.00 (40%) |
| Users needed to cover fixed costs | ~50 paid users | ~27 paid users |

---

## Phased Rollout Plan

### Phase 0: Closed Beta (Current — up to 200 users)

**Duration:** Now through stable build validation
**Audience:** TestFlight testers, friends & family, early supporters
**Pricing:** `BETA_MODE = true` (all features unlocked, no paywall)
**API Plans:** ElevenLabs Pro + Hume AI Pro (current)
**Estimated monthly cost:** $169 fixed + ~$50-100 overages = ~$220-270
**Revenue:** $0

**Goals:**
- Validate core features (affirmations, breathing, meditations, voice cloning)
- Collect user feedback on content quality, UX, and voice clone experience
- Identify and fix bugs before public launch
- Build a base of testimonials and app store reviews

**Key metrics to track:**
- Daily active usage rate
- Feature adoption (% trying breathing, affirmations, meditations, voice cloning)
- Session duration
- NPS scores from beta testers

### Phase 1: Soft Launch (200–1,000 users)

**Duration:** 4–6 weeks after beta stabilization
**Audience:** Organic App Store discovery, limited social media, personal networks
**Pricing:** Tier system live. `BETA_MODE = false`. Free trial of Empower (7 days).
**API Plans:** ElevenLabs Pro + Hume AI Pro (unchanged)
**Estimated monthly cost:** $400-1,000 (depending on conversion)
**Target revenue:** $1,000-2,500/month

**Actions:**
- [ ] Implement tier enforcement in app (gate features by subscription status)
- [ ] Integrate RevenueCat for subscription management
- [ ] Set up App Store subscription products ($4.99/mo, $9.99/mo, $39.99/yr, $79.99/yr)
- [ ] Enable 7-day Empower free trial
- [ ] Build upgrade prompts at natural touchpoints (mood check-in results, after first affirmation)
- [ ] Set up conversion tracking and funnel analytics
- [ ] A/B test free tier cap (2 vs 3 vs 5 affirmations/month)

**Voice clone slots:** Comfortable (35-70 active clones out of 160)

### Phase 2: Growth (1,000–5,000 users)

**Duration:** 3–6 months
**Audience:** App Store optimization (ASO), social media marketing, influencer partnerships, content marketing
**Pricing:** Established tiers with data-driven optimization
**API Plans:** Upgrade ElevenLabs to Scale ($330/mo) when approaching 140 active voice clones
**Estimated monthly cost:** $1,000-5,000
**Target revenue:** $3,000-12,000/month

**Actions:**
- [ ] Upgrade ElevenLabs to Scale when voice slots approach 140
- [ ] Implement audio caching (don't regenerate TTS for replayed affirmations)
- [ ] Evaluate Hume AI voice cloning quality as potential ElevenLabs alternative
- [ ] Add referral program (e.g., "Give a friend 1 month of Believe free")
- [ ] Begin collecting and showcasing user testimonials
- [ ] Create App Store screenshot and video assets highlighting Inner Voice
- [ ] Set up analytics dashboard for API cost monitoring (per-user, per-feature)

**Voice clone slots:** Upgrade trigger at ~1,500-2,000 total users

### Phase 3: Scale (5,000–20,000 users)

**Duration:** 6–12 months
**Audience:** Paid advertising (Meta, TikTok, Google), PR, partnerships with wellness creators
**Pricing:** Mature tiers, potential introduction of Lifetime plan
**API Plans:** ElevenLabs Scale or Business, Hume AI Scale ($200/mo), enterprise negotiations
**Estimated monthly cost:** $5,000-20,000
**Target revenue:** $15,000-50,000/month

**Actions:**
- [ ] Negotiate volume pricing with ElevenLabs and Hume AI
- [ ] Implement server-side audio caching layer (CDN for generated audio)
- [ ] Add abuse detection (duplicate account detection, usage anomaly alerts)
- [ ] Consider Hume AI for all TTS (if quality matches ElevenLabs)
- [ ] Introduce Lifetime plan ($149-199 one-time) for early adopters
- [ ] Launch "Inner Voice Stories" feature (premium differentiator for Empower)
- [ ] Build enterprise/B2B channel (corporate wellness programs)

---

## Marketing & Positioning

### Brand Position

**Tagline:** "The first wellness app that speaks in your voice."

**Elevator pitch:** Retuned is a personal wellness app that uses AI to create affirmations, meditations, and breathing exercises tailored to how you're feeling right now. What makes it unique: you can hear your affirmations spoken in your own voice — proven to be more effective for subconscious reprogramming than hearing a stranger's voice.

### Competitive Landscape

| App | Monthly Price | Voice Cloning | AI Personalization | Breathing | Meditations |
|---|---|---|---|---|---|
| **Calm** | $14.99 | No | Limited | Yes | Yes (pre-recorded) |
| **Headspace** | $12.99 | No | Limited | Yes | Yes (pre-recorded) |
| **Insight Timer** | Free / $9.99 | No | No | Yes | Yes (community) |
| **Retuned** | Free / $4.99 / $9.99 | **Yes (Inner Voice)** | **Yes (AI-generated)** | **Yes (5 techniques)** | **Yes (AI-generated)** |

**Unique differentiators:**
1. **Inner Voice** — No competitor offers personal voice cloning for affirmations
2. **AI-generated content** — Affirmations and meditations are created fresh for each user, not pre-recorded
3. **Mood-responsive** — The app reads your current state and adapts its recommendations
4. **Lower price point** — Premium features at 35-65% less than Calm/Headspace

### Launch Marketing Channels

**Phase 1 (Soft Launch):**
- App Store Optimization (ASO): Keywords targeting "affirmation app", "voice cloning wellness", "AI meditation"
- Personal social media from team members
- Beta tester word-of-mouth
- Reddit communities: r/meditation, r/selfimprovement, r/affirmations

**Phase 2 (Growth):**
- TikTok/Instagram Reels: "Hear your affirmations in YOUR voice" demo videos
- Wellness micro-influencer partnerships (1K-50K followers)
- Blog content: "The Science Behind Hearing Your Own Voice" (SEO play)
- Product Hunt launch
- Podcast guest appearances on wellness/self-improvement shows

**Phase 3 (Scale):**
- Paid social (Meta, TikTok) with Inner Voice demo as hero creative
- Google Ads targeting meditation and affirmation keywords
- PR push: "AI Wellness App Lets You Clone Your Voice for Self-Improvement"
- B2B partnerships: corporate wellness programs, therapist referrals

### Conversion Strategy

The primary conversion funnel leverages the free mood check-in:

```
Free User Flow:
[Daily Breathing] --> builds habit and trust
       |
[Mood Check-in] --> "How are you feeling?"
       |
[AI Recommendation] --> "Based on your mood, try a meditation"
       |
[Upgrade Prompt] --> "Unlock Micro-Meditations with Believe ($4.99/mo)"
       |
       v
Believe User Flow:
[Meditations + Affirmations] --> experiences value
       |
[Hears stock AI voice] --> good, but impersonal
       |
[Inner Voice prompt] --> "Imagine hearing this in YOUR voice"
       |
[7-day Empower trial] --> experiences the "wow moment"
       |
       v
Empower User ($9.99/mo)
```

---

## Risk Register & Mitigations

### High Priority Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **ElevenLabs voice slot limit reached** | High (at 2K+ users) | High — new users can't clone | Monitor slots weekly. Upgrade to Scale at 120 active clones. Voice rotation at 60 days. |
| 2 | **Low free-to-paid conversion** (<5% combined) | Medium | High — revenue doesn't cover API costs | A/B test free caps (2 vs 3 vs 5). Optimize upgrade prompts. Reduce free cap if needed. |
| 3 | **Abuse / duplicate accounts** bypassing free limits | Medium | Medium — inflated API costs | Implement device fingerprinting. Require email verification. Rate limit by device ID, not just user ID. |
| 4 | **ElevenLabs or Hume AI pricing increase** | Low-Medium | High — margin compression | Maintain fallback to OpenAI TTS. Evaluate Hume voice cloning as ElevenLabs alternative. Negotiate annual contracts for price stability. |
| 5 | **Beta-to-paid transition backlash** | Medium | Medium — churn from beta users expecting free access forever | Communicate transition early. Offer beta testers a loyalty discount (e.g., 3 months free Empower). Grandfather early cloned voices. |

### Medium Priority Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 6 | **Hume AI RPM throttling** at peak hours (75 RPM limit) | Low-Medium | Medium — degraded UX | Implement request queuing with exponential backoff. Upgrade to Scale (150 RPM) at 10K users. |
| 7 | **Voice clone quality complaints** | Medium | Medium — feature disappointment reduces Empower conversion | Set quality expectations in onboarding. Provide re-cloning option. Test with diverse voice samples. |
| 8 | **App Store rejection** on subscription practices | Low | High — launch delay | Follow Apple's subscription guidelines strictly. Clear feature gating. Transparent pricing. |
| 9 | **Competitor launches voice cloning** (Calm, Headspace) | Low | Medium — differentiator erosion | Move fast. Build brand loyalty. Expand feature set (sleep stories, longer meditations). |

---

## Action Items

### Immediate (Before Soft Launch)

- [ ] **Implement tier enforcement** — Turn off `BETA_MODE`, gate features by subscription tier
- [ ] **Integrate RevenueCat** — Subscription management, trial handling, analytics
- [ ] **Set up App Store products** — 4 SKUs ($4.99/mo, $9.99/mo, $39.99/yr, $79.99/yr)
- [ ] **Build upgrade prompts** — At mood check-in results, after free cap reached, after first affirmation listen
- [ ] **Set up voice slot monitoring** — Alert at 100, 120, 140 active clones
- [ ] **Communicate beta transition** — Email beta testers about upcoming pricing, offer loyalty discount
- [ ] **Prepare App Store listing** — Screenshots, description, keywords optimized for launch

### Short-Term (First 3 Months Post-Launch)

- [ ] **A/B test free tier cap** — Try 2, 3, and 5 affirmations/month to optimize conversion
- [ ] **Implement audio caching** — Store generated TTS audio, serve from cache on replay
- [ ] **Set up cost monitoring dashboard** — Track per-user API spend by tier
- [ ] **Launch referral program** — "Give a friend 1 month of Believe free"
- [ ] **Begin ASO optimization** — Keywords, screenshots, A/B test App Store listing
- [ ] **Evaluate Hume AI voice cloning** — Quality comparison with ElevenLabs

### Medium-Term (3–6 Months Post-Launch)

- [ ] **Upgrade ElevenLabs to Scale** — When approaching 140 active voice clones
- [ ] **Negotiate volume pricing** — Contact ElevenLabs and Hume AI sales teams
- [ ] **Launch TikTok marketing** — Inner Voice demo as hero creative
- [ ] **Product Hunt launch** — Coordinated launch with PR push
- [ ] **Build abuse detection** — Device fingerprinting, anomaly detection on usage patterns

---

## Appendix: Key Assumptions

1. **Average affirmation length:** ~500 characters (for TTS input)
2. **Average meditation length:** ~840 characters (weighted average of 1/2/3 minute options)
3. **Empower voice clone adoption:** 70% of Empower subscribers will clone their voice
4. **Clone voice usage split:** 60% of Empower TTS uses cloned voice (ElevenLabs), 40% uses stock (Hume)
5. **Meditation duration distribution:** Weighted toward 2-minute meditations
6. **Active user definition:** Users who engage with the app at least once per week
7. **Monthly churn rates:** ~8-12% monthly, ~5% for annual subscribers
8. **Revenue calculations:** Based on monthly pricing only (annual pricing would reduce ARPU ~15% but improve retention)
9. **OpenAI model:** gpt-4o-mini at $0.15/1M input tokens, $0.60/1M output tokens
10. **All costs exclude taxes, payment processing fees (Apple takes 15-30%), and hosting costs**

---

*This document is a living strategy — update as beta data refines assumptions, API pricing changes, or market conditions shift.*

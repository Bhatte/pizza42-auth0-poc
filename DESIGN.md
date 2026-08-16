---
name: Pizza 42
description: A calm, trustworthy pizza ordering experience with visible identity state.
colors:
  ink: "oklch(23% 0.018 55)"
  ink-soft: "oklch(43% 0.018 55)"
  paper: "oklch(97% 0.014 82)"
  paper-deep: "oklch(93% 0.022 80)"
  surface: "oklch(99% 0.008 82)"
  line: "oklch(83% 0.025 75)"
  accent: "oklch(56% 0.16 37)"
  accent-hover: "oklch(49% 0.15 37)"
  accent-soft: "oklch(91% 0.045 42)"
  success: "oklch(45% 0.105 145)"
  success-soft: "oklch(93% 0.035 145)"
  warning: "oklch(55% 0.11 72)"
  warning-soft: "oklch(93% 0.055 80)"
  danger: "oklch(47% 0.16 28)"
  danger-soft: "oklch(94% 0.04 28)"
  focus: "oklch(58% 0.18 250)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(3.2rem, 6.6vw, 6.8rem)"
    fontWeight: 850
    lineHeight: 0.88
    letterSpacing: "-0.075em"
  heading:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2.2rem, 4vw, 3.8rem)"
    fontWeight: 850
    lineHeight: 0.95
    letterSpacing: "-0.06em"
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.35rem"
  pill: "999px"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "0.875rem"
  lg: "1.25rem"
  xl: "1.75rem"
  2xl: "2.5rem"
  3xl: "3.75rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.78rem 1.15rem"
    height: "2.875rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.78rem 1.15rem"
    height: "2.875rem"
  status-pill:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 0.8rem"
  order-ticket:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.75rem"
---

# Design System: Pizza 42

## 1. Overview

**Creative North Star: "The neighbourhood counter at 7pm"**

Pizza 42 feels like a well-run local counter during the dinner rush: warm, direct and precise about the order. Paper-toned surfaces, assertive editorial typography and receipt-like details give it a food-service identity without putting a fast-food costume over the product. The interface stays useful at a glance on a phone while preserving enough technical evidence for an interview-panel walkthrough.

Ordering is visually primary. Verification and authorization states sit directly beside the action they affect, in plain language. Technical evidence is available in one deliberate inspector after the customer journey; raw token values never become decoration. The system explicitly rejects dark cyber-security dashboards, neon accents, generic red-and-yellow fast-food templates, repeated SaaS card grids, glassmorphism and inflated marketing claims.

**Key Characteristics:**

- Warm paper neutrals with near-black ink and a reserved terracotta action color.
- Heavy, tightly tracked headings balanced by calm, readable body copy.
- Flat menu rhythm, tactile order-ticket surfaces and explicit status language.
- Responsive flow down to 320 CSS pixels with visible focus and reduced-motion support.

## 2. Colors

Warm neutrals carry almost the entire interface; terracotta marks ordering, while green, amber and red appear only for their semantic states.

### Primary

- **Counter Terracotta:** Primary calls to action, the brand mark and small section labels. Its deeper partner is reserved for hover and active feedback.
- **Terracotta Wash:** Low-emphasis accent surfaces where a filled action color would be too strong.

### Neutral

- **Pizza Ink:** Primary text, borders on decisive controls and structural emphasis.
- **Soft Ink:** Supporting copy, metadata and quiet actions.
- **Receipt Paper:** The page field and default customer-facing canvas.
- **Deep Paper:** Subtle separation between adjacent neutral regions.
- **Counter Surface:** Elevated order tickets, controls and high-contrast neutral content.
- **Flour Line:** Dividers, quiet outlines and list rhythm.

### Semantic

- **Kitchen Green / Soft Green:** Verified and available states, always paired with an icon or text.
- **Check Amber / Soft Amber:** Email verification needed and other recoverable attention states.
- **Oven Red / Soft Red:** Blocking errors only; never a promotional accent.
- **Focus Blue:** A high-contrast keyboard focus ring that stays distinct from ordering and status colors.

**The Ten Percent Rule.** Counter Terracotta occupies no more than ten percent of a screen. It signals action, not atmosphere.

**The No Fast-Food Costume Rule.** Never pair large saturated red and yellow surfaces or use promotional color blocks as a substitute for hierarchy.

## 3. Typography

**Display Font:** Inter (with the native UI sans-serif stack)
**Body Font:** Inter (with the native UI sans-serif stack)
**Label Font:** Inter (with the native UI sans-serif stack)

**Character:** One type family carries the experience so loading is resilient and identity screens feel native. Personality comes from confident weight, unusually tight display tracking and restrained uppercase operational labels.

### Hierarchy

- **Display** (850, fluid 3.2–6.8rem, 0.88 line-height): Guest hero statements only.
- **Headline** (850, fluid 2.2–3.8rem, 0.95 line-height): Menu and account-history section anchors.
- **Title** (800, 1.25–1.6rem, compact): Product names, tickets and inline recovery headings.
- **Body** (400, 1rem, 1.55 line-height): Explanations and task copy, kept near 65–72 characters where layout permits.
- **Label** (800, 0.72rem, 0.12em tracking, uppercase): Operational context such as kitchen, ticket and verification labels.

**The Plain-Language Rule.** Customer-facing security states use normal words before protocol terms. Protocol names belong in technical evidence and documentation.

## 4. Elevation

The system is flat by default. Tonal layers, fine borders and whitespace establish most structure. One broad, low-opacity raised shadow belongs to physically lifted surfaces—the desktop order ticket and guest receipt—and is removed where a single-column mobile flow makes depth unnecessary.

### Shadow Vocabulary

- **Raised Ticket** (`0 1.5rem 4rem oklch(23% 0.018 55 / 0.12)`): Desktop basket and receipt surfaces only.

**The State-Only Rule.** Motion and elevation explain state changes. Decorative entrances and orchestrated page loads are prohibited.

## 5. Components

### Buttons

- **Shape:** Compact rectangular controls with an 0.5rem radius and a minimum height of 2.875rem.
- **Primary:** Counter Terracotta on Counter Surface text, with 0.78rem by 1.15rem padding and a strong 760 weight.
- **Hover / Focus:** Hover deepens the accent and lifts by one pixel; focus uses a three-pixel Focus Blue outline with a three-pixel offset; active returns to the baseline.
- **Secondary / Quiet:** Secondary controls use a Pizza Ink border and invert on hover. Quiet controls retain the Flour Line border and gain a neutral surface.

### Chips

- **Style:** Fully rounded, compact and semantic. Verification uses a soft semantic background plus matching icon and text.
- **State:** Green means verified; amber means action is still needed. Neither state depends on color alone.

### Cards / Containers

- **Corner Style:** 0.875rem for recovery and technical panels; 1.35rem for the order ticket.
- **Background:** Counter Surface over Receipt Paper, with Deep Paper for subtle tonal separation.
- **Shadow Strategy:** Raised Ticket only where the surface behaves like an object above the page.
- **Border:** One-pixel Flour Line by default; Pizza Ink around the order ticket.
- **Internal Padding:** 1.25–1.75rem on compact panels and up to 2.5rem on wide recovery surfaces.

### Inputs / Fields

- **Style:** Native-font controls on Counter Surface with a one-pixel Flour Line stroke and 0.5rem radius.
- **Focus:** The global Focus Blue outline is mandatory and must not be replaced by color-only border changes.
- **Error / Disabled:** Error copy remains inline. Disabled ordering controls retain readable contrast and explain their prerequisite in adjacent copy.

### Navigation

- **Style:** A sparse, border-bottom application bar with the circular tilted 42 mark, plain account context and a quiet underlined sign-out action. On narrow screens the email text collapses before any primary task control.

### Menu Row

Menu rows are flat list entries, not cards. Sequence number, product copy, price and add action form one scan line on desktop and a compact two-dimensional grid on mobile. Category labels use the operational label style.

### Order Ticket

The ticket is the signature working surface: strong outline, generous radius, authoritative total and quantity controls. It is sticky beside the menu on desktop and returns to normal document flow on mobile.

## 6. Do's and Don'ts

### Do:

- **Do** keep ordering, verification recovery and authoritative totals visible without opening a modal.
- **Do** use the extracted spacing scale and preserve 44 CSS pixel touch targets wherever practical.
- **Do** pair semantic color with an icon and explicit text.
- **Do** give keyboard focus the same visual weight as hover with the Focus Blue outline.
- **Do** label the marketing view "Simulated Segment destination" everywhere it appears.

### Don't:

- **Don't** build a dark cyber-security dashboard with neon accents, token rain or hacker imagery.
- **Don't** build a generic fast-food template from bright red and yellow promotional panels.
- **Don't** turn the experience into a SaaS landing page made from repeated icon cards, gradient text or inflated claims.
- **Don't** use glassmorphism, decorative side-stripe borders or shadows on every container.
- **Don't** expose raw tokens by default or imply an ID token authorizes the API.
- **Don't** hide checkout failures in temporary toasts or disabled controls without recovery guidance.

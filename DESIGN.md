---
name: Orbit
description: A project management platform that blends traditional kanban task tracking with AI agent orchestration.
colors:
  accent:
    "#CF513D"
  accent-hover:
    "#b84330"
  accent-soft:
    "oklch(62% 0.22 27 / 0.08)"
  surface-bg:
    "#F6F6F7"
  surface-elevated:
    "#FFFFFF"
  surface-border:
    "#E5E5EA"
  surface-muted:
    "#8E8E93"
  text-primary:
    "#1C1C1E"
  text-secondary:
    "#64748b"
  semantic-blue:
    "#2563EB"
  semantic-green:
    "#22C55E"
  semantic-purple:
    "#7C3AED"
  semantic-red:
    "#ef4444"
  semantic-amber:
    "#f59e0b"
typography:
  display:
    fontFamily: "Montserrat, Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Montserrat, Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Montserrat, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Montserrat, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Montserrat, Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "#FFFFFF"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-outlined-hover:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  input:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  input-focus:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
  card:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.lg}"
    padding: "18px"
  card-hover:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
---

# Design System: Orbit

## 1. Overview

**Creative North Star: "The Warm Workshop"**

Orbit is a project manager's workshop: organized, well-lit, and purposeful. Every surface exists to support the work, not decorate it. The visual system rejects cold corporate sterility and developer-tool rawness in favor of warm precision; technical capability wrapped in approachable, human-friendly design.

The interface sits in a bright, neutral space (`surface-bg`) with occasional warm terracotta accents that signal action, progress, and humanity. Cards lift gently on hover, never demanding attention at rest. Typography is confident but not loud, using a single sans-serif family (Montserrat) for cohesion across all text roles. The overall mood is one of calm competence: a tool that feels like it was built by people who understand the work.

**Key Characteristics:**
- Warm neutrals with a single terracotta accent used sparingly and purposefully
- Flat surfaces at rest, gentle lift on interaction
- Generous whitespace with consistent 8px base spacing
- Rounded corners (8px–16px) that soften edges without feeling playful
- Montserrat throughout, with JetBrains Mono reserved for code and technical metadata
- Dark mode as a full inversion, not an afterthought

## 2. Colors

The palette is intentionally restrained: a warm neutral surface scale, one terracotta accent, and a small set of semantic colors for status and priority. The character is "welcoming warmth" (the terracotta) grounded by "cool clarity" (the slate neutrals).

### Primary
- **Terracotta** (`#CF513D` / oklch(62% 0.22 27)): The brand accent. Used for primary actions, active states, hover borders, and the ambient glow on auth pages. Its rarity is the point: it should appear on ≤10% of any given screen.
- **Terracotta Hover** (`#b84330` / oklch(56% 0.22 27)): Darker shade for hover and pressed states on accent elements.
- **Terracotta Soft** (`oklch(62% 0.22 27 / 0.08)`): Subtle background tint for active sidebar items, selected states, and soft highlights.

### Neutral
- **Surface Background** (`#F6F6F7`): The canvas. Light, barely warm gray that avoids the harshness of pure white. Used for page backgrounds and empty space.
- **Surface Elevated** (`#FFFFFF`): Cards, modals, drawers, and any surface that sits above the background. White is allowed here because it is always bordered or shadowed, never floating raw.
- **Surface Border** (`#E5E5EA`): Dividers, card borders, input strokes. Light enough to recede, present enough to define.
- **Surface Muted** (`#8E8E93`): Secondary text, placeholders, inactive icons. The "whisper" color.
- **Text Primary** (`#1C1C1E`): Headlines, primary content, active navigation. Near-black with a touch of warmth.
- **Text Secondary** (`#64748b`): Body text, descriptions, metadata. Mid-gray that maintains readability without competing.

### Semantic
- **Semantic Blue** (`#2563EB`): Links, in-progress status, informational cues.
- **Semantic Green** (`#22C55E`): Done, success, positive confirmation.
- **Semantic Purple** (`#7C3AED`): Agentic indicators, AI presence, brainstorm mode.
- **Semantic Red** (`#ef4444`): Errors, destructive actions, blocked status.
- **Semantic Amber** (`#f59e0b`): Warnings, pending review, caution.

### Named Rules
**The One Accent Rule.** The terracotta accent is used on ≤10% of any given screen. Its rarity signals importance. If a screen feels "orange," the accent is overused.

**The No Pure Black Rule.** Never use `#000000` or `#FFFFFF` as a background. Surface Background (`#F6F6F7`) is the light-mode canvas; dark mode inverts to `#0B1221`.

## 3. Typography

**Display Font:** Montserrat, Inter, system-ui, sans-serif
**Body Font:** Montserrat, Inter, system-ui, sans-serif (same family; differentiation through weight and size)
**Mono Font:** JetBrains Mono, monospace

**Character:** Montserrat is geometric but humanist enough to feel friendly rather than sterile. It carries weight confidently at small sizes, making it ideal for dense product UI. JetBrains Mono is crisp and technical without being aggressive, used sparingly for code, slugs, and system metadata.

### Hierarchy
- **Display** (700, 1.5rem / 24px, line-height 1.2): Page titles, workspace names, major headings. Used sparingly.
- **Headline** (600, 1.25rem / 20px, line-height 1.3): Section titles, modal headers, card group labels.
- **Title** (600, 1rem / 16px, line-height 1.4): Card titles, task names, item labels.
- **Body** (400, 0.875rem / 14px, line-height 1.5): Descriptions, comments, form helper text. Max line length: 65ch.
- **Label** (500, 0.75rem / 12px, line-height 1.4, letter-spacing 0.01em): Form labels, button text, badge content, metadata. Sentence-case, never all-caps.
- **Mono** (400, 0.8125rem / 13px, line-height 1.6): Code blocks, repository names, slugs, technical IDs.

### Named Rules
**The Sentence Case Rule.** All labels, buttons, and navigation items use sentence case. All-caps is forbidden; it feels like a developer tool or government form.

**The No Micro-Type Rule.** `text-[10px]` and smaller are prohibited. The minimum readable size is 0.75rem (12px). If content doesn't fit at 12px, the design has too much density, not a type problem.

## 4. Elevation

Orbit is flat by default. Surfaces sit at the same elevation as the background; depth is conveyed through tonal layering (white cards on gray backgrounds) rather than persistent shadows. Shadows appear only as a response to state: hover, focus, or drag.

### Shadow Vocabulary
- **Rest** (`box-shadow: none`): Default state for all cards, buttons, and inputs.
- **Hover Lift** (`box-shadow: 0 4px 24px rgba(0,0,0,0.08)`): Applied to cards and project items on hover. Paired with a 1px upward translate for tactile feedback.
- **Drag Ghost** (`box-shadow: 0 8px 32px rgba(0,0,0,0.12)`): Applied to kanban cards during drag operations.
- **Modal Overlay** (`background: rgba(28, 28, 30, 0.5)`): Solid tinted overlay behind modals and drawers. No backdrop blur; glassmorphism is prohibited.
- **Agentic Glow** (`box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.08), 0 4px 12px rgba(99, 102, 241, 0.06)`): Subtle purple ambient shadow for agent-assigned tasks. Not a drop shadow; a soft glow.

### Named Rules
**The Flat-By-Default Rule.** Surfaces do not cast shadows at rest. If a card has a shadow without being hovered, focused, or dragged, the shadow is too heavy.

**The No Glassmorphism Rule.** Never use `backdrop-filter: blur()` for overlays. Use solid tinted backgrounds (`bg-surface-900/50`) to maintain clarity and avoid performance issues.

## 5. Components

For each component, lead with a short character line, then specify shape, color assignment, states, and any distinctive behavior.

### Buttons
- **Character:** Warm and solid. Buttons feel like physical controls: firm, responsive, clearly clickable.
- **Shape:** Rounded-lg (8px radius), py-2.5 px-3.5 padding.
- **Primary:** Terracotta background (`bg-accent`), white text, white stroke for icons. Hover shifts to `accent-hover`.
- **Outlined:** Transparent background, 1px accent border, accent text. Hover fills with `accent-soft`.
- **Disabled:** Light gray background (`bg-gray-400` or `bg-primary-400` depending on variant), not-allowed cursor, no hover state change.
- **Loading:** Spinner replaces prefix icon, button remains clickable area.

### Inputs / Fields
- **Character:** Clean and open. Inputs feel like invitations to type, not like locked boxes.
- **Style:** White background, 2px border (`border-gray-200`), rounded-lg (8px). Height: 40px.
- **Focus:** Border shifts to semantic color (primary blue by default), no glow ring. Background stays white.
- **Error:** Border shifts to `error-500`, background tints to `error-50`, error message appears below in `text-error-500 text-xs`.
- **Disabled:** `bg-gray-100` background, `cursor-not-allowed`.
- **Label:** `text-sm font-semibold text-gray-700`, sentence case, positioned above the input with 6px margin.

### Cards / Containers
- **Character:** Calm surfaces that come alive on interaction.
- **Corner Style:** Rounded-xl (12px) for project cards, rounded-lg (8px) for kanban cards.
- **Background:** White (`bg-white`) in light mode, `surface-100` in dark mode.
- **Border:** 1px `surface-200` border. Never shadow at rest.
- **Hover:** Border shifts to `accent`, `shadow-lg` appears, card translates up 1px. Duration: 150ms ease-out.
- **Internal Padding:** 18px for project/agent cards, 12px for kanban task cards.

### Navigation (Sidebar)
- **Character:** Quiet wayfinding. Items recede when inactive, warm up when active.
- **Style:** 12px font, medium weight, `surface-500` text. Hover: `surface-900` text + `surface-100` background.
- **Active:** `surface-900` text, semibold, `accent-soft` background, 3px left accent border.
- **Group Headers:** 10px font, uppercase, `surface-400`, tracking-wider. (Exception: sidebar group headers are the only allowed uppercase text.)

### Kanban Column
- **Character:** Organized lanes with clear boundaries.
- **Style:** `surface-50` background, 1px `surface-200` border, rounded-lg (8px), min-width 260px, max-width 330px.
- **Header:** Task count badge in `surface-100` background, `surface-500` text, rounded-full.
- **Drop Target:** Dashed border (`surface-300`), `surface-50` background, 40% opacity on ghost card.

### Modal / Drawer
- **Character:** Firm interruption. No ambiguity about being in a modal state.
- **Overlay:** Solid `surface-900/50` tint, no blur.
- **Modal Box:** White, rounded-xl (12px), 440px max-width, shadow-lg, max-height 90vh with overflow-y-auto.
- **Drawer Panel:** Fixed right, 440px width, white, shadow-lg, slides in from right with 200ms ease-out transform.

### Agentic Badge
- **Character:** A colleague's presence, not a robot's.
- **Style:** Inline-flex, 10px font, semibold, `primary-500` text, `primary-500/6` background, 1px `primary-500/12` border, rounded-full.
- **Dot:** 6px circle, `green-500` fill, 1.5s ease-in-out pulse animation (opacity 1 → 0.4, scale 1 → 0.75).

## 6. Do's and Don'ts

### Do:
- **Do** use sentence case for all labels, buttons, and navigation. No exceptions outside sidebar group headers.
- **Do** keep body text at 0.875rem (14px) minimum and labels at 0.75rem (12px) minimum. No micro-typography.
- **Do** use the terracotta accent sparingly: primary actions, active states, hover borders, and subtle ambient glows only.
- **Do** ensure dark mode inverts the surface scale fully. Test every new component in both themes.
- **Do** use `surface-50` for page backgrounds and white for elevated surfaces in light mode.
- **Do** apply hover states to interactive cards: border-color shift to accent + shadow-lg + 1px translate-up.
- **Do** use semantic colors consistently: blue for progress/info, green for done, purple for agentic, red for errors, amber for warnings.
- **Do** provide keyboard focus rings (`focus-visible`) for all interactive elements.

### Don't:
- **Don't** use all-caps text. It reads as shouting or developer-tool aesthetic.
- **Don't** use `text-[10px]`, `text-[11px]`, or any size below 0.75rem. If it doesn't fit, redesign the layout.
- **Don't** use glassmorphism (`backdrop-filter: blur`) for modal overlays or decorative cards. Use solid tinted overlays.
- **Don't** use side-stripe borders (border-left > 1px as colored accent) on cards, list items, or alerts. The sidebar active state is the only exception.
- **Don't** use gradient text or background-clip text. Use solid colors and weight/size for emphasis.
- **Don't** use the hero-metric template (big number, small label, gradient accent). Orbit is not a SaaS dashboard cliché.
- **Don't** use identical card grids with icon + heading + text repeated endlessly. Vary card structure by content type.
- **Don't** default to modals for every secondary action. Exhaust inline, progressive, and drawer alternatives first.
- **Don't** use `#000000` or `#FFFFFF` as backgrounds. Always use `surface-50` or `surface-bg`.
- **Don't** create nested cards (a card inside a card). One level of elevation is enough.

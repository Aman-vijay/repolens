---
name: RepoLens
description: Precise and high-density developer dashboard. Clean slate-black surfaces, sharp borders, and high-visibility blue anchors. Focus on readability, code density, and structured navigation.

colors:
  # Surfaces & Ground
  background: "hsl(0 0% 4%)"        # Urushi deep black / page ground
  foreground: "hsl(0 0% 98%)"       # Near white text
  card: "hsl(0 0% 7%)"              # Surface card panels
  popover: "hsl(0 0% 7%)"           # Popovers / menus
  
  # Accents
  primary: "hsl(217 91% 60%)"       # High-visibility blue anchor / CTA / links
  secondary: "hsl(0 0% 10%)"         # Dark gray secondary actions / hover states
  accent: "hsl(0 0% 10%)"           # Interactive subtle highlights
  destructive: "hsl(0 72% 51%)"     # Error/destructive state
  
  # Borders & Controls
  border: "hsl(0 0% 12%)"           # Hairline panel borders
  input: "hsl(0 0% 12%)"            # Input backgrounds
  ring: "hsl(217 91% 60%)"          # Focus ring
  
  # Muted States
  muted: "hsl(0 0% 10%)"
  muted-foreground: "hsl(0 0% 45%)" # Captions, secondary labels, disabled text

typography:
  family:
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace"
  sizes:
    title: "1.5rem"
    body: "0.875rem"
    caption: "0.75rem"
    code: "0.75rem"
  weights:
    normal: 400
    medium: 500
    semibold: 600
    bold: 700

rounded:
  lg: "0.5rem"                       # 8px (default cards)
  md: "0.375rem"                     # 6px (inputs / buttons)
  sm: "0.25rem"                      # 4px (badges)
  none: "0"

components:
  card:
    backgroundColor: "hsl(var(--card))"
    borderColor: "hsl(var(--border))"
    rounded: "var(--radius)"
    padding: "1.5rem"
  button-primary:
    backgroundColor: "hsl(var(--primary))"
    textColor: "hsl(var(--primary-foreground))"
    rounded: "calc(var(--radius) - 2px)"
    padding: "0.5rem 1rem"
  input-text:
    backgroundColor: "hsl(var(--input))"
    borderColor: "hsl(var(--border))"
    textColor: "hsl(var(--foreground))"
    rounded: "calc(var(--radius) - 2px)"
    padding: "0.5rem 0.75rem"
---

# Design System: RepoLens

## 1. Overview: Developer-Centric High-Density Layouts

RepoLens uses a clean, high-density dark mode designed to minimize cognitive load when navigating complex codebases.

### Key Characteristics
- **Visual Restraint**: No glowing gradients, neon AI sparkles, or heavy card drop-shadows. Space is structured using borders and subtle background shade transitions.
- **Code Priority**: Code-related elements (file paths, signatures, code listings) use a clear monospace font with high contrast.
- **Functional Accentuation**: Blue (`hsl(217, 91%, 60%)`) is reserved exclusively for interactive elements (links, CTAs, selections, and primary actions).
- **Spatial Alignment**: Tight padding and small corner radii (8px down to 4px) to maximize on-screen content density.

## 2. Core Layout & Grids

- **Workspace Dashboard**: Standard top nav bar with a 2-column or 3-column layout. Left column for navigation (e.g. file tree, status), right/center columns for primary actions (code view, semantic search results).
- **Line Heights & Text Wrap**: Paragraph text uses `text-wrap: pretty` and headings use `text-wrap: balance` to prevent awkward wrapping.
- **Tables and Trees**: Tree nodes use left border offsets and indentations rather than nested cards. Lists are flat with thin borders separating rows.

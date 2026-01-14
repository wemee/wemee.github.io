# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev          # Start dev server at localhost:4321
npm run dev -- --host  # Dev server accessible on LAN (for mobile testing)
npm run build        # Build static site to dist/
npm run preview      # Preview production build locally
```

## Project Architecture

This is an Astro 5 static site (wemee.github.io) using Bootswatch Solar theme with Bootstrap 5.

### Directory Structure
- `src/pages/` - File-based routing (game/, math/, tools/, blog/)
- `src/layouts/BaseLayout.astro` - Single layout with SEO meta tags, OG tags, and JSON-LD structured data
- `src/components/Navbar.astro` - Navigation with dropdowns for each section
- `src/content/blog/` - Markdown blog posts with frontmatter schema defined in `src/content/config.ts`
- `src/lib/` - TypeScript logic separated from UI
- `public/` - Static assets served directly

### TypeScript Library Structure (`src/lib/`)
- `games/` - Game logic classes (BreakoutGame, StairsGame) with shared types and utilities
  - `types.ts` - Shared interfaces (Particle, GameState, KeyState)
  - `GameUtils.ts` - Shared functions (overlay, particles, drawing helpers)
- `math/` - Math visualization classes (VectorVisualizer, TrafficSimulator)
- `image.ts` - Image processing utilities for tools

### Key Patterns
- **BaseLayout Props**: All pages use `<BaseLayout title="..." description="...">` wrapper. For blog posts, pass `articleDate`, `articleAuthor`, and `articleTags` for proper SEO metadata
- **Path aliases**: Use `@/*` to reference `src/*` (configured in tsconfig.json)
- **Blog schema**: Posts require `title`, `pubDate`, `description` in frontmatter; `author`, `tags`, `image` optional
- **Canvas Apps**: Use class-based pattern with constructor taking canvasId and callbacks, handle devicePixelRatio for Retina displays, use requestAnimationFrame for game loops

### Canvas/Visualization Class Pattern
```typescript
class MyVisualizer {
  constructor(canvasId: string, callbacks?: { onUpdate?: (state) => void }) {
    // Get canvas, setup DPR scaling, init event listeners
  }
  private setupCanvas(): void { /* Handle devicePixelRatio */ }
  private render(): void { /* Main draw loop */ }
  public destroy(): void { /* Cleanup event listeners */ }
}
```

## Adding New Pages

1. Create `.astro` file in appropriate `src/pages/` subdirectory
2. Wrap content with `<BaseLayout title="Page Title" description="SEO description">`
3. **Manually update** `src/components/Navbar.astro` to add navigation link
4. Update relevant index page (`math/index.astro`, `game/index.astro`, `tools/index.astro`)

## Adding New Games/Visualizations

1. Create class in `src/lib/games/` or `src/lib/math/`
2. Use shared types from `src/lib/games/types.ts` if applicable
3. Import and instantiate in page's `<script>` block with `document.addEventListener('DOMContentLoaded', ...)`

## Deployment

Pushes to `main` branch auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. The workflow runs `npm ci && npm run build` and deploys `dist/`.

## ML Training (`ml-training/`)

Machine learning training code lives separately from the web frontend. Each project has its own subdirectory with independent Python virtual environments.

### Directory Structure
- `ml-training/mnist/` - MNIST handwritten digit recognition (TensorFlow → TensorFlow.js)
- `ml-training/stairs-rl/` - Stairs game reinforcement learning (PyMiniRacer + Stable Baselines3)

### Stairs RL Architecture

The Stairs game supports headless training via a separated core:

```
src/lib/games/
├── StairsGameCore.ts     # Pure logic (no DOM/Canvas) - shared by browser & training
└── StairsGame.ts         # Browser version, uses Core + handles rendering

ml-training/stairs-rl/
├── dist/StairsGameCore.js  # Compiled core for PyMiniRacer
├── stairs_env.py           # Gymnasium environment wrapper
└── train.py                # Training script
```

### Build Commands for RL

```bash
# Build game core for Python training
npm run build:rl-core

# Run training (from ml-training/stairs-rl/)
cd ml-training/stairs-rl
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python train.py
```

### Key Principle

Game logic is maintained **only in TypeScript** (`StairsGameCore.ts`). Python uses PyMiniRacer (V8 engine) to run the same code, ensuring 100% numerical consistency between training and browser deployment.


# Calculus Subsection — Handoff

This file documents the `/math/calculus/` subsection so any future Claude
session can pick up modifications without re-deriving context.

## What's here

6-page teaching subsection covering single-variable through intro
multivariable calculus. 5 pages use Canvas 2D; the gradient page uses
Three.js. Pages mirror the structure of `/math/linalg/` (sibling
handoff at `src/pages/math/linalg/CLAUDE.md`).

| Slug             | Chapter | Tech       | Scene class           |
|------------------|---------|------------|-----------------------|
| `slope-tangent`  | 1       | Canvas 2D  | `SlopeTangentScene`   |
| `chain-rule`     | 1       | Canvas 2D  | `ChainRuleScene`      |
| `riemann`        | 2       | Canvas 2D  | `RiemannScene`        |
| `ftc`            | 2       | Canvas 2D  | `FTCScene`            |
| `taylor`         | 3       | Canvas 2D  | `TaylorScene`         |
| `gradient`       | 3       | Three.js   | `GradientScene`       |

Live at https://wemee.github.io/math/calculus/

## File map

```
src/
├── components/
│   └── CalcPageNav.astro         # prev/next + supplements; used by every page
├── styles/
│   └── calculus.css              # Shared input/control styles. Imported
│                                 # by every page. Defines .calc-input,
│                                 # .calc-readout, .calc-slider, .calc-chip,
│                                 # .calc-btn. Class names are namespaced
│                                 # with .calc- prefix to avoid colliding
│                                 # with linalg.css's .m-input etc.
│                                 # Always edit here, not in page <style>.
├── lib/math/calculus/
│   ├── calculusPages.ts          # CALCULUS_PAGES (curriculum order) +
│   │                             # SUPPLEMENTS (extensibility hook).
│   │                             # Append to CALCULUS_PAGES when adding
│   │                             # Chapter 4 (NN applications).
│   ├── Canvas2DBase.ts           # Abstract base: DPR scaling, ResizeObserver,
│   │                             # rAF-deduped render, destroy cleanup.
│   │                             # All 2D scenes extend this.
│   ├── presets.ts                # FUNCTION_PRESETS — 1D functions for
│   │                             # slope-tangent / chain-rule / riemann /
│   │                             # ftc / taylor. Each has f, fPrime, range,
│   │                             # optional yRange, optional taylor coef gen.
│   ├── presets3d.ts              # FUNCTION_PRESETS_3D — 2-variable presets
│   │                             # for gradient page. Each has f, fx, fy,
│   │                             # range, optional zRange.
│   ├── SlopeTangentScene.ts      # Function + secant line + tangent line
│   ├── ChainRuleScene.ts         # Two stacked plots: f and g∘f, shared x
│   ├── RiemannScene.ts           # Function + n rectangles (left/mid/right)
│   ├── FTCScene.ts               # Top: f(t) with shaded area; bottom: F(x)
│   │                             # with tangent. F is precomputed via
│   │                             # midpoint quadrature into a sample cache.
│   ├── TaylorScene.ts            # f curve + T_n polynomial approximation
│   └── GradientScene.ts          # Three.js: 3D surface + gradient arrow +
│                                 # direction arrow + slope bar. Z-up camera.
└── pages/math/calculus/
    ├── index.astro               # Subsection entry (cards)
    ├── slope-tangent.astro
    ├── chain-rule.astro
    ├── riemann.astro
    ├── ftc.astro
    ├── taylor.astro
    ├── gradient.astro            # Uses `gradient-container` div (not canvas)
    └── CLAUDE.md                 # This file
```

## How to extend

### Add a supplementary reading to a page
Edit `src/lib/math/calculus/calculusPages.ts`:
```typescript
export const SUPPLEMENTS: Record<string, Supplement[]> = {
  riemann: [
    { label: "為什麼中點比較準", description: "$O(h^2)$ vs $O(h)$ 的幾何證明" },
    { label: "3Blue1Brown 積分章節", href: "https://...", description: "影片版" },
  ],
};
```
Entries show up automatically in a "📚 補充閱讀" box on the page (rendered
by `CalcPageNav`).

### Edit teaching content on a page
Open the page's `.astro` file. Teaching content is in `<section class="mt-12 max-w-3xl mx-auto prose-content">`
below the main interactive grid. Math notation uses the `tex()` helper:
- Inline: `<span set:html={tex('f(x) = x^2')} />`
- Display: `<div class="my-4 flex justify-center" set:html={tex('...', true)} />`

### Edit a function preset
- 1D presets (slope-tangent, chain-rule, riemann, ftc, taylor):
  `src/lib/math/calculus/presets.ts` — `FUNCTION_PRESETS`
- 3D presets (gradient): `src/lib/math/calculus/presets3d.ts` —
  `FUNCTION_PRESETS_3D`

Each preset entry shape:
- 1D: `{ id, label, f, fPrime, range, yRange?, taylor? }` — taylor is a
  `(a, n) => coefficient` generator; only set for functions with clean
  closed-form expansions (parabola, cubic, sin, cos, exp, reciprocal).
  Taylor page filters to presets with `taylor` defined.
- 3D: `{ id, label, f, fx, fy, range, zRange? }` — partial derivatives
  must be exact (closed-form), not numerical.

### Add a brand-new page (e.g. Chapter 4: 神經網路應用)
1. Create `src/pages/math/calculus/<slug>.astro` (copy structure from
   `slope-tangent.astro` for 2D or `gradient.astro` for 3D)
2. Add the entry to `CALCULUS_PAGES` in `calculusPages.ts` (controls
   prev/next order)
3. Add `SUPPLEMENTS[slug] = []` to the map in same file
4. Add a card to `src/pages/math/calculus/index.astro` (`tools` array)
5. Add a dropdown entry to `src/components/Navbar.astro` under the
   `📐 微積分專區` block
6. Include `<CalcPageNav slug="..." />` at the bottom of the new page

### Add a new Scene class
If the new visualisation is unlike existing ones, create
`src/lib/math/calculus/<Name>Scene.ts`. Extend `Canvas2DBase` for 2D
(get DPR scaling + resize + rAF dedup for free). For 3D, model on
`GradientScene.ts` — it inlines its own Three.js boilerplate rather than
extending a base, mirroring the linalg pattern.

## Conventions

### TDZ trap with element refs (IMPORTANT)
**Every page declares its element refs BEFORE constructing the scene.**
The scene's constructor synchronously calls `emitUpdate()` → `onUpdate` →
`renderState()`, which reads element refs. If they're declared after
`new ...Scene(...)`, they're in the Temporal Dead Zone and throw a
ReferenceError that silently kills the rest of the DOMContentLoaded
callback (including all slider/preset listeners).

This was discovered live during slope-tangent dev. The fix is purely
ordering — keep this pattern when copying a page:

```ts
document.addEventListener('DOMContentLoaded', () => {
  // 1. Element refs first
  const xSlider = document.getElementById('x-slider') as HTMLInputElement;
  // ... all refs ...

  function renderState(state) { /* reads refs */ }

  // 2. NOW safe to create scene
  const scene = new MyScene({ canvasId: '...', onUpdate: renderState });

  // 3. Listeners
});
```

### Math
- 1D ground truth: each preset's `f` and `fPrime` are the source of
  truth. Numerical derivatives via finite differences only used as
  cross-checks (e.g. FTC's `topFpx`).
- Integration (riemann, ftc): midpoint rule. Ground-truth integral in
  `RiemannScene` uses 10 000 sub-intervals; `FTCScene` caches F samples
  at 200 plot-grid points via 200-sub-interval midpoint rule per point.
- Taylor coefficients come from the preset's `taylor(a, n)` generator,
  not numerical differentiation. For sin/cos, that's
  `sin(a + nπ/2) / n!` etc. — closed-form, no rounding.
- Gradient (3D): preset's `fx`, `fy` are exact closed-form partials.
  `|∇f|` and angle computed from those; directional derivative is
  `fx·cosθ + fy·sinθ` — the dot product of ∇f with v.

### Canvas 2D rendering
- All Canvas2DBase subclasses draw in CSS-pixel coordinates (DPR is
  already applied via `ctx.scale` in `setupCanvas`).
- World-to-screen helpers are scene-private — each scene defines its
  own `worldToScreen` because plot layout (margins, sub-rect splits)
  varies between scenes.
- Functions are sampled at 200–320 points. Curves are stroked as one
  polyline with `started = false` resets on non-finite samples so
  poles (like 1/(1-x) at x=1) break the line cleanly.
- Stacked sub-plots (chain-rule, ftc): use a `PlotRect` interface to
  carry the rect bounds + y-range together; the draw functions take
  rect explicitly so the same code handles top/bottom.

### Three.js (gradient page only)
- **Z is the height axis.** `camera.up.set(0, 0, 1)` overrides Three.js's
  default y-up so OrbitControls orbits around Z. Without this the
  surface tilts in screen space.
- Surface is a deformed `PlaneGeometry` (80×80 segments) translated so
  its centre aligns with the function's domain centre. Vertex colours
  use a low→mid→high palette from height (z) values.
- Wireframe overlay is built from a separate 14×14 `PlaneGeometry`
  (coarser than the fill mesh — wireframe at 80 segments is visual noise).
- Gradient arrow: `THREE.ArrowHelper`, length capped at 2.0 world units
  so very steep gradients don't escape the plot.
- Direction arrow: always unit length on xy-plane.
- Slope bar: a `THREE.Line` from `(x₀+cosθ, y₀+sinθ, 0)` up to
  `(..., D_v f)`. Visualises "walk one unit, z changes by D_v f".
- Render-on-demand: `scheduleRender()` queues a single rAF. OrbitControls
  fires `change` events on every micro-movement, which calls
  `scheduleRender` — so damping easing keeps ticking without a free loop.

### Astro
- Every page uses `<BaseLayout currentPage="math" title="..." description="...">`.
- Page-level `<script>` uses ESM imports from `@/lib/math/calculus/...`.
- KaTeX is SSR-only: `import katex from 'katex'` in frontmatter,
  `katex.renderToString(s, { displayMode })`, inject via `set:html`.
  No client KaTeX bundle.
- Module scripts in Astro are deferred and run before DOMContentLoaded
  fires, so the `document.addEventListener('DOMContentLoaded', ...)`
  wrapper IS necessary (otherwise the scripts execute too early — though
  in practice this matters less than the TDZ issue above).

### Teaching copy style
- Traditional Chinese (zh-TW), Taiwan vocabulary.
- 「」 for quotes; ASCII punctuation inside math.
- Tone: 直白、避免微積分術語密集轟炸。Use analogies (e.g., 「站在山坡上、
  哪個方向最陡」for gradient).
- Each page ends with: 🎮 動手試試 + 💡 為什麼 / 🚀 應用 section.
- KaTeX equations use `\\dfrac` for inline-ish fractions.

### Page sections (top to bottom)
1. Back link to `/math/calculus/`
2. Hero (chapter label + title + tagline)
3. Main grid: `lg:col-span-2` canvas/container on left, controls stack on right
4. Legend chips below canvas
5. Teaching content in `<section class="mt-12 max-w-3xl mx-auto prose-content">`
6. `<CalcPageNav slug="..." />`

## What's intentionally NOT covered

- **Limit definition / ε–δ rigour**: skipped because the explorable
  visualisation makes the limit feel intuitive without the symbolic machinery.
  Mentioned in passing on slope-tangent.
- **Improper integrals / convergence tests**: out of scope for an intro arc.
- **Differential equations**: too big a topic; would be its own subsection.
- **Multivariable integrals (double, triple, line, surface)**: deferred to
  a possible future expansion. The gradient page touches multivariable but
  only the differential side.
- **Tangent plane visualisation on gradient page**: could be added but
  decided the arrow + slope bar reads more clearly than a tilted patch.
- **Drag-on-canvas for x₀** (slope-tangent etc.): slider-only for now;
  mobile touch interactions need careful design.

## Planned but not shipped: Chapter 4 — 神經網路應用

Discussed with the owner — to be added later. Three planned pages:
- `backprop` — small 2-2-1 NN, forward + backward pass with the chain rule
  highlighted on each edge. (Canvas 2D, ~200 lines)
- `gradient-descent` — 3D loss surface; SGD / Momentum / Adam trajectories.
  (Three.js, can reuse `GradientScene` boilerplate)
- `activation-zoo` — sigmoid / ReLU / tanh / softmax + their derivatives
  side-by-side. (Canvas 2D, simpler)

When shipping Ch4: append entries to `CALCULUS_PAGES`, add cards on the
index, add to Navbar. The infrastructure (CalcPageNav, presets, base
classes) already supports adding pages without changes.

## Pages linked TO from this subsection

- `gradient.astro` links to `/math/calculus/chain-rule` (for backprop preview)
- `gradient.astro` links to `/math/dot-product` (geometry of D_v f = ∇f · v)
- `gradient.astro` links to `/math/linalg/` (SVD / max singular vector)
- `taylor.astro` links to `/math/fourier` (Taylor vs Fourier as different bases)

## Common modifications (recipes)

### "The teaching paragraph about X is wrong"
Find the paragraph in the page's `.astro` file inside the
`<section class="mt-12 max-w-3xl mx-auto prose-content">` block. Edit.

### "Add a preset to the function picker"
1D: append to `FUNCTION_PRESETS` in `presets.ts`. The new preset will show
on every page that filters for it. Check each page's frontmatter for
`presetSubset` filter (e.g. slope-tangent skips reciprocal because of pole).

3D: append to `FUNCTION_PRESETS_3D` in `presets3d.ts`. Auto-appears on
gradient page.

### "The default x range / step is too small"
Edit the page's `<input type="range">` `min`/`max`/`step` attributes
directly; the script overrides them at runtime from the preset's range
anyway, so the HTML defaults only show for the initial preset.

### "Reorder curriculum"
Reorder `CALCULUS_PAGES` in `calculusPages.ts`. `CalcPageNav` recomputes
prev/next automatically. Card order on `/math/calculus/` index is
independent — edit `tools` array in `index.astro` separately if you
want both in sync.

## Debugging tips

- **Sliders don't react / readouts stay at "—"**: Element refs declared
  after `new ...Scene(...)`. See "TDZ trap" above. Always declare refs
  first.
- **Canvas blank**: container has 0 dimensions at construction. CSS
  `height: 60vh; min-height: 420px` should always give non-zero, but
  check if anything is `display: none` until JS toggles it.
- **Numbers showing `-0`**: `formatTick` in scenes normalizes near-zero
  to `'0'`. If you see `-0`, the value didn't go through `formatTick`.
- **Three.js surface looks tilted**: `camera.up.set(0, 0, 1)` missing.
- **KaTeX raw text**: `set:html=` missing on the receiving element.
- **`taylor` page missing presets**: only presets with `taylor` field
  appear (page filters by `typeof p.taylor === 'function'`). Add a
  `taylor: (a, n) => ...` generator to presets you want to expose.

## Git history quick reference

- Branch landed: `feat(calculus)/<TBD on commit>` — Step 1: foundations
  (calculusPages.ts, CalcPageNav, Canvas2DBase, calculus.css, presets);
  Step 2: slope-tangent + index (incl. TDZ bug discovery and fix);
  Steps 3a–d: chain-rule, riemann, ftc, taylor; Step 4: gradient (3D);
  Step 5: navbar + math/index wiring + this handoff.

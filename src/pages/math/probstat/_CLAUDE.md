# Probability & Statistics Subsection — Handoff

This file documents the `/math/probstat/` subsection so any future Claude
session can pick up modifications without re-deriving context. Mirrors the
structure of the sibling handoffs at `src/pages/math/linalg/CLAUDE.md` and
`src/pages/math/calculus/CLAUDE.md`.

## What's here

6-page teaching subsection plus an interactive 擲骰子 hero on the index.
All 6 pages use Canvas 2D (no Three.js). Pages mirror the structure of
`/math/calculus/` (Canvas2DBase + per-scene draw + KaTeX-typeset teaching
copy).

| Slug             | Chapter | Scene class           | Notable                          |
|------------------|---------|-----------------------|----------------------------------|
| `distributions`  | 1       | `DistributionScene`   | 5 distributions, PMF/PDF + CDF   |
| `lln-clt`        | 1       | `LLNCLTScene`         | Mode toggle (LLN / CLT), 4 sources |
| `bayes`          | 2       | `BayesScene`          | Beta-Binomial conjugate          |
| `mle`            | 2       | `MLEScatterScene` + `MLEContourScene` (share `MLEModel`) | Drag-on-canvas points |
| `markov`         | 3       | `MarkovScene`         | M-H animation, 4 target densities |
| `entropy`        | 3       | `EntropyScene`        | Drag-on-canvas bars, 2 distributions |

Plus `index.astro` with `DiceScene` (1d6 / 2d6 simulator).

Live at https://wemee.github.io/math/probstat/

## File map

```
src/
├── components/
│   └── MathPageNav.astro       # prev/next + supplements; used by every page
├── styles/
│   └── probstat.css                # Shared input/control styles. `.ps-` prefixed
│                                   # to avoid colliding with .calc-* / .m-* in
│                                   # the other two subsections. Imported by every
│                                   # page including index.
├── lib/math/probstat/
│   ├── mathSections.ts            # MATH_SECTIONS.probstat.pages (curriculum order) +
│   │                               # SUPPLEMENTS map (extensibility hook).
│   ├── Canvas2DBase.ts             # DPR scaling, ResizeObserver, rAF-deduped
│   │                               # render, destroy. Duplicated from calculus/
│   │                               # — extract to src/lib/math/Canvas2DBase.ts
│   │                               # if a third subsection appears.
│   ├── mathHelpers.ts              # PDF/PMF/CDF for 5 distributions + Beta;
│   │                               # samplers (Box-Muller, Knuth Poisson,
│   │                               # inverse-transform exp); logGamma (Lanczos),
│   │                               # erf (A&S 7.1.26); fmt() display helper.
│   ├── DiceScene.ts                # 1d6 / 2d6 simulator (used on index)
│   ├── DistributionScene.ts        # PMF/PDF top + CDF bottom, 5 distributions
│   ├── LLNCLTScene.ts              # Top: source dist; Bottom: running mean (LLN)
│   │                               # or sample-mean histogram + normal overlay (CLT)
│   ├── BayesScene.ts               # Beta(α, β) prior + posterior curves
│   ├── MLEScene.ts                 # Exports MLEModel (shared data) +
│   │                               # MLEScatterScene + MLEContourScene.
│   │                               # Both scenes subscribe via model.onChange().
│   ├── MarkovScene.ts              # 2D Metropolis-Hastings + heatmap background
│   └── EntropyScene.ts             # Two K=5 categorical bar charts side by side
└── pages/math/probstat/
    ├── index.astro                 # Subsection entry (cards) + 擲骰子 hero
    ├── distributions.astro
    ├── lln-clt.astro
    ├── bayes.astro
    ├── mle.astro
    ├── markov.astro
    ├── entropy.astro
    └── CLAUDE.md                   # This file
```

## How to extend

### Add a supplementary reading to a page
Edit `src/lib/math/probstat/mathSections.ts`:
```typescript
export const SUPPLEMENTS: Record<string, Supplement[]> = {
  bayes: [
    { label: "醫療檢測偽陽性的計算範例", description: "貝氏在 base-rate fallacy 上的應用" },
    { label: "3Blue1Brown · Bayes theorem", href: "https://...", description: "影片版" },
  ],
};
```
Entries auto-render in the "📚 補充閱讀" box rendered by `MathPageNav`.

### Edit teaching content on a page
Inside the page's `.astro`, in the `<section class="mt-12 max-w-3xl mx-auto prose-content">`
block. KaTeX via `tex(s, displayMode)` helper, inject with `set:html`.

### Add a new distribution to the `distributions` page
1. Add PDF/PMF/CDF/sampler to `mathHelpers.ts`.
2. Add `DistributionKind` literal in `DistributionScene.ts`.
3. Add a `case` to `pdfOrPMF`, `cdf`, `xRange`, `stats`.
4. Add to the `DISCRETE` set if applicable.
5. Add a button + a `[data-params]` block in `distributions.astro`.
6. Wire its sliders in the page's `<script>`.

### Add a target density to `markov`
1. Add a `TargetKind` literal in `MarkovScene.ts`.
2. Add an entry to the `TARGETS` map with energy fn, xRange/yRange, init point.
3. Add a button to `markov.astro`'s `target-list`.

### Add a brand-new page (e.g., Chapter 4: Hypothesis testing, Information geometry)
1. Create `src/pages/math/probstat/<slug>.astro` (copy `distributions.astro` as the
   template most-isolated-from-shared-data; copy `mle.astro` if you need a shared
   model across multiple canvases).
2. Add the entry to `MATH_SECTIONS.probstat.pages` in `mathSections.ts`.
3. Add `SUPPLEMENTS[slug] = []` to the map.
4. Add a card to `src/pages/math/probstat/index.astro`.
5. Add a dropdown entry to `src/components/Navbar.astro` under the
   `🎲 機率統計專區` block.
6. Include `<MathPageNav section="probstat" slug="..." />` at the bottom.

## Conventions

### TDZ trap with element refs (CRITICAL — same as calculus)
**Every page declares element refs BEFORE constructing the scene.** Scenes call
`emitUpdate()` synchronously in their constructor → onUpdate → renderState
reads refs. If refs are declared after `new ...Scene(...)`, they're in the
Temporal Dead Zone and throw a silent ReferenceError that kills the rest of
the DOMContentLoaded callback. See calculus CLAUDE.md for details.

### Pointer-drag interactions (mle, entropy)
Both pages use direct pointer event handlers on the canvas (not `mousedown`,
not React events). Pattern:
```ts
this.canvas.style.touchAction = 'none'; // disable pull-to-refresh on touch
this.canvas.addEventListener('pointerdown', handler);
// On hit, this.canvas.setPointerCapture(e.pointerId) — required so dragging
// outside the canvas still routes events here.
```
The MLE scene also uses `cursor: grab/grabbing` for affordance.

### Two-canvas pages (mle only)
`mle.astro` has two canvases (scatter + contour). Pattern:
1. Define a pure-data model class (`MLEModel`) with `onChange(fn)` subscription.
2. Define two scene classes; each takes the model in its constructor and
   subscribes to onChange to re-render.
3. The page calls `model.regenerate()` / `model.setNoiseSigma(...)`; both
   scenes update automatically.

Both scenes share the same canvas dimensions (set via CSS `height`), and
both extend `Canvas2DBase` (DPR + ResizeObserver each).

### Animation (lln-clt, markov, dice)
All three use a `requestAnimationFrame` loop that calls a per-frame step
function then `scheduleRender()`. Loops are guarded by an `isRunning` flag
so calling `toggleRun()` / `stop()` cleanly cancels.

Speed-per-frame varies by page:
- `DiceScene` — 10 rolls/frame (fixed) for ~600/sec
- `LLNCLTScene` — LLN scales steps with `n` (4 + n/200), CLT is 6 trials/frame
- `MarkovScene` — exposes a slider (1–50 steps/frame); default 4

### Math
- All entropy / KL / cross-entropy values are in **bits** (log base 2).
- Sample variance corrections (n vs n-1) not made — using "true" parameters for
  theoretical curves and treating empirical as descriptive only.
- MLE for linear regression uses closed-form OLS (no iterative optimizer).
- M-H acceptance is computed in log-space: `α = exp(curEnergy - proposedEnergy)`
  to avoid underflow with high-energy proposals.

### Canvas 2D rendering
Same conventions as calculus:
- CSS-pixel coords (DPR already applied in `Canvas2DBase.setupCanvas`).
- Each scene defines its own world-to-screen helpers; layout is too varied
  to share.
- Heatmaps (markov, mle-contour) cache an `ImageData` and only rebuild on
  target change / resize.

### Teaching copy style
- Traditional Chinese (zh-TW), Taiwan vocabulary.
- 「」 for quotes; ASCII punctuation inside math.
- Each page ends with 🎮 動手試試 + 💡 / 🚀 sections.
- KaTeX equations: `\\dfrac` for inline-friendly fractions.

### Page sections (top to bottom)
1. Back link to `/math/probstat/`
2. Hero (chapter label + title + tagline)
3. Main grid: `lg:col-span-2` canvas on left, controls stack on right
4. Legend chips below canvas
5. Teaching content in `<section class="mt-12 max-w-3xl mx-auto prose-content">`
6. `<MathPageNav section="probstat" slug="..." />`

## What's intentionally NOT covered

- **Confidence intervals / hypothesis testing / p-values**: visually static
  (a bar plus thresholds). Could be added as a Chapter 4 page but the value
  is marginal compared to the existing six.
- **Bootstrap**: thematically overlaps with `lln-clt` (re-sampling means).
  Skipped for now.
- **Numerical Beta CDF inversion** (for credible intervals on `bayes`): would
  require Newton iteration on regularized incomplete Beta. Pages show prior
  mean / posterior mean / observed rate instead.
- **Higher-dimensional MCMC**: 2D is the right balance for a single-canvas
  visualization. HMC / NUTS / parallel tempering would each be a separate
  page.
- **Mutual information / conditional entropy**: could be added to `entropy`
  but would require a 2D categorical joint — more controls than fits the
  page.
- **Mobile <375px**: pw-agent is locked at 1280; structural responsive classes
  in place but pixel-perfect not verified.

## Pages linked TO from this subsection

- `mle.astro` references the regression / loss surface intuition from the
  calculus gradient page.
- `bayes.astro` mentions L2 = Gaussian prior — relevant to ML readers.
- `entropy.astro` mentions softmax + cross-entropy loss for classification.
- `markov.astro` connects to RL (Boltzmann distribution, PPO KL constraint).

## Common modifications (recipes)

### "The teaching paragraph about X is wrong"
Find the paragraph in the page's `.astro` file inside the
`<section class="mt-12 max-w-3xl mx-auto prose-content">` block.

### "Add a preset to the dice simulator"
Currently 1d6 / 2d6 are hardcoded in `DiceScene.ts`. To add 3d6: extend
`DiceMode` type, branch in `rollOnce()`, expand `outcomeLabels()` and
`theoreticalPMF()`. Wire a third button in `index.astro`.

### "The accept rate on `markov` is hovering at 8% on banana"
The banana target's energy scaling needs a smaller proposal σ. Default 0.5
is tuned for bimodal; suggest the user pull σ to ~0.2 for banana. Could also
add a per-target default σ if it becomes a recurring confusion.

### "Reorder curriculum"
Reorder `MATH_SECTIONS.probstat.pages` in `mathSections.ts`. MathPageNav recomputes
prev/next automatically. Card order on the index is independent — edit the
`tools` array in `index.astro` separately if you want both in sync.

## Debugging tips

- **Sliders don't react / readouts stay at "—"**: Element refs declared
  after `new ...Scene(...)`. TDZ trap — see above.
- **MLE point dragging doesn't follow finger on mobile**: `touch-action: none`
  is set both in CSS (`style="touch-action: none"` on the canvas inline) AND
  in the scene constructor (`this.canvas.style.touchAction = 'none'`). Both
  needed because Astro static class can be overridden by user agent stylesheet.
- **Markov heatmap looks flat**: the heatmap is normalized by min-energy, but
  if the target's energy range is huge (>50), the gamma curve flattens out.
  Bump the `Math.pow(t, 0.5)` exponent to 0.3.
- **`logGamma` returns NaN**: input was ≤ 0. Beta PDF guards against this
  but if you add a new distribution, make sure you bound params away from 0.
- **`betaPDF` spikes when α or β large**: PDF height grows with α+β; the
  `bayes` page caps yMax at 30 to keep the curves visible.

## Git history quick reference

- Initial 6-page subsection + dice hero + handoff. Shipped after linalg
  (May 2026) and calculus (May 2026) using the same playbook: Canvas2DBase
  + KaTeX SSR + per-page scenes + curriculum config + nav component.

# Linear Algebra Subsection — Handoff

This file documents the `/math/linalg/` subsection so any future Claude
session can immediately pick up modifications without re-deriving context.

## What's here

6-page teaching subsection covering CS-flavored linear algebra. Each page
has interactive 3D visualization (Three.js) + KaTeX-typeset teaching copy.

| Slug              | Chapter | Status | Scene class       |
|-------------------|---------|--------|-------------------|
| `transform`       | 1       | ✅     | `MatrixScene3D`   |
| `composition`     | 1       | ✅     | `MatrixScene3D`   |
| `projection`      | 2       | ✅     | `ProjectionScene` |
| `change-of-basis` | 2       | ✅     | `BasisScene`      |
| `eigen`           | 3       | ✅     | `EigenScene`      |
| `svd`             | 3       | ✅     | `SVDScene`        |

Live at https://wemee.github.io/math/linalg/

## File map

```
src/
├── components/
│   └── MathPageNav.astro       # prev/next + supplements; used by every page
├── styles/
│   └── linalg.css                # Shared input/cell/button styles. Imported
│                                 # by every page in this subsection. Defines
│                                 # .m-input, .vec-input, .p-cell, .lambda-row,
│                                 # .sigma-row, .phase-btn, .rank-btn etc.
│                                 # Always edit here, not in page <style> blocks.
├── lib/math/linalg/
│   ├── (curriculum data lives in the shared src/lib/math/mathSections.ts → MATH_SECTIONS.linalg)
│   ├── MatrixMath.ts             # Pure math: 4×4 ops, det, inverse3, Jacobi eigen
│   ├── ThreeSceneBase.ts         # Shared Three.js scaffolding — every 3D scene below extends this
│   ├── MatrixScene3D.ts          # Deformable cube + arrows (transform, composition)
│   ├── ProjectionScene.ts        # Plane/line + projection + residual
│   ├── BasisScene.ts             # Parallelepiped + three basis arrows
│   ├── EigenScene.ts             # Sphere→ellipsoid + eigenvector arrows
│   ├── SVDScene.ts               # 4-phase sphere walkthrough + rank truncation
│   ├── presets.ts                # PRESETS — for transform/composition (4×4)
│   ├── basisPresets.ts           # BASIS_PRESETS — for change-of-basis (3×3)
│   ├── eigenPresets.ts           # EIGEN_PRESETS — symmetric 3×3
│   └── svdPresets.ts             # SVD_PRESETS — arbitrary 3×3
└── pages/math/linalg/
    ├── index.astro               # Subsection entry (cards)
    ├── transform.astro
    ├── composition.astro
    ├── projection.astro
    ├── change-of-basis.astro
    ├── eigen.astro
    └── svd.astro
```

## How to extend

### Add a supplementary reading to a page
Edit `src/lib/math/linalg/mathSections.ts`:
```typescript
export const SUPPLEMENTS: Record<string, Supplement[]> = {
  projection: [
    { label: "為什麼 P² = P", description: "投影過的東西已經在子空間裡了" },
    { label: "3Blue1Brown 投影章節", href: "https://...", description: "影片版" },
  ],
};
```
Entries show up automatically in a "📚 補充閱讀" box on the page (rendered
by `MathPageNav`).

### Edit teaching content on a page
Open the page's `.astro` file. Teaching content is in `<section class="mt-12 max-w-3xl mx-auto">`
below the main interactive grid. Math notation uses the `tex()` helper:
- Inline: `<span set:html={tex('A \\cdot v')} />`
- Display: `<div class="my-4 flex justify-center" set:html={tex('...', true)} />`

### Edit a preset
Each scene has its own preset file. Find by scene type:
- transform / composition: `presets.ts`
- projection: planes inline in `projection.astro` (`PLANE_PRESETS`)
- change-of-basis: `basisPresets.ts`
- eigen: `eigenPresets.ts`
- svd: `svdPresets.ts`

Preset entries are `{ id, label, hint, matrix }`. Edit any field; pages
re-render automatically.

### Add a brand-new page
1. Create `src/pages/math/linalg/<slug>.astro` (copy structure from
   `eigen.astro` as the most complete reference). The page wraps its body in
   `<MathLessonLayout section="linalg" slug="<slug>" seoTitle="..."
   seoDescription="...">` with a `<p slot="tagline" ...>` lede — the layout
   renders the breadcrumb, chapter eyebrow, emoji+title and the trailing
   MathPageNav from the registry, so the page only supplies the widget + prose.
2. Add the entry to `MATH_SECTIONS.linalg.pages` in `mathSections.ts` — single
   source of truth for prev/next order, visible title/emoji and the chapter
   eyebrow (`parts` map). Set `displayTitle` only if the `<h1>` should differ
   from the short nav `title` (e.g. SVD keeps `奇異值分解 SVD`).
3. Add `SUPPLEMENTS[slug] = []` to the section in same file
4. Add a card to `src/pages/math/linalg/index.astro`
5. Add a dropdown entry to `src/components/Navbar.astro`

### Add a new scene class
If the new visualization is unlike existing ones, create
`src/lib/math/linalg/<Name>Scene.ts` that **extends `ThreeSceneBase`**.
The base owns all the shared scaffolding (scene/camera/renderer,
OrbitControls + damping, grid/axes/lights, render-on-demand RAF,
ResizeObserver, dispose). Your subclass just: calls `super({ containerId,
… })` (override `cameraPosition` / `target` / `axesSize` only if needed),
adds its own meshes in the constructor, implements its update logic, and
calls `this.scheduleRender()` whenever state changes. Don't re-implement
the Three.js boot — that's the whole point of the base.

## Conventions

### Math
- Column-vector convention: `M · v` where v is a column. Translation
  lives in `M[*][3]`.
- 4×4 for transform/composition (homogeneous coordinates, last row
  locked to `[0, 0, 0, 1]`).
- 3×3 for projection (acts on 3-vectors directly), change-of-basis,
  eigen, SVD.
- `eigen` constrains input to symmetric matrices: cells auto-mirror on
  edit (`A[i][j] = A[j][i]`). Avoids complex eigenvalues; the symmetric
  case is also the most useful (covariance, Hessians, Laplacians).
- `Jacobi` rotation for eigendecomposition (`jacobiEigenSymmetric3` in
  `MatrixMath.ts`). Converges in ~30 sweeps to <1e-10 off-diagonal sum.
- SVD via `AᵀA → eigen` route. Gram-Schmidt fills in U columns for
  σ=0 cases.

### Three.js
- All scenes extend `ThreeSceneBase`, which sets up `OrbitControls` with
  damping. Don't duplicate the setup per scene.
- Render-on-demand pattern: rAF only fires when state changes or
  controls move. Never run a free 60fps loop. See `ThreeSceneBase.scheduleRender`.
- ResizeObserver on container, not `window.resize`, so the canvas
  stays correctly sized inside the flex grid.

### Astro
- Every page uses `<MathLessonLayout section="linalg" slug="..." seoTitle="..." seoDescription="...">` (which wraps `BaseLayout currentPage="math"`). The breadcrumb, header and MathPageNav come from the layout + registry.
- Page-level `<script>` uses ESM imports from `@/lib/math/linalg/...`.
  These are bundled per-page; Three.js does NOT get hoisted globally.
- KaTeX is SSR-only: `import katex from 'katex'` in frontmatter,
  `katex.renderToString(s, { displayMode })`, inject via `set:html`.
  No client KaTeX bundle. (Adds ~150KB if you ever change this.)
- The global stylesheet (`src/styles/global.css`) has a
  `.katex-display` overflow guard so wide equations scroll on mobile
  instead of breaking layout.

### Teaching copy style
- Traditional Chinese (zh-TW).
- 「」 for quotes; 純 ASCII 標點 within math.
- Tone: 直白、避免線代術語密集轟炸初學者。Use analogies (e.g.,
  rental car vs metric system for change-of-basis).
- Each page ends with: 🎮 動手試試 + 🚀 CS 應用 + 💡 演算法細節 box.
- KaTeX matrices use `\\begin{bmatrix}...\\end{bmatrix}`.

### Page sections (top to bottom)
`MathLessonLayout` provides 1, 2 and 7 from the registry; the page body is 3–6
plus the `tagline` slot for 2.
1. Back link to `/math/linalg/` *(layout)*
2. Hero — chapter eyebrow + emoji/title *(layout)*; tagline via `slot="tagline"` *(page)*
3. Optional info banner (e.g., "本頁限定對稱矩陣")
4. Main grid: `lg:col-span-2` canvas on left, controls stack on right
5. Legend chips below canvas
6. Teaching content in `<section class="mt-12 max-w-3xl mx-auto">`
7. MathPageNav *(layout)*

## What's intentionally NOT covered

- **General (non-symmetric) eigenvalues**: would require complex
  arithmetic and Jordan form for repeated roots. The hidden trade
  is shown via the symmetric-only constraint with a clear info banner.
- **Animation between phases on SVD**: phases snap instantly. Adding
  interpolation would be nice but doubles the rAF complexity.
- **Mobile <375px**: `pw-agent` is locked at 1280px viewport so I
  couldn't visually verify smallest mobile. Structural responsive
  classes are in place (`grid-cols-1 sm:grid-cols-2` etc.) but not
  pixel-perfect tested. Use a real browser for <375px QA.
- **Quaternions / Lie groups / Tensors**: explicitly cut from the
  5-page plan; can be added as new pages if desired.

## Pages NOT in this subsection

- `/math/dot-product` — pre-existing 2D vector visualizer, predates
  linalg subsection. Could be linked from `transform` as a primer.
- `matrix_sim.html` was a user-provided reference; deleted after
  porting its concepts into `transform`.

## Common modifications (recipes)

### "The hint on preset X is confusing"
Find the preset's `hint` field in the relevant `*Presets.ts` file.
Edit, commit, push.

### "The teaching paragraph about Y is wrong"
Find the paragraph in the page's `.astro` file inside the
`<section class="mt-12 max-w-3xl mx-auto">` block. Edit, commit, push.

### "Add a note linking to an external resource on page Z"
Append to `SUPPLEMENTS['<z-slug>']` in `mathSections.ts`.

### "Change the curriculum order"
Reorder `MATH_SECTIONS.linalg.pages` in `mathSections.ts`. `MathPageNav` recomputes
prev/next automatically. Card order on `/math/linalg/` index is
independent — edit `tools` array in `index.astro` separately if you
want both in sync.

### "The det/trace formula on eigen page is wrong"
Check the `onUpdate` callback in `eigen.astro`'s `<script>`. Both
trace and det are computed from the eigenvalues array returned by
`jacobiEigenSymmetric3` (sum and product respectively).

## Debugging tips

- Three.js scene black? Check container has non-zero `clientWidth/clientHeight` at construction time. The scenes throw if container is missing but assume size > 0.
- Numbers showing `-0`? `formatNumber()` in `MatrixMath.ts` normalizes
  `-0 → 0` already; if you see it, the code path is bypassing the helper.
- KaTeX rendering raw LaTeX as text? `set:html=` is required for
  injecting HTML; `{}` interpolation will escape it.
- Slow on rapid input? `scheduleRender` deduplicates rAFs so spamming
  input events shouldn't matter. If it does, profile to confirm.

## Git history quick reference

- `a7e4316` — initial linalg subsection + transform page
- `920d6e9` — KaTeX, render-on-demand, composition page
- `d926937` — projection page
- `481764f` — change-of-basis page
- `d17212d` — eigen + SVD pages + MathPageNav infrastructure
- `8db08cc` — retrofit nav on Chapter 1–2 pages + KaTeX overflow guard

# Design stack

`apps/desktop` only. `apps/macOS` is deprecated and has no stack: `docs/designs/` is its closed
archive.

- **Shared token contract** — `apps/desktop/src/platform/renderer/tokens.css`. Shared design tokens live there.
  `:root` supplies shared values and the light appearance. `.dark` overrides appearance values.
  `globals.css` imports the contract and defines global styles only.
- **Typography** — Tailwind's default text and numeric spacing scales keep their original
  measurements. Direct registry text uses the selected registry contract. Custom app text uses
  the complete `type-*` recipes in `styles/typography.css`, or inherits intentionally from its owner.
  Each recipe owns size, line height, weight, and tracking through ordinary
  `--typography-*` metadata, outside Tailwind's `--text-*` namespace. Compose recipes through the
  configured `cn` helper so an adaptation replaces the primitive's typography metrics.
  Name repeated emphasis within its owning recipe.
- **Components live with their owner**. The shadcn CLI writes
  `apps/desktop/src/platform/renderer/components/ui/`, which authors never edit by hand.
  Hand-written product modules live in their domain renderer facet. Proven cross-domain modules
  live in `apps/desktop/src/platform/renderer/`. Add a registry shape with
  `npx shadcn@latest add <name>`. Compose the registry shapes when the registry has no matching
  shape. Review mutable candidates in scratch before an update and preserve generated source
  between reviewed updates. Argo imposes this maintenance boundary; shadcn permits source edits.
  The Button/Input baseline is recorded in `apps/desktop/tests/styling/registry-baseline.json`.
  Other installed primitives retain the pending dispositions in the research catalog.
  A Biome restricted-import rule refuses a second component library. `components.json`
  fixes the primitive path under `ui/` (#1767).
- **Isolated-state mechanism** — two of them, and they answer different questions. A **story**
  under a renderer facet in `apps/desktop/src/` holds one component in one state, and is
  what a reviewer clicks. The **shipped screen** is launched by the capture into each screen it
  names, which is the only way to see the real preload, the real main process and the real
  window. A new component state costs a story; a new screen costs one entry in the capture
  driver's `SCREENS`.
- **Browse the components** — `cd apps/desktop && bun run storybook` serves the stories from the
  working tree. Vercel owns pull request preview deployments outside this repository.
- **Measurement proof** — `cd apps/desktop && bun run test:styling` runs dedicated browser
  contracts for direct Button/Input defaults, complete app recipes, focus, and Icon ownership
  in Light and Dark. Stories use the existing theme toolbar, not separate appearance stories.
  Story plays prove behavior and accessibility. Keep their metric assertions in this suite.
  These focused checks do not complete the pending theme, pane, or component work.
- **Recipe source check** — the Bun typography contract rejects undefined `type-*` classes in
  production renderer styling owners. It reads static JSX classes, class helper arguments,
  local bindings, named recipe definitions, CSS selectors, and `@apply` consumers, including
  variant-prefixed classes. `type-code-content` is a declared scoped adapter, not a complete
  text recipe. Tests and story prose are excluded. Runtime-built strings and unknown
  class-producing function results still need review. This is not a whole-app styling gate.
- **Render a state** — the shipped screen: `bun run capture:desktop`, output
  `apps/desktop/out/desktop-captures`, one PNG per screen, in the appearance the app draws
  (#3069). It launches the Vite build, or the packaged copy under `ARGO_E2E_PACKAGED=1`.

**Every PNG the command writes is disposable.** Look at it and delete it. No gate reads one and
no ref holds one (#1910): the reviewable artifact is the story, and the machine-checkable one is
the DOM assertion in the e2e tests.

The renderer shows the window: Chromium throttles a hidden one and the capture comes back
unpainted. It does not take the real keyboard or the real mouse.

The design prose no check enforces is `apps/desktop/AGENTS.md`.

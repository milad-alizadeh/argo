# Design stack

`apps/desktop` only. `apps/macOS` is deprecated and has no stack: `docs/designs/` is its closed
archive.

- **Shared token contract** — `apps/desktop/src/platform/renderer/tokens.css` owns shared geometry,
  typography metadata, and values for specialized adapters. Color themes live in
  `apps/desktop/src/platform/renderer/styles/themes/`. Each theme supplies light and dark color
  roles. Themes do not change geometry or typography. `styles/theme-bindings.css` binds those
  roles to Tailwind colors. `globals.css` imports these owners and defines global styles only.
  Register theme identities in `apps/desktop/src/platform/contract/appearance.ts`.
  The main process owns the saved theme, appearance preference, and resolved appearance.
  The renderer applies its accepted snapshot before main shows the window.
  Native window backgrounds come from the actual theme CSS, not a separate palette.
  From `apps/desktop`, run `rtk node tools/styling/generate-native-theme-backgrounds.mts`
  after a theme background change. The command writes
  `src/platform/contract/native-theme-backgrounds.json` through Chromium color resolution.
  Run `rtk node tools/styling/generate-native-theme-backgrounds.mts --check` to make sure that
  the generated backgrounds match the CSS. Run
  `rtk bun test src/platform/renderer/styles/theme-completeness.test.ts` to make sure that
  every appearance supplies every role used by the bindings.
- **Typography** — Tailwind's default text and numeric spacing scales keep their original
  measurements. Registry components and their app callers use the selected registry typography
  by default. Button/Input callers preserve registry size, line height, weight, and tracking,
  including responsive sizes. Path inputs can use `font-mono` without replacing those metrics.
  Custom content uses
  the complete `type-*` recipes in `styles/typography.css`, or inherits intentionally from its owner.
  Each recipe owns size, line height, weight, and tracking through ordinary
  `--typography-*` metadata, outside Tailwind's `--text-*` namespace. Compose recipes through the
  configured `cn` helper when custom content needs a complete recipe.
  Name repeated emphasis within its owning recipe. `type-control` is a custom content recipe,
  not a universal override for registry controls.
- **Components live with their owner**. The shadcn CLI writes
  `apps/desktop/src/platform/renderer/components/ui/`, which authors never edit by hand.
  Hand-written product modules live in their domain renderer facet. Proven cross-domain modules
  live in `apps/desktop/src/platform/renderer/`. Add a registry shape with
  `npx shadcn@latest add <name>`. Compose the registry shapes when the registry has no matching
  shape. Review mutable candidates in scratch before an update and preserve generated source
  between reviewed updates. Argo imposes this maintenance boundary; shadcn permits source edits.
  The Button/Input/Dialog baseline is recorded in `apps/desktop/tests/styling/registry-baseline.json`.
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
  contracts for Button/Input defaults and app callers, custom content recipes, focus, and Icon ownership
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

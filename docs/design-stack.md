# Design stack

`apps/desktop` only. `apps/macOS` is deprecated and has no stack: `docs/designs/` is its closed
archive.

- **Shared token contract** — `apps/desktop/src/platform/renderer/tokens.css` owns shared geometry,
  typography metadata, and values for specialized adapters. Color themes live in
  `apps/desktop/src/platform/renderer/styles/themes/`. Each theme supplies light and dark color
  roles. Themes do not change geometry or typography. `styles/theme-bindings.css` binds those
  roles to Tailwind colors. `globals.css` imports these owners and defines global styles only.
  `apps/desktop/src/platform/contract/appearance.ts` owns the finite Theme catalog and Mode values.
  `platform/main/theme-coordinator.ts` owns the saved Theme, Mode preference, and resolved appearance.
  `platform/main/appearance.ts` sends accepted state and applies native backgrounds to every window.
  `platform/renderer/use-appearance.ts` applies accepted state before main shows the window.
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
  The Button/Input/Dialog/Badge baseline is recorded in `apps/desktop/tests/styling/registry-baseline.json`.
  Other installed primitives retain the pending dispositions in the research catalog.
  A Biome restricted-import rule refuses a second component library. `components.json`
  fixes the primitive path under `ui/` (#1767).
- **Badge and status paint** - Use registry Badge directly for its native variants, typography,
  and 20px height. Keep its destructive tint and focus treatment. Use its `render` prop with
  an actual button for an action or an anchor for navigation. The display-only `StatusBadge` in
  `components/design-system/status-badge.tsx` applies the shared Success, Warning, Danger, or Neutral
  recipe as a span, keeping native Badge typography and geometry. Theme CSS assigns each status tone
  separately in Light and Dark so Theme changes badge and indicator colors. Running and completed
  states map to Success; they do not add separate color categories. Session and Ticket modules keep
  state mappings, text, glyphs, motion, and count geometry.
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
  in Light and Dark for every Theme. Stories use the existing Theme and Mode toolbar controls.
  There are no separate Light and Dark story exports.
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

## Theme and Mode

The 2026-10-02 decision for #3101 keeps Theme and Mode as independent choices.
Theme selects a color scheme. Mode selects System, Light, or Dark.
Every Theme supplies both Light and Dark colors. System follows the operating system without changing Theme.
The app keeps its existing choice groups. Storybook labels its controls Theme and Mode and follows the browser preference for System.

Default uses cool Zinc gray surfaces with blue primary, selected, and focus colors.
Catppuccin, Ocean Breeze, and Northern Lights
are the researched color-only trial candidates. Their upstream colors supply shadcn roles in both Modes.
Argo supplies shared status colors separately from each Theme's native destructive treatment.
All schemes keep shared role owners, registry typography, and geometry.
Default replaces the former Neutral default. The researched candidates replace Neutral, Graphite, and the unfinished Forest trial.
An explicit invalid or removed saved Theme is reported and counted, then falls back to Default while preserving a valid Mode.
Missing Theme remains a valid older portable document. Mutation rejects unknown values and retains accepted state.
Reading a fallback does not rewrite the portable document.

To add a Theme from the repository root:

1. Add its finite identifier in `apps/desktop/src/platform/contract/appearance.ts`.
2. Add complete Light and Dark assignments in `apps/desktop/src/platform/renderer/styles/themes/<theme>.css`.
3. Import that file in `styles/globals.css` and add its label to `shell/locales/app.json` and `.storybook/preview.ts`.
4. From `apps/desktop`, run `rtk node tools/styling/generate-native-theme-backgrounds.mts`, then repeat with `--check`.
5. Run the completeness, coordinator, native readiness, and styling suites. Review the existing stories in both Modes.

Theme CSS owns Tailwind shade assignments. Component callers consume semantic roles.
The eight rendered combinations must retain control measurements and make primary, selected, action, and focus colors visibly distinct between Themes.
Do not change `components.json` or generated `components/ui/` source to add a Theme.

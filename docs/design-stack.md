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
  the generated backgrounds match the CSS. Review native surface pairs directly in Storybook
  with its Theme and Mode toolbar controls.
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
  Other installed primitives retain the pending dispositions in the research catalog.
  A Biome restricted-import rule refuses a second component library. `components.json`
  fixes the primitive path under `ui/` (#1767).
- **Badge and status paint** - Use registry Badge directly for its native variants, typography,
  and 20px height. Keep its destructive tint and focus treatment. Use its `render` prop with
  an actual button for an action or an anchor for navigation. The display-only `StatusBadge` in
  `components/design-system/status-badge.tsx` applies the shared Success, Warning, Danger, or Neutral
  recipe as a span, keeping native Badge typography and geometry. Shared status CSS assigns each fact tone
  separately in Light and Dark, independent of the imported action palettes. Running and completed
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
- **Appearance review** — inspect live Storybook in Light and Dark for every Theme.
  Stories use the existing Theme and Mode toolbar controls.
  There are no separate Light and Dark story exports.
  Story plays prove behavior and accessibility. Inspect appearance tuning directly in the live stories.
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

Default retains the native neutral palette. Supabase, Linear, and Amber Minimal come from the
public Shadcnblocks registry. Their published native color values remain unchanged.
The user retired Catppuccin, Ocean Breeze, and Northern Lights on 2026-10-02.
Those three saved identities resolve to Default and preserve Mode.
Other unknown identities are rejected, reported, and counted. Missing Theme remains a valid older portable document.
Reading a fallback does not rewrite the portable document. The next accepted write saves the active identity.
Mutation rejects retired and unknown values and retains accepted state.

From `apps/desktop`, run `rtk node tools/styling/import-registry-themes.mts --update` to refresh the three installed registry Themes.
The importer validates the official `registry:theme` records and writes scoped Light and Dark CSS.
It retains exact native color strings and records source URLs, SHA-256 digests, and the registry license.
The normalized JSON, its content digests, and property exclusions live in `tools/styling/theme-sources/`.
Font, radius, spacing, tracking, shadow, source utility, and source base-style changes are excluded.
Run `rtk node tools/styling/import-registry-themes.mts --check` to compare installed CSS with the recorded source without network access.
Run `rtk node tools/styling/generate-native-theme-backgrounds.mts`, then repeat with `--check`.
The finite Theme catalog drives the Appearance dialog and Storybook choices. Storybook reads the same locale labels.

The [Shadcnblocks registry](https://www.shadcnblocks.com/shadcn-cli) supplies the installed records.
The [Shadcnblocks license](https://www.shadcnblocks.com/license) applies to these free public registry items in Argo Desktop.
The earlier trial provenance remains in `docs/research/2026-10-02-theme-palette-imports.md` as history.

The approved #3119 surface mapping supersedes the surface table in ADR-0038.
The shared main pane uses the approved elevation treatment. The earlier anchored-shadow restriction in ADR-0038 also differs from this decision.

The approved shell structure for #3119 uses full-height panes. Each pane owns its header segment and body.
The header segments share the 64px bezel height and native colors. Each segment keeps its controls in normal layout flow.
Both sidebar widths change the middle header and middle body together. Full inspector expansion collapses both middle regions.
Sessions supports the right inspector. Tickets has no right pane or right resize handle.
A collapsed inspector remains a supported page capability. It differs from a page that has no inspector.

AppShell owns the persistent rail, project header, left pane sizing, and continuous sidebar-colored backing.
The changing page outlet sits inside that shell. WorkspaceShell uses the same implementation.
The Sessions inspector split owns two stable panel registrations. It resizes the entire middle and right panes.
The main content body owns its rounded corners, subtle native border, and pane elevation. Each sidebar body owns its native fill, rounded clip, and real border box.
Sidebar descendants sit inside that border box. One backing starts below the bezel and continues the native body paint and perimeter beneath rounded joins.
The search header is transparent layout inside the painted body aside. That aside is presentational because the page content owns the labeled complementary landmark.
Standalone sidebar stories provide that same enclosing surface.
When the middle collapses between two open sidebars, the right body owns their shared hairline.
Inner content keeps its reading width during collapse; registered panes and painted surfaces follow the shrinking width to zero.
The Composer scrollport keeps native scrolling and gives the card shadow 24px of clearance. Session metadata uses the smaller navigation type with equal space above and below the two-line identity.
The shared pane shadow uses a 2px vertical offset, 12px blur, and -4px spread. Black opacity is 18% in Light and 55% in Dark.
Sizing wrappers remain transparent. Headers have no enclosing borders or shadows.
The shell keeps its identity and sidebar state across navigation. Route subscribers select inputs before rendering unchanged chrome.

This pane ownership decision also supersedes ADR-0038's full-width header placement.
The 2026-10-02 approval replaces the earlier proposal that placed a shared page header above the inspector body split.


| Structural surface | Native background | Native foreground |
| --- | --- | --- |
| Outer shell, header, navigation bezel | `background` | `foreground` |
| Main pane, ComposerCard, SessionContextBar | `card` | `card-foreground` |
| Both sidebars and backing beneath rounded joins | `sidebar` | `sidebar-foreground` |
| Floating menus and popovers | `popover` | `popover-foreground` |

Native roles can share a color. Do not add aliases or alter imported palettes to make four distinct shades.
Sidebar interaction states use `sidebar-accent` and `sidebar-accent-foreground`.
Other interaction states use `accent` and `accent-foreground`.
Dashboard control glyphs use `muted-foreground` through normal, hover, focus, and open states.
The selected rail glyph uses `accent-foreground`. Primary action glyphs retain their native action foreground.
Semantic status marks retain their fact colors. Disabled controls retain their disabled treatment.
Neutral status indicators use native `muted-foreground`. Neutral badges use `muted` fill and readable `foreground` text.
Scrollbar paint uses native `border` and `muted-foreground`.

Every retained custom color family has a current product consumer:

| Family | Product need and consumer |
| --- | --- |
| `status-success`, `status-warning`, `status-danger`, `warning-subtle`, `warning-foreground` | Running, attention, failure, and notice facts in shared tone recipes, Session marks, and Ticket blockers. Shared `status-colors.css` owns both Modes. |
| `diff-added`, `diff-removed` | Added and removed code in diff viewers, and added paths in project setup review. |
| `language-typescript`, `language-go`, `language-ruby` | Language identity in `code-language-icon.tsx`. The TypeScript mark requires white text on its brand-colored tile. |
| Sixteen `terminal-*` protocol colors | Normal and bright ANSI foregrounds and backgrounds in `ai-elements/terminal.css`. Black and white foregrounds keep native readable ink. Indexed and true-color values remain protocol data. |
| Seven `code-xcode-*` syntax inks | Comments, definitions, keywords, names, strings, types, and variables shared by CodeMirror and Shiki. Code backgrounds and ordinary text use `card` and `card-foreground`. |
| `ticket-label` and its fill percentage | Provider-supplied label colors tint the opaque background in `ticket-label.tsx`. Label text uses native `foreground`. |
| `feed-work-glint` | The running-text shimmer, mixed from native `muted-foreground` and `card`. |

Unused surface, selected, ink, quiet, faint, icon, Plan, PR, Ticket-done, traffic-light, scrollbar, and Xcode adapter color declarations are removed.
The audit leaves geometry, typography, and animation tokens outside its scope.
Run the coordinator and native readiness checks after a Theme change.
Review Session, Ticket, and menu stories in both Modes. Report upstream contrast failures before any palette change.
Do not change `components.json` or generated `components/ui/` source to add a Theme.

Linear currently publishes a Dark secondary pair with 2.59:1 contrast and a Light muted pair with 4.01:1 contrast.
Its Light primary pair measures 3.95:1 for small text. Native primary actions remain unchanged.
Supabase Dark destructive text measures 1.13:1 on the dialog surface. Failed-save notices use the shared status-danger fact color.
Amber Minimal destructive text measures 3.71:1 in Light and 4.07:1 in Dark on the dialog surface.
Ticket metadata uses the native outline Badge. Session reference chips use foreground text on muted fill.
These consumer choices preserve the published palette and keep small product text readable.

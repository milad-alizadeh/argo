# Desktop token and theme audit

Date: 2026-10-01. Source revision: `04cedbca16970d6a5a0dacf904633d63536a2b5c`.

The desktop app has a written token contract and useful shared roles. Its implementation does not keep ownership clear. One file combines theme values, Tailwind bindings, typography, component dimensions, and old design details. The native window, code editor, generated components, and product CSS do not all read the same contract.

The problem is larger than repeated colors. The system needs explicit rules for shared intent, local geometry, component composition, and theme changes. This audit provides source evidence for that work. It does not change the app or claim that every candidate is a bug.

## Scope and method

The active target is `apps/desktop`. `apps/macOS` is deprecated. `docs/designs/tokens.css` belongs to its closed design archive under [the design stack](../design-stack.md). Do not merge those historical palettes into the desktop contract.

The audit uses the latest local `origin/main` snapshot at its start. The shared main checkout was eight commits behind that snapshot. It does not claim to include later remote changes.

[The inventory](2026-10-01-token-inventory.json) contains every global token declaration, its source line, direct readers, aliases, static utility readers, equal-value groups, and local variables. [The scanner](2026-10-01-token-audit.mts) parses CSS with PostCSS and TypeScript literals with the TypeScript parser. Run it from the worktree root:

```sh
rtk node docs/research/2026-10-01-token-audit.mts
```

The script writes a new inventory. It needs the repo's installed PostCSS, TypeScript, and Tailwind packages. It also compiles representative utilities through the installed Tailwind compiler. This proves the reported bindings against this installation.

The scanner excludes comments. It separates app source, registry UI, verification source, and generated protocol files. Utility matches are static candidates, not runtime execution proof. Dynamic class construction, runtime stylesheet injection, third-party token readers, and imported stylesheet internals need separate inspection. Equal values are whitespace-normalized, not normalized to equivalent colors or lengths. The inventory records installed compiler versions and modified tracked source files.

Unresolved references are checked by name across all scanned scopes. A name defined elsewhere can still be unavailable at a particular element. This scanner does not prove scope availability or a complete theme matrix. Exact-name string references can include writes as well as reads; review candidate readers at their call site.

The [styling audit](2026-10-01-styling-reuse-audit.md) separately counts literal JSX `className` attributes in product renderer files. Those lower-bound counts cannot be added to the broader token-reference counts.

| Measure | Result | Meaning |
| --- | ---: | --- |
| Source files scanned | 1,085 | CSS, TS, TSX, and MTS below desktop `src` |
| Application files | 717 | Excludes categories below |
| Registry UI files | 58 | A location category, not proof of upstream identity |
| Verification files | 221 | Stories and test suffixes |
| Generated protocol files | 89 | Excluded from production reader analysis |
| Global token declarations | 355 | Includes appearance overrides |
| Unique global token names | 281 | The contract's current vocabulary |
| Other CSS custom-property declarations | 22 | Local variables outside `tokens.css` |
| Same-block name collisions | 1 | A definite conflicting declaration |
| Equal-value groups within source scope categories | 40 | Candidates, not 40 unnecessary roles |
| Equal-value groups spanning scope categories | 23 | Includes values equal across different appearances |
| Names without a static production reader | 58 | Review candidates, not a deletion list |

The scanner also records 55 runtime declaration sites for 41 names. These include inline style properties, `setProperty`, and Tailwind arbitrary properties, including registry-owned mechanics. They are not 41 missing global tokens.

## Findings by priority

### 1. The native background is a stale second palette

[The appearance contract](../../apps/desktop/src/platform/contract/appearance.ts#L27) describes mirrored CSS values but defines `#ffffff` for light and `#0a0a0a` for dark. [The actual theme](../../apps/desktop/src/platform/renderer/tokens.css#L336) uses the surface-base role. Its light source is neutral-100 and its dark value is `#292c30` at line 402.

[Window creation](../../apps/desktop/src/platform/main/window/create-window.ts#L25) reads the stale constants. [The native appearance watcher](../../apps/desktop/src/platform/main/appearance.ts#L44) also reads them. The watcher cannot repair the mismatch because it uses the same table.

This is a definite source mismatch. A launch or resize flash is a risk, not a reproduced result. Derive native backgrounds from the authored theme and test their resolved equality. Replace the stale comment with the actual contract.

### 2. The appearance bridge is incomplete

[The renderer hook](../../apps/desktop/src/platform/renderer/use-appearance.ts#L10) begins with `dark: true`. Its initialization expects `window.argo.getAppearance`, but [the preload](../../apps/desktop/src/preload.ts#L77) exposes only `onAppearanceChanged`. The declared [window interface](../../apps/desktop/src/renderer/argo.d.ts#L8) also has no getter or setter. Production source has no implementation of either expected method.

The hook returns before subscribing when the getter is absent. Its selection callback is also a no-op when the setter is absent. Thus the current production hook keeps its initial dark answer instead of receiving the saved or System state through this path. Storybook supplies mocked methods and can hide the integration gap.

This is stronger evidence than a potential startup flash. Repair the validated initial-state transport and subscription before adding theme identity. Then resolve selectors before the first visible frame. The initial light CSS and dark effect still create an unmeasured first-paint risk. Keep main as the authority because it already applies stored native appearance.

### 3. A global dimension has two conflicting definitions

[`--size-navigation-control`](../../apps/desktop/src/platform/renderer/tokens.css#L206) is `28px`, then `40px` at line 210 in the same `@theme inline` block. The later declaration wins. Its earlier declaration cannot represent a separate role.

Keep one intended value after reviewing the navigation rail and collapsed-sidebar inset. If both sizes are required, give each a distinct role at its owner. This case is different from light and dark overrides.

### 4. One consumed dimension is not defined in app source

[SessionWorkInspectorHeader](../../apps/desktop/src/domains/sessions/renderer/work/session-work-inspector-header.tsx#L57) uses `pr-(--inset-session-inspector-toggle)`. The scan finds no CSS, inline-style, arbitrary-property, or `setProperty` definition. The compiler emits `padding-right: var(--inset-session-inspector-toggle)` with no fallback.

That padding declaration is invalid when the variable is absent. The resulting visual overlap was not rendered in this audit. Decide the intended reservation at the owning header instead of adding a global measurement by reflex.

The other unresolved application variable, `--collapsible-panel-height`, is supplied by Base UI. Its installed `CollapsiblePanelCssVars.d.ts` declares it, and Base UI's shipped documentation lists it. It is a library measurement, not a missing Argo token.

### 5. Typography changes shadcn defaults through global names

[`text-xs`, `text-sm`, and `text-base`](../../apps/desktop/src/platform/renderer/tokens.css#L173) all resolve to the app's 14px reading/control rung. The compiler probe confirms this. Generated components can retain their class strings while their original sizing changes underneath them.

The current [Empty source](../../apps/desktop/src/platform/renderer/components/ui/empty.tsx#L62) also contains app role classes such as `type-title` and `type-body`. Location under `ui/` therefore does not prove that it is an untouched registry component. The source audit cannot establish how that adaptation entered the file.

[Unlayered global rules](../../apps/desktop/src/platform/renderer/styles/globals.css#L19) also force icon geometry, remove input focus-ring shadows, and set control font weight. They take precedence over ordinary layered registry utilities. Preserving vendor source and default size names alone does not preserve original rendered styling. Move intentional product overrides into scoped app compositions.

The user's new constraint is to preserve original shadcn sizes and styling and put adaptation in a separate app layer. The proposed architecture must preserve the default Tailwind size namespace. The requested detailed shadcn update and drift workflow follows this research workflow separately.

### 6. Typography metadata occupies a functional Tailwind namespace

[`--text-body-weight: 400`](../../apps/desktop/src/platform/renderer/tokens.css#L181) and `--text-body-tracking: normal` belong to `@theme inline`. Tailwind treats `--text-*` names as font-size tokens. The compiler probe can generate `text-body-weight` with `font-size: 400` and `text-body-tracking` with `font-size: normal`.

The audit does not find production use of those invalid size utilities. This is a latent contract problem. Put weight and tracking metadata in ordinary custom properties or their correct namespaces. The [hand-maintained merge list](../../apps/desktop/src/platform/renderer/lib/text-sizes.ts#L1) currently includes these metadata names as sizes, which extends the mistaken contract into class merging.

### 7. Typography roles and caller emphasis conflict

[The typography utilities](../../apps/desktop/src/platform/renderer/styles/typography.css#L17) repeat their selector, for example `.type-body.type-body`. They set weight and tracking with higher specificity than ordinary utility classes. A caller can request `type-body font-semibold` without receiving the requested semibold weight.

Two onboarding labels also request an undefined `type-caption`. [The styling audit](2026-10-01-styling-reuse-audit.md#1-complete-typography-roles-before-extracting-components) supplies the exact locations and affected emphasis examples.

Choose a documented role or emphasis variant for those labels. Remove global specificity tricks once adapters carry deliberate typography. A contributor must know which layer owns the final value.

### 8. Appearance is coherent, but custom theme identity is missing

Main reads and applies a stored `system | light | dark` preference, resolves `nativeTheme.shouldUseDarkColors`, and pushes native updates. The renderer contains effects for `.dark` and `colorScheme`, but the missing getter prevents its normal subscription. Retain the main-process foundation and repair the renderer transport. The current source does not provide a setter or save a newly selected appearance through this path.

[The consumer hook](../../apps/desktop/src/platform/renderer/use-appearance.ts#L12) observes only the root class and returns one boolean. It has no theme identifier. Mermaid redraws on that boolean. A future switch between two dark themes cannot invalidate its color snapshot through the existing dependency.

Add theme identity as a separate axis when custom themes are implemented. System remains a resolution policy, not a third palette. Define the full change signal for CSS, native windows, editors, and drawn diagrams.

### 9. Syntax color has two configuration paths

[Shiki](../../apps/desktop/src/platform/renderer/components/xcode-code-theme.ts#L18) reads `--code-xcode-*` references. [The CodeMirror adapter](../../apps/desktop/src/domains/projects/renderer/onboarding/editor/project-setup-editor-theme.ts#L1) selects a vendor Xcode theme and overrides only background and gutter background.

Changing the CSS syntax tokens does not configure CodeMirror's remaining syntax settings through this adapter. The current palettes can look similar, but this audit does not prove exact equality. Decide whether syntax follows the app theme or an independent editor theme. Implement one explicit bridge for that decision.

### 10. The shipped surface rules contradict the accepted ADR

[ADR-0038](../adr/0038-the-desktop-cockpit-is-opaque.md) requires opaque surfaces and shadows only on unanchored overlays. [The composer stylesheet](../../apps/desktop/src/domains/sessions/renderer/screens/session-screen.css#L45) applies a translucent surface and `backdrop-filter`. [The panel elevation utility](../../apps/desktop/src/platform/renderer/styles/panel-layout.css#L102) applies a shadow to an anchored panel.

The global `--color-session-surface` is consumed by a platform-wide content utility, despite its Session name. Its dark value adds a distinct content ground. These are decision conflicts, not problems that a token rename resolves.

The migration must name ADR-0038. Either restore its table and elevation policy or supersede the affected rules in an approved ADR. This report does not silently approve the current departures.

### 11. Global geometry grows with individual owners

The global vocabulary includes 66 `--size-*` names, 18 spacing names, seven inset names, and 39 `--text-*` names. Some express shared alignments. Others describe one attachment strip, one composer popover, or one inspector.

Examples include `--size-composer-attachment-strip`, `--size-session-menu`, `--size-context-label-column`, and `--inset-lightbox-margin-x`. Their global placement suggests that every component can choose them, even when they belong to one owner.

Move owner-specific geometry beside its owner. Keep cross-owner dimensions global only when consumers must change together. Runtime measurements such as `--context-picker-space` remain runtime measurements. They do not belong in a theme palette.

### 12. Current gates do not prove the token contract

[The typography test](../../apps/desktop/src/platform/renderer/styles/typography-contract.test.ts#L15) checks source strings and bans some raw rungs in selected product folders. It deliberately asserts the current global shadcn size remapping. A migration must update that assertion to the new contract.

[Storybook's test project](../../apps/desktop/vitest.config.ts#L13) starts with Dark. Its toolbar permits Light, but the source does not define a matching automated Light run. The existing axe scan does not establish both appearances.

[The design-value lint override](../../biome.jsonc#L282) and general code gates do not prove unique declarations, complete palettes, valid utility role names, native/CSS equality, or same-appearance theme redraw. Add tests for those behaviors and declarations during implementation. Do not call this research a rendered accessibility audit.

## Duplicate decisions

Equal values need four different actions. A repeated name in the same block is a collision. Two names for one intent can merge. Two roles with equal current values can remain distinct. A vendor contract can require a name even without an app reader.

| Current cluster | Evidence | Proposed disposition |
| --- | --- | --- |
| `--size-navigation-control` at 28px and 40px | Same-block collision | Keep one intended definition |
| `--size-icon-meta` and `--size-icon-metadata` | Metadata alias adds a second spelling, with one consumer of the longer name | Migrate to one public spelling |
| `--size-icon-control`, `--size-icon-inline`, `--size-icon-text` | Equal now, but roles identify different uses | Retain only roles with independent future sizing intent |
| `--spacing-tight` and `--spacing-shell-icon` | Both 6px, with real readers | Define one repeated relationship or make owner-specific spacing local |
| `--spacing-snug`, `--spacing-shell-gutter`, `--spacing-session-gutter`, `--spacing-composer-attachment-gutter` | 12px or aliases of 12px | Keep a shared gutter role; retain local aliases only when their contract can vary |
| `--color-icon` and `--color-muted-foreground` | Same reference; icon name has no static reader | Remove the unused app alias after confirming external readers |
| `--color-ink` and `--foreground` | Same in light, different in dark; one app reader of ink | Make an explicit text-role decision before migrating the reader |
| `--color-faint` and `--muted-foreground` | Same in light, different in dark; many faint readers | Review supporting text hierarchy and contrast before consolidating |
| `--selected` and `--accent` | Accent aliases selected | Keep selection separate only if selected and hovered states must diverge |
| Foreground/card/popover/sidebar foreground | Equal within appearances | Retain paired shadcn roles because surfaces can diverge |
| Border/input/sidebar-border | Equal in light; input differs in dark | Retain required roles; do not collapse from the light value alone |
| Language and ANSI hue pairs | Shared Tailwind values in some appearances | Keep separate content meanings; shared raw palette values are valid |
| Body, prose, heading sizes | All 14px; weights and usage differ | Keep a finite typography role set, with shared measurements where intended |
| Menu and context-picker viewport limits | Identical expressions | Consolidate the constraint in the overlay owner or shared overlay recipe |
| Minimum inspector and workspace dimensions | Equal values across different owners | Keep local constraints unless they represent one alignment policy |
| PR, plan, native traffic-light, Concierge decoration names | No static production readers in the inventory | Review historical leftovers; preserve only documented active or vendor contracts |

The inventory contains all 40 exact groups with each source line. It also contains the 23 groups that span scope categories. Those counts overlap in values, so do not add them. Cross-scope equality can compare light with dark and does not prove duplicate intent.

The 58 reader candidates include ten chart names, four sidebar-primary names, eight plan/PR names, native traffic-light details, and older composer dimensions. Inspect each inventory entry before removal. Default-theme compatibility roles can remain even when there is no current chart or sidebar-primary component.

Do not delete syntax link/caret names merely because the scanner sees no direct reader. Decide whether they belong to the intended editor palette first. Do not preserve old names merely because a comment remembers a design that no longer ships.

## Styling duplication beyond values

The independent audit examined 909 literal class attributes in 378 product renderer files. It found one raw Tailwind palette color, zero raw text-size rungs in that subset, 49 numeric size utilities, 73 radius utilities, and 360 numeric spacing utilities. Expressions and constants are outside these counts.

The useful reuse clusters are concrete:

1. Reuse the existing `ContractFailureAlert` in the two owners that repeat its full contract.
2. Select `icon-sm` in the existing copy-button wrapper instead of making three callers correct its size.
3. Consolidate the Session inspector header and path-title recipe.
4. Finish the onboarding media/title/detail recipe in its existing parts module.
5. Resolve typography roles and icon-role omissions by use, not by pixel equality.

The full [styling audit](2026-10-01-styling-reuse-audit.md) provides every location and explains local exceptions. Repeated `flex min-h-0 flex-1` expresses layout mechanics. It does not justify a generic React wrapper. `rounded-full` can express a circle, and a black lightbox scrim can stay black in both appearances.

## Research and next decision

Two separate `gpt-6-sol` agents at medium effort studied current primary sources. [Token architecture research](2026-10-01-token-architecture-practices.md) covers token layers, intent, CSS ownership, and tooling. [Theme-management research](2026-10-01-theme-management-practices.md) covers shadcn bindings, Electron, first paint, accessibility, and non-CSS consumers.

[The proposed architecture](2026-10-01-token-theme-system.md) converts those findings into a small shared contract, ownership rules, and a migration with acceptance criteria. It preserves the user's requirement for a separate shadcn adaptation layer. The separately completed [shadcn adaptation and drift workflow](2026-10-01-shadcn-adaptation-workflow.md) explains the Empty example, class merging, preserved defaults, source provenance, and updates.

## Limits

This is a source audit and a compiler probe. It does not render screens, measure every contrast pair, compare every registry file to upstream, or run startup capture. Exact-value and reader inventories are complete for the scanner's stated source scope. Semantic equivalence and runtime coverage still require human design judgment and behavior tests.

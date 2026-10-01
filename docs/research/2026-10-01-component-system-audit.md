# Desktop component and styling audit

2026-10-01. Source revision: `2299196335d0c66210be48764df77bfeeeea85e8` in the clean main checkout.
All audit artifacts live in the existing research worktree.
This report replaces the earlier advice-only component discussion with file-level decisions.
It does not modify production components, install updates, publish a spec, or activate new agent instructions.

## Read the result

- [Component catalog](2026-10-01-component-catalog.md): Each of the 191 app TSX files, its symbols, evidence, target owner, rules, and source consumers.
- [Registry provenance](2026-10-01-shadcn-component-provenance.md): Every one of the 58 `ui/` sources, its upstream comparison, and required disposition.
- [Proposed styling contract](2026-10-01-component-styling-contract.md): Explicit rules for theme values, primitives, adaptations, patterns, panes, and exceptions.
- [Pane examples](2026-10-01-pane-styling-examples.md): Ownership diagram, concrete CSS/JSX targets, border and clipping cases.
- [Machine inventory](2026-10-01-component-inventory.json): Imports, JSX props, utility strings, inline styles, CSS declarations, source hashes, and duplicate groups.
- [Reviewed decisions](2026-10-01-component-decisions.json): One explicit recommendation per app file, with no fallback classification.
- [Reproduction script](2026-10-01-component-audit.mts): TypeScript/PostCSS inventory and a coverage assertion against those decisions.

The chosen direction is a preserved shadcn measurement baseline with a small set of named app patterns.
Theme CSS changes color values. Shared recipes supply repeated treatments. App patterns own structure and content.
Domain owners keep state mapping. Library adapters keep specialized rendering. Pane layout owns structural surfaces and clipping.
Agents use direct registry primitives when their defaults fit.
An agent cannot create a fork or hide an override behind global CSS without an approved decision.

## Coverage and limits

| Measured scope | Count | Meaning |
| --- | ---: | --- |
| Source TS/TSX/CSS paths | 1,100 | Includes verification and generated protocol paths |
| Parsed non-generated TypeScript files | 995 | Includes verification imports for consumer references |
| Non-test/story TSX files | 248 | Every path appears in an app or registry catalog |
| TSX files in `components/ui/` | 57 | One is an app-owned trigger, not a registry component |
| Additional `ui/` TypeScript helper | 1 | `use-mobile.ts` |
| App TSX files | 191 | Includes nonvisual modules and one story helper |
| Patterns | 117 | Includes existing domain compositions, not 117 new wrappers |
| Library/presentation adapters | 24 | Specialized rendering, assets, or library integration |
| Layout modules | 14 | Pane, route, scroll, or geometry ownership |
| Runtime/nonvisual modules | 35 | Routing, state, editor plugins, or orchestration |
| Story helper outside a story suffix | 1 | `composer-story-samples.tsx` |
| CSS files | 12 | Complete declaration AST, including `@utility` and `@theme` bodies |
| Matched styling-support TS files | 14 | Utility strings or selected styling/DOM calls |
| App utility-bearing string sites | 1,021 | Constants, conditionals, templates, and JSX literals |
| App component override/composition sites | 266 | Includes supported `render` and layout classes, not 266 violations |
| Exact cross-file duplicate class groups | 41 | All listed with source locations in the catalog |

The scanner finds 716 capitalized functions and other component candidates across TSX source.
That is not a React component count. The inventory also retains exports, types, helpers, and inline JSX callbacks.
The reviewed recommendations cover each file's visual and nonvisual cases rather than treating every capitalized function as a primitive.

This is a source audit plus upstream source comparison, not a rendered visual or accessibility audit.
Source imports do not prove bundle reachability. Story imports do not prove behavior or both appearances.
Static strings do not prove every runtime class, numerical geometry, or CSS result.
The earlier literal-only audit remains historical evidence, not the coverage boundary of this report.
Current main advanced after that audit. The current inventory includes the changed Feed and Session screen sources and the shell renames from #3083.
The registry source is unchanged between the earlier comparison revision and this refresh.

## Findings

### 1. High: instructions and tests enforce the wrong typography boundary

The [desktop instruction](/Users/milad/Developer/argo/apps/desktop/AGENTS.md:51) assigns a typography role to every reader-visible string.
The [design contract](../design-stack.md#L9) also forbids manual registry edits, without explaining how app typography applies outside registry slots.
The [typography test](../../apps/desktop/src/platform/renderer/styles/typography-contract.test.ts#L24) requires remapped `text-xs`, `text-sm`, and `text-base`.
It also requires a particular modified Button size string at line 30.
An agent can obey those instructions while changing the meaning of untouched registry typography.

Target: Preserve the selected registry typography and Tailwind scales.
Give custom and adapted app text a complete recipe, with intentional inheritance permitted.
Change instructions and tests together during implementation. Rules: S01, S07, S08, S18.
This is a present conflict, not proof of which historical change caused it.

### 2. High: global CSS restyles primitives even when their files match upstream

[globals.css:19](../../apps/desktop/src/platform/renderer/styles/globals.css#L19) sets unlayered dimensions on every app `data-slot="icon"`.
Line 28 suppresses input-family ring shadows. Line 33 sets control font weight through tags and roles.
[scrollbars.css:54](../../apps/desktop/src/platform/renderer/styles/scrollbars.css#L54) restyles all registry ScrollArea slots globally.
[typography.css:17](../../apps/desktop/src/platform/renderer/styles/typography.css#L17) repeats selectors to beat ordinary emphasis utilities.

Target: Give Icon, SearchField, ScrollViewport, and other named patterns their own defaults and overrides.
Preserve registry focus/size behavior outside those adapters.
Add computed browser contracts as well as source identity checks. Rules: S08, S09, S11, S13, S18.
An empty upstream diff cannot prove default rendered styling.

### 3. High: registry space contains app variants, APIs, and modules

The live registry comparison identifies differences that the earlier source-only report could not attribute: 27 component bodies match and 29 differ.
See the [full provenance audit](2026-10-01-shadcn-component-provenance.md) for all file-level results and payload hashes.
[Badge](../../apps/desktop/src/platform/renderer/components/ui/badge.tsx#L10) embeds `compact`, `text-badge`, and `warning`.
[CommandInput](../../apps/desktop/src/platform/renderer/components/ui/command.tsx#L60) adds app search appearance and typography.
[InputGroup](../../apps/desktop/src/platform/renderer/components/ui/input-group.tsx#L11) exports the app search recipe.
[Empty](../../apps/desktop/src/platform/renderer/components/ui/empty.tsx#L57) embeds app text roles.
[DropdownTrigger](../../apps/desktop/src/platform/renderer/components/ui/dropdown-trigger.tsx#L1) is an app-owned composition stored in vendor space.

Target: Restore identified current registry files after extracting required app behavior.
Move trigger/search/tone adaptations into their named app owners.
Keep imported registry helpers at verified registry dependency targets.
Do not restore every difference indiscriminately before consumer review. Rules: S01, S04, S05, S15, S19.

### 4. High: structural panes do not share one surface contract

[AppShell](/Users/milad/Developer/argo/apps/desktop/src/platform/renderer/app/components/app-shell.tsx:156) uses `panel-elevation` and panel utilities.
[WorkspaceShell](/Users/milad/Developer/argo/apps/desktop/src/platform/renderer/shell/components/workspace-shell.tsx:82) separately sets sidebar backgrounds, borders, and clipping.
[panel-layout.css:42](../../apps/desktop/src/platform/renderer/styles/panel-layout.css#L42) supplies yet another body/edge recipe.
[ComposerCard](../../apps/desktop/src/domains/sessions/renderer/composer/layout/composer-card.tsx#L159) and context bar draw anchored shadows.
[session-screen.css:47](../../apps/desktop/src/domains/sessions/renderer/screens/session-screen.css#L47) applies translucent composer ground and blur.
[ProjectSetupShell](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-layout.tsx#L84) draws an anchored action-panel shadow.
[Ticket properties](../../apps/desktop/src/domains/tickets/renderer/detail/ticket-detail-properties.tsx#L12) draw an anchored pill shadow.

Target: Keep one pane/frame/header/body/divider recipe under the existing layout owner.
Use the existing [ADR-0038 surface table](../adr/0038-the-desktop-cockpit-is-opaque.md#L111).
Keep pane bodies opaque, clip content at the body, and portal popups outside that clipping boundary.
Keep one structural border per meeting edge. Reserve shadows for unanchored overlays.
Rules: S03, S12, S17. A different surface system needs an ADR change, not a new token at a caller.

### 5. Medium: repeated raw palette treatments bypass themes

[ContextMeter](../../apps/desktop/src/domains/sessions/renderer/composer/context-bar/session-context-bar.tsx#L38) uses white/red and neutral palette gradient stops.
[file-diff-lines.tsx:47](../../apps/desktop/src/platform/renderer/components/file-diff-lines.tsx#L47) uses emerald/rose fills.
[file-diff-list.tsx:98](../../apps/desktop/src/platform/renderer/components/file-diff-list.tsx#L98) repeats those fills.
These expression/constant sites were outside the old literal-only count.
[ImageLightbox](../../apps/desktop/src/domains/sessions/renderer/feed/content/image-lightbox.tsx#L50) uses a black scrim, which is a different case.

Target: Put meter stops and diff-added/diff-removed surface roles in theme/recipe owners.
Keep the media scrim as an explicit named overlay value.
Keep mask alpha geometry separate from visible color choices. Rules: S02, S11, S14, S16.

### 6. Medium: Attachment already reuses shadcn, but its adaptation fights the slots

[AttachmentChip](../../apps/desktop/src/domains/sessions/renderer/attachment-chip.tsx#L40) imports registry Attachment and five slot components.
It changes root geometry, important media size, title truncation, content width, and typography at lines 40-66.
[ComposerAttachments](../../apps/desktop/src/domains/sessions/renderer/composer/layout/composer-attachments.tsx#L17) already uses AttachmentGroup/Actions/Action.
This is not a missing primitive. It is an unstructured app adaptation of an existing one.

Target: Keep registry Attachment and own ComposerAttachmentChip's root/media/content/title/description/action recipes together.
Keep attachment row layout with ComposerAttachments.
Use native Attachment sizes where they fit. Replace the important-class fight with explicit supported slot overrides.
If the desired structure still cannot fit, use an approved plain app composition rather than pretending the file is pristine.
Rules: S04, S05, S08, S13, S19.

### 7. Medium: custom controls duplicate available primitive behavior and appearance

[BooleanChoice](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/setup-plan-field.tsx#L141) implements a hidden native checkbox and custom check mark.
[ModelOptions](../../apps/desktop/src/domains/sessions/renderer/composer/toolbar/turn-configuration-menu.tsx#L157) implements a styled native radio group.
[EffortSlider](../../apps/desktop/src/domains/sessions/renderer/composer/toolbar/effort-slider.tsx#L30) and [AutoCompactControl](../../apps/desktop/src/harnesses/codex/presentation/codex-auto-compact.tsx#L45) independently style range controls.
The installed kit contains Checkbox, RadioGroup, Slider, and Input, with no app consumers for Checkbox or Slider.
[MethodChoice](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-method-screen.tsx#L140) already uses RadioGroupItem but turns it into an invisible full-card overlay.

Target: Use the existing registry control interactions inside named ChoiceCard/ChoiceRow/RangeField patterns.
Keep domain labels and selection logic local. Test selected, disabled, invalid, keyboard, and nested-control states.
Native HTML is not inherently defective. This recommendation removes parallel appearance and interaction maintenance where existing primitives fit.
Rules: S05, S09, S10, S16.

### 8. Medium: typography requests conflict or name undefined recipes

[Fact](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L99) and [TargetFacts](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-target-review.tsx#L76) use undefined `type-caption`.
Inspector and onboarding titles combine app type roles with emphasis utilities that repeated-selector rules can override.
[Lexical content](../../apps/desktop/src/domains/sessions/renderer/composer/editor/session-composer-editor.tsx#L90) uses `type-prose`.
[reference nodes](../../apps/desktop/src/domains/sessions/renderer/composer/references/composer-reference-node.ts#L11) independently use `type-body` and important weight.

Target: Make one complete text recipe per actual relationship, with named emphasis and inherited nested text.
Share inline-reference presentation between React text and editor-created DOM.
Keep prose/heading/code hierarchy separate from control typography. Rules: S07, S08, S11.
These are source/cascade constraints, not measured defects for every cited caller.

### 9. Medium: copy and trigger treatments have multiple local defaults

[CodeBlockCopyButton](../../apps/desktop/src/domains/sessions/renderer/ai-elements/code-block-copy-button.tsx#L26) selects `icon`.
FeedCode, inline tool calls, and DiffHeader replace it with `size-7`.
[TerminalCopyButton](../../apps/desktop/src/domains/sessions/renderer/ai-elements/terminal.tsx#L59) repeats the competing size request.
[ComposerMenuTrigger](../../apps/desktop/src/domains/sessions/renderer/composer/toolbar/composer-menu-trigger.tsx#L21) replaces its whole default class string when the caller supplies `className`.
Context, plan, workspace, work, project, and Ticket triggers each supply related but different text/padding treatments.

Target: Select the native matching copy size at its owner.
Keep one composer trigger recipe and the existing cross-domain DropdownTrigger composition.
Keep Ticket interactive Badge triggers as a named domain adaptation.
Merge supported caller layout classes without dropping the owner's required recipe. Rules: S03, S04, S08, S10, S13.

### 10. Medium: duplicated structures have existing owners that can absorb them

ContractFailureAlert exists, while SignInPanel and SourceSettings copy its tint/icon/description treatment.
File/evidence/diff inspectors repeat sticky headers and path-title styling.
Onboarding parts, recommendation rows, progress steps, and target facts repeat media/title/detail structures.
AccountRow and HarnessReadinessRow repeat readiness row relationships.
Sessions and Tickets headers repeat sidebar height, search placement, and action placement.

Target: Extend those existing owners before introducing generic layout wrappers.
Share recipes when structure differs. Share patterns when content/interaction contracts match.
Keep equal `flex min-h-0 flex-1 flex-col` strings local.
The [catalog](2026-10-01-component-catalog.md#duplicate-groups) lists all 41 exact cross-file class groups. Rules: S03, S05, S07, S12.

### 11. Medium: Loader color props do not change its drawn color

[TicketVirtualList](../../apps/desktop/src/domains/tickets/renderer/sidebar/ticket-virtual-list.tsx#L68) passes `text-faint` to Loader.
[loader.css:5](../../apps/desktop/src/platform/renderer/components/loader/loader.css#L5) draws squares with `var(--foreground)`, not `currentColor`.
The text utility changes `color`, not that gradient's color source.

Target: Make Loader's exposed color treatment use `currentColor`, or remove unsupported color overrides.
Keep its geometry local and preserve its accessible-state union and reduced-motion fallback. Rules: S08, S13, S16.

### 12. Medium: theme and geometry adapters need explicit invalidation and units

Mermaid, CodeMirror, Shiki, native window color, and Lexical DOM do not all receive theme values through ordinary inherited classes.
The [earlier runtime audit](2026-10-01-token-theme-audit.md) establishes the missing appearance preload getter/setter and divergent native background.
[CodeMirror's adapter](../../apps/desktop/src/domains/projects/renderer/onboarding/editor/project-setup-editor-theme.ts#L1) selects an Xcode library palette.
[Shiki's adapter](../../apps/desktop/src/platform/renderer/components/xcode-code-theme.ts#L18) reads separate CSS syntax roles.
[Mermaid](../../apps/desktop/src/domains/sessions/renderer/feed/content/feed-mermaid.tsx#L78) redraws on a dark boolean, not custom theme identity.
[readCssSize](../../apps/desktop/src/platform/renderer/lib/read-css-size.ts#L2) parses custom-property text as a number.

Target: One resolved theme identity/appearance drives all adapters.
One syntax role source feeds code viewers and editors.
Resolve actual pixel dimensions before library calls. Keep virtualizer coordinates and measured clearance local.
Rules: S02, S11, S17, S18.

## Custom components and shadcn fit

The target is maximum useful reuse, not maximum wrapper count.
Thirty-two `ui/` TSX files have a direct app-source importer in this inventory.
Other kit files can remain installed registry source without an app wrapper.
The five proposed shared patterns do not replace every primitive export.

| Current custom case | Available shadcn shape | Explicit decision |
| --- | --- | --- |
| AttachmentChip and attachment row | Attachment slots/group/actions | Keep reuse. Name and centralize the chip slot adaptation. |
| Empty states across domains | Empty slots | Use one shared EmptyState text/media/action contract. Keep content/state with each domain. |
| Error and sign-in notices | Alert slots | Reuse ContractFailureAlert and a slot-aware Notice treatment. |
| Search field and Workspace picker | InputGroup, Command, Popover | Extract search recipe/API outside registry source. Keep matching default primitives. |
| Standard dropdown/context menus | Menu primitives and native variants | Use directly. Keep domain menu composition, not a mirror wrapper for each export. |
| Rich composer/work options | Menu slots or RadioGroup | Own only the label/detail/icon recipe. Preserve native interaction. |
| Project settings, accounts, rename dialog | Dialog | Keep direct composition and local widths. Preserve default text/focus. |
| Image lightbox | Dialog slots and Button | Own MediaDialog full-window geometry and transitions. No global Dialog rewrite. |
| Onboarding choice cards | Checkbox or RadioGroup | Use existing controls inside named app card/row structure. |
| Model choice rows | RadioGroup | Use the primitive for selection/keyboard behavior. Keep model data local. |
| Effort and auto-compaction controls | Slider and Input | Use one range-field treatment with local domain formatting and thresholds. |
| Harness tabs | Tabs | Keep Tabs behavior. Own the HarnessSelector layout/adaptation. |
| Code/terminal copy actions | Button native icon sizes | Select size at the copy owner. Keep copy feedback local. |
| Permission split action | ButtonGroup, Button, DropdownMenu | Keep current composition and explicit disabled/focus contracts. |
| Pane split and inspector | Resizable | Keep library split behavior. Share app pane frame/header/body recipes. |
| Sidebar/roster frame | Sidebar exists, but owns cookie/shortcut/responsive state | Keep Argo's app layout/state. Do not swap in Sidebar solely for its name. |
| Scroll viewport | Native scrolling or ScrollArea | Keep native scrolling where sufficient. Scope any custom ScrollArea adaptation. |
| Full-row selection and nested actions | No one registry shape matches the current contract | Keep domain row patterns. Share style recipes and test focus/selection. |
| Ticket labels with provider colors | Badge | Keep a validated content-color adapter and contrast fallback. |
| Markdown, code highlighting, ANSI, editors, diagrams | No matching engine | Keep specialized adapters and share theme/type roles. |
| Virtual feed, list anchors, tree rails | No matching state/geometry engine | Keep existing layout/runtime owners. Reuse primitive controls inside them. |
| Brand/language/status glyphs and Loader | Icons/assets or app-specific mark | Keep identity/mark owners. Share dimensions and color contracts where meanings match. |

The standard shadcn Sidebar is not an automatic replacement for Argo Desktop's layout.
Its state persistence, shortcut, responsive behavior, and panel model differ from this app's owners.
The registry audit names those upstream behaviors without labeling them local drift.
Resizable, primitive controls, shared recipes, and the existing pane owner provide the relevant reuse here.

## Shared pane and clipped-content contract

Use the existing panel utility owner instead of maintaining two unrelated shell recipes.
The shell selects the region's canonical surface. The pane recipe owns edges, outer corners, header insets, and clipping.
The scroll viewport owns overflow. The split owns meeting edges and resize handles.
Popups portal outside clipping while inheriting the root theme.

| Concern | Current locations | Required owner |
| --- | --- | --- |
| Header height and gutters | AppShell, WorkspaceShell, InspectorSplit, Session/Ticket sidebar headers | Shared panel-header/sidebar-header recipes |
| Ground and text pairing | Panel utilities, direct shell backgrounds, Feed/composer CSS | Canonical surface roles from ADR-0038 |
| Meeting borders | Shell rails, split divider, inspector frame, sidebar body | Parent split chooses one edge per meeting boundary |
| Outer corners and content clip | Panel body, shell overflow, embedded code/diff frames | Pane body recipe, with square internal edges |
| Scroll and virtual geometry | Native panes, Feed viewport, lists, ScrollArea | Actual viewport/virtualizer owner |
| Popup size, portal, and overlay edge | Menus, popovers, context picker, media dialog | Named popup composition using popover roles |
| Anchored elevation | Panel-elevation, composer, onboarding action panel, property pill | Remove shadow under current ADR |
| Dynamic clearance and bounds | SessionWorkspace, ContextPicker, tree rails, virtual rows | Scoped measured variables, not global tokens |

## CSS file dispositions

Every production CSS file is included in the inventory.
Selectors for library DOM are valid when they stay under the named adapter.
Color themes and component geometry require different owners.

| File under `apps/desktop/src/` | Current job | Target |
| --- | --- | --- |
| `platform/renderer/tokens.css` | Colors, app text, geometry, motion, native/library palette | Split theme values/bindings from shared foundations and owner-local geometry. Preserve default Tailwind scales. |
| `platform/renderer/styles/globals.css` | Imports, root sizing/focus, icon/input/control overrides | Keep imports/base root setup. Move app visual overrides into named owners. |
| `platform/renderer/styles/typography.css` | Complete app roles with repeated specificity | Use complete predictable recipes and ordinary metadata. Permit intended inheritance/emphasis. |
| `platform/renderer/styles/app-base.css` | Drag/no-drag utilities | Keep native window interaction geometry here. |
| `platform/renderer/styles/panel-layout.css` | Frames, headers, corner variables, divider, anchored elevation | Keep pane recipes. Remove anchored elevation. Reconcile both shell consumers. |
| `platform/renderer/styles/scrollbars.css` | Native pseudo-elements and blanket ScrollArea slot overrides | Keep native policy. Scope custom ScrollArea rules to app adapter. |
| `platform/renderer/components/loader/loader.css` | App animation, local sizes, fixed foreground paint | Keep local geometry/motion. Align paint with the exposed color API. |
| `domains/sessions/renderer/feed/feed.css` | Feed layout, prose/code, status shimmer | Keep layout/adapter rules. Share text and work-state roles. |
| `domains/sessions/renderer/feed/feed-loading.css` | Delayed out-of-flow reveal | Keep local loading motion with reduced-motion proof. |
| `domains/sessions/renderer/screens/session-screen.css` | Measured composer clearance, fades, translucent composer | Keep measurement/fade geometry. Replace translucent ground and blur with the opaque surface contract. |
| `domains/sessions/renderer/composer/editor/composer-content.css` | Composer attachments, permission trays, reference/editor DOM | Keep scoped structural/adapter rules. Reconcile React and Lexical reference recipes. |
| `domains/sessions/renderer/ai-elements/terminal.css` | ANSI foreground/weight/dim mapping | Keep a terminal palette adapter. Record bright/background/true-color behavior that the library emits. |

## Styling support dispositions

These 14 files match utility strings or selected styling/DOM calls in the complete TS scan.
The following runtime/theme section also names adapters whose strings do not match that scanner filter.
This distinction prevents a utility match count from becoming a claim of runtime completeness.

| Support module | Required disposition |
| --- | --- |
| `composer/context-window/context-zone.ts` | Keep context threshold mapping local. Select named indicator/ink roles, not filled surfaces. |
| `composer/references/composer-reference-icon.ts` | Share reference icon identity/size with React references. Keep DOM construction scoped to the editor adapter. |
| `composer/references/composer-reference-node.ts` | Use the inline-reference recipe without important weight or a competing text role. |
| `composer/references/composer-ticket-reference-node.ts` | Share reference/icon presentation. Preserve link keyboard behavior and validated provider shape. |
| `composer/references/context-picker/use-context-picker-position.ts` | Keep measured bounds as scoped runtime data. |
| `composer/references/skill-mention-markdown.ts` | Share mention text treatment across generated and React markup. |
| `feed/content/appearance-probe.ts` | Resolve library color values through the theme adapter. Make lifecycle ownership explicit. |
| `feed/content/feed-surface.ts` | Keep the proven Feed card recipe. Do not create a token for every repeated radius. |
| `feed/content/mermaid-theme.ts` | Read the complete resolved theme and invalidate cached values by identity/appearance. |
| `domains/sessions/renderer/link-class.ts` | Keep the shared Session link recipe and intentional text inheritance. |
| `work/presentation/session-work.ts` | Keep exhaustive work-state mapping. Share indicator treatment with Session row state. |
| `platform/renderer/lib/utils.ts` | Keep one configured merger. Remove metadata names from font-size classes and prove complete typography merging. |
| `providers/github/presentation.ts` | Keep provider identity/key-column metadata. Do not promote provider content into theme roles. |
| `providers/linear/presentation.ts` | Keep the same provider presentation boundary and shared key geometry contract. |

Composer/Feed/Work paths in that table are relative to `domains/sessions/renderer/` unless a full domain/platform/provider path is shown.

## Runtime and external-data boundaries

- Appearance: Main owns preference/resolution. Preload must supply the validated initial read, mutation, and subscription contract.
- Native window: Generate its background from the shared theme source, not a second handwritten palette.
- CodeMirror/Shiki: Supply the same syntax roles through their different adapters and redraw on theme identity.
- Mermaid: Resolve supported serialized colors and geometry. Theme identity joins render invalidation.
- Lexical: Share reference/prose recipes with React counterparts. Keep parsing, selection, and content state in existing plugins.
- ANSI terminal: Keep protocol color meanings separate from product state colors and test emitted classes/true-color behavior.
- Provider labels: The Ticket boundary validates six hex digits. Tint is content data, while contrast/fallback is one adapter contract.
- Brand assets: Keep identity colors and asset-specific appearance transforms explicit.
- Measurement: Keep row sizes, transforms, tree anchors, popup bounds, and composer reach local. Resolve CSS units before JS layout calls.

Four audited modules have only story-file direct importers in this scan: SetupDocumentForm, ProjectSetupWindow, WorkspaceContentChrome, and WorkspaceShell.
That is not a bundle reachability proof or a deletion recommendation.
It does require checking the actual shipped route before claiming that a styling fix there changes the app.

## Completion criteria for implementation

The next implementation can start from scratch without migration aliases.
It must restore the selected latest registry baseline, extract the cataloged app adaptations, and adopt the explicit contract.
It must repair appearance transport and deliver complete Light/Dark/custom theme assignments through all runtime adapters.
It must align pane/header/border/clipping and text recipes across current page owners.
It must change conflicting instructions/tests and install error-level ownership/source/color/type checks with failing proofs.

Use the testing boundary already accepted by the user: the existing Electron/Playwright theme flow, Light/Dark component behavior/a11y stories, and focused source/compiler contracts.
Use dedicated browser contracts for computed default/adapted metrics and affected clipping/layout states.
This research does not report those implementation tests as executed.
No spec or implementation begins merely because these completion criteria are written here.

## Audit verification

The source scanner's fixture and exact decision-coverage assertion passed.
Two consecutive scans produced identical inventory/catalog hashes.
Independent checks verified 274 saved component, stylesheet, and matched support-source hashes and 441 local evidence links.
All 58 registry inventory rows have a unique file and disposition.
An independent Babel AST comparison reproduced 27 matching and 29 differing registry candidates.
All 57 recorded raw payload hashes match the fetched JSON files, including the official helper.
The registry source remained unchanged during the main-checkout shell rename.
These checks establish source evidence and catalog coverage, not visual or accessibility correctness.

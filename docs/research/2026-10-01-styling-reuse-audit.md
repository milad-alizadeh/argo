# Desktop styling reuse audit

Date: 2026-10-01. This report audits source in the research worktree. It does not report a rendered appearance test.

A recipe is a group of styles for one visual role. A primitive supplies reusable interaction or document structure. The best migration units here are existing domain recipes and primitives. The source does not support replacing every utility string with a component.

## Scope and method

The scan walks `apps/desktop/src` and selects `.ts` and `.tsx` paths that contain `/renderer/`. It separates stories, tests, registry UI, and remaining source, in that order. It finds 378 remaining files, 70 story files, 35 test files, and 58 registry UI files. These are source-path groups, not a bundle reachability analysis. A story-only helper without a story suffix can remain in the first group. Production presentation modules outside renderer paths are outside the count.

The static scan finds 909 `className="..."` attributes in the remaining group. It splits each value on whitespace. Duplicate groups sort the tokens before comparison. This finds equivalent literal strings with different class order. It excludes template literals, `cn()` arguments, class constants, DOM assignments, CSS, and JSX expressions. Counts are lower bounds for styling usage. The manual audit covers examples from those excluded forms.

| Static utility category | Occurrences | Files | Interpretation |
| --- | ---: | ---: | --- |
| Raw palette colors | 1 | 1 | `bg-black/60` on the image lightbox backdrop |
| Raw text-size rungs | 0 | 0 | No `text-xs`, `text-sm`, `text-base`, or larger rung in this subset |
| Numeric `size-*` | 49 | 29 | Includes descendant selectors and decorative tiles |
| Numeric `opacity-*` | 4 | 3 | Mostly hidden animation states and a busy list |
| Radius rungs | 73 | 45 | Includes `rounded-full`, `rounded-none`, and descendant selectors |
| Numeric spacing | 360 | 73 | Includes `gap-*`, padding, margin, and `space-*` |

Raw colors match `text`, `bg`, `border`, `ring`, `fill`, or `stroke` with common Tailwind palette names, optional numeric shade, and optional numeric alpha. Text-size rungs match `xs`, `sm`, `base`, `lg`, `xl`, and `2xl` through `9xl`. Numeric size and spacing match integers and decimal rungs. Radius matches `xs` through `4xl`, `full`, and `none`. Each category permits a variant prefix ending in `:`. These counts do not include arbitrary values.

For reproduction, run a recursive Node read-only scan with `/className="([^"\n]+)"/g` after these path filters. For duplicate strings, split on `/\s+/`, sort, and join. The next section gives the complete locations for the main duplicate groups, so `rg -n` can independently reproduce each group.

## Existing ownership

The [design contract](../design-stack.md) assigns registry primitives to `platform/renderer/components/ui/`. Authors do not edit those files by hand. Product modules stay in their owning domain. Cross-domain modules move to platform renderer only after proven reuse. The [desktop rules](../../apps/desktop/AGENTS.md) require visual tokens, typography roles, and color tokens.

The app already contains useful reuse boundaries:

- [Panel utilities](../../apps/desktop/src/platform/renderer/styles/panel-layout.css#L1) own frames, headers, gutters, nested corners, elevation, dividers, and motion.
- [PageHeading](../../apps/desktop/src/platform/renderer/components/page-heading.tsx#L23) and [SectionTitle](../../apps/desktop/src/platform/renderer/components/section-title.tsx#L24) own shared heading compositions.
- [Icon](../../apps/desktop/src/platform/renderer/components/icon/icon.tsx#L8) offers `control`, `meta`, `inline`, and `text` sizes through tokens.
- [SidebarSearch](../../apps/desktop/src/platform/renderer/components/sidebar-search.tsx#L24) composes the search field. Its registry recipe lives in [input-group.tsx:11](../../apps/desktop/src/platform/renderer/components/ui/input-group.tsx#L11).
- [ComposerMenuTrigger](../../apps/desktop/src/domains/sessions/renderer/composer/toolbar/composer-menu-trigger.tsx#L7), [CollapsibleText](../../apps/desktop/src/domains/sessions/renderer/feed/tools/collapsible-text.tsx#L21), and [PlanSection](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L22) already own domain recipes.
- [FEED_CARD_RADIUS_CLASS](../../apps/desktop/src/domains/sessions/renderer/feed/content/feed-surface.ts#L1) gives seven consumer modules one Feed card radius. [LINK_CLASS](../../apps/desktop/src/domains/sessions/renderer/link-class.ts#L2) gives Session links one recipe.

The [shared `cn` implementation](../../apps/desktop/src/platform/renderer/lib/utils.ts#L5) extends font-size merging for the app token names. Imports from `cn` resolve to this implementation in [tsconfig.web.json:18](../../apps/desktop/tsconfig.web.json#L18), [Vite:37](../../apps/desktop/vite.renderer.config.ts#L37), and [Storybook:54](../../apps/desktop/.storybook/main.ts#L54). This is one merge utility, despite two import spellings. The scan finds `cva()` in registry UI, rather than a parallel product variant framework.

## Prioritized findings

### 1. Complete typography roles before extracting components

Two production labels use `type-caption`, but source contains no matching utility or token. They are [Fact's `<small>` label at line 99](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L99) and [TargetFacts' `<dt>` at line 76](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-target-review.tsx#L76). The elements receive inherited or browser-default typography instead of the intended explicit role. Select an existing role from the intended hierarchy. Add a new role only if that hierarchy needs one.

The roles also own font weight and tracking. [typography.css:17](../../apps/desktop/src/platform/renderer/styles/typography.css#L17) uses `.type-body.type-body`, which is more specific than `.font-semibold`. The same utility layer contains both rules. With [body weight 400](../../apps/desktop/src/platform/renderer/tokens.css#L181), ordinary `font-semibold` cannot supply 600 when both classes apply. The same constraint affects `type-label font-semibold` and tracking utilities.

Examples include [RecommendationGroup:41](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-recommendation-group.tsx#L41), [PlanSection:40](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L40), [SessionFileInspector:59](../../apps/desktop/src/domains/sessions/renderer/inspector/session-file-inspector.tsx#L59), and [the device code's `tracking-widest`](../../apps/desktop/src/domains/accounts/renderer/components/sign-in-panel.tsx#L50). This is a source-established precedence constraint. The audit does not claim a rendered defect in each case. Decide whether emphasis belongs to a heading role, a named emphasis recipe, or the existing role. Then remove contradictory class requests.

### 2. Consolidate the Session inspector header recipe

Three literal headers repeat `sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3`: [diagram evidence:36](../../apps/desktop/src/domains/sessions/renderer/inspector/session-evidence-inspector.tsx#L36), [command/file evidence:73](../../apps/desktop/src/domains/sessions/renderer/inspector/session-evidence-inspector.tsx#L73), and [workspace file:58](../../apps/desktop/src/domains/sessions/renderer/inspector/session-file-inspector.tsx#L58). Three titles repeat the same truncation, RTL direction, body role, and requested weight: [evidence:16](../../apps/desktop/src/domains/sessions/renderer/inspector/session-evidence-inspector.tsx#L16), [workspace file:59](../../apps/desktop/src/domains/sessions/renderer/inspector/session-file-inspector.tsx#L59), and [diff filename:123](../../apps/desktop/src/domains/sessions/renderer/inspector/session-diff-content.tsx#L123).

The [diff header:121](../../apps/desktop/src/domains/sessions/renderer/inspector/session-diff-content.tsx#L121) restyles `CodeBlockHeader` with the same sidebar ground and insets. Its path uses `<bdi dir="ltr">`, while the two other title implementations do not. The [shared file diff list:56](../../apps/desktop/src/platform/renderer/components/file-diff-list.tsx#L56) has related header styling and explicitly uses `unicode-bidi:plaintext` at line 66. These are shared visual and path-reading concerns, not merely equal numbers.

Start with a Session-owned header/title composition or named recipe. Keep content scrolling and optional actions explicit. Make sure that long paths and mixed-direction text keep their intended order. Evaluate reuse in the platform diff list only after the Session recipe proves compatible.

Do not extract a generic flex wrapper for the eight occurrences of `flex min-h-0 flex-1 flex-col`. They span inspectors and the Ticket deck. Their equality mostly expresses the layout algorithm. Three scrolling bodies share `min-h-0 flex-1 overflow-auto p-4`, but the shell inspector has a terminal-specific body and the diff viewer has code-specific scrolling. Preserve those distinctions.

### 3. Finish the existing onboarding row recipes

Four supporting labels repeat `mt-0.5 block type-control text-muted-foreground`: [PlanSection subtitle:42](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L42), [SummaryRow value:90](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L90), [setup progress detail:58](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-progress.tsx#L58), and [recommendation detail:51](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-recommendation-group.tsx#L51). Two related tile wrappers repeat `grid size-8 shrink-0 place-items-center rounded-lg bg-muted [&>svg]:size-4`: [PlanSection:36](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/project-setup-plan-review-parts.tsx#L36) and [RecommendationGroup:38](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-recommendation-group.tsx#L38).

Use the existing onboarding parts module for the repeated media/title/detail recipe. It can own tile size, icon size, detail inset, and row spacing. Keep the Switch, disclosure, progress state, and selection behavior with each current owner. A single polymorphic row with all these modes adds unnecessary complexity.

The 32-pixel tiles do not all share a role. [SourceSettings' mediaTile](../../apps/desktop/src/domains/tickets/renderer/connection/source-settings.tsx#L31) is an `ItemMedia` composition. [ProjectSetupIntroduction](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-layout.tsx#L24) is a round introduction mark. [SectionIcon](../../apps/desktop/src/domains/projects/renderer/onboarding/plan/setup-plan-sections.tsx#L25) uses a 36-pixel tile. Do not unify these from numeric equality alone.

Five action rows repeat `flex flex-wrap justify-end gap-2`: [recovery:29](../../apps/desktop/src/domains/projects/renderer/onboarding/project-setup-recovery.tsx#L29), [review:50](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-review-screen.tsx#L50), [review:93](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-review-screen.tsx#L93), [review:176](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-review-screen.tsx#L176), and [setup screen:58](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-screen.tsx#L58). This is a modest owner-local action-row recipe. It does not require a platform component.

### 4. Move repeated copy-control sizing to its existing owner

Three callers set `CodeBlockCopyButton` to `size-7`: [FeedCode:32](../../apps/desktop/src/domains/sessions/renderer/feed/content/feed-code.tsx#L32), [inline tool:39](../../apps/desktop/src/domains/sessions/renderer/feed/tools/feed-inline-tool-call.tsx#L39), and [diff header:139](../../apps/desktop/src/domains/sessions/renderer/inspector/session-diff-content.tsx#L139). The [wrapper:26](../../apps/desktop/src/domains/sessions/renderer/ai-elements/code-block-copy-button.tsx#L26) selects `size: 'icon'`, whose registry default is 32 pixels. Callers then replace it with 28 pixels. The existing `icon-sm` variant already represents 28 pixels in [button.tsx:30](../../apps/desktop/src/platform/renderer/components/ui/button.tsx#L30).

Select the matching variant in the hand-written wrapper and remove those overrides after reviewing all callers. This is a clear recipe ownership issue. It does not require a new button library or a global control-size change.

For icons, use the existing `Icon size` roles when they match the role. The [Icon component:32](../../apps/desktop/src/platform/renderer/components/icon/icon.tsx#L32) has no JavaScript default size, but [the unlayered global icon rule](../../apps/desktop/src/platform/renderer/styles/globals.css#L19) supplies `--size-icon-control` as its CSS fallback. That rule beats ordinary layered registry sizing unless a stronger priority applies, such as an important utility. Scope this override to the app composition layer before claiming that original registry sizes are preserved. Numeric `size-3.5` context icons and `size-3` confirmation marks can need distinct roles. Review those clusters together, not all 49 size occurrences as one error.

### 5. Reuse the existing contract failure alert

Three implementations contain the same alert appearance, icon, description, and `contractText(error)`: [ContractFailureAlert:9](../../apps/desktop/src/platform/renderer/components/contract-failure-alert.tsx#L9), [SignInPanel:110](../../apps/desktop/src/domains/accounts/renderer/components/sign-in-panel.tsx#L110), and [SourceSettings:122](../../apps/desktop/src/domains/tickets/renderer/connection/source-settings.tsx#L122). The shared component already owns the full shape. Its use can remove the two copies and their local presentation imports.

The [Session list failure:39](../../apps/desktop/src/domains/sessions/renderer/session-list/session-list-outcome.tsx#L39) shares only the tint recipe. It also has a title, locale messages, and external margins. Keep its content contract distinct. If this tint becomes a shared alert role, compose it outside registry UI.

## Local exceptions and negative findings

Raw Tailwind colors are rare in product renderer source. The only palette match in the static count is [the lightbox backdrop](../../apps/desktop/src/domains/sessions/renderer/feed/content/image-lightbox.tsx#L50). A black scrim can remain black in both appearances. Give this value a named lightbox role if the token contract requires it. Do not infer that it must become the themed foreground color.

No static product attribute uses a raw text-size rung. Registry UI does use those rungs, but [tokens.css:173](../../apps/desktop/src/platform/renderer/tokens.css#L173) maps `text-xs`, `text-sm`, and `text-base` onto app typography sizes. Those utility names are not evidence of independent sizes. Product typography uses `type-*` classes, which also own line height, weight, and tracking.

Radius utilities already resolve through [the app's radius scale](../../apps/desktop/src/platform/renderer/tokens.css#L265). `rounded-full` often denotes a circle or pill. `rounded-none` often removes an embedded surface's corners. The seven Feed modules already share a card-radius recipe. Do not mechanically replace each radius rung with a new token.

Numeric spacing is common, but it does not identify a bug by itself. Keep layout utilities such as `flex`, `min-h-0`, `overflow-auto`, and local breakpoint tracks near their layout owner. Give repeated screen-independent insets a role when they represent the same relationship. [ProjectSetupShell's responsive columns](../../apps/desktop/src/domains/projects/renderer/onboarding/screens/project-setup-layout.tsx#L59) and [Ticket detail's container layout](../../apps/desktop/src/domains/tickets/renderer/detail/ticket-detail.tsx#L103) express different structures.

Opacity needs the same distinction. Hidden animation states are state mechanics, not color roles. Semantic text tints such as `text-muted-foreground`, `text-background/80`, and destructive fills already reference tokens. Repeated alpha values can still deserve a recipe if they identify the same visual state. The source does not support a universal opacity scale from the four static matches.

The hand-written CSS generally reads tokens. Examples include [Feed layout and code styles](../../apps/desktop/src/domains/sessions/renderer/feed/feed.css#L89) and [composer context markup](../../apps/desktop/src/domains/sessions/renderer/composer/editor/composer-content.css#L55). Editor DOM, scrollbar pseudo-elements, and nested panel edges justify CSS selectors. Do not convert these into JSX components just to shorten a selector.

The [lightbox dialog override](../../apps/desktop/src/domains/sessions/renderer/feed/content/image-lightbox.tsx#L41) removes registry positioning, size limits, backdrop, and animation. This is a dedicated full-window media experience. Keep that composition local unless another media surface needs the same contract. It is different from callers repeatedly correcting a shared default.

## Theme consumers and review limits

The [runtime appearance hook](../../apps/desktop/src/platform/renderer/use-appearance.ts#L26) is intended to receive the main process answer and update both `.dark` and `colorScheme`. The production preload lacks its expected getter and setter, so the hook currently returns before subscribing and keeps its initial dark state. [useDarkAppearance:12](../../apps/desktop/src/platform/renderer/use-appearance.ts#L12) separately observes root class changes and exposes only a boolean. Repair the initial-state transport first. A future theme change within the same appearance also needs a broader signal for consumers that snapshot CSS values.

[Mermaid](../../apps/desktop/src/domains/sessions/renderer/feed/content/mermaid-theme.ts#L12) reads computed token colors into sRGB canvas pixels. Its [render effect](../../apps/desktop/src/domains/sessions/renderer/feed/content/feed-mermaid.tsx#L78) reruns for source, ID, and dark appearance. Same-appearance token changes do not change those dependencies. Its [node radius:22](../../apps/desktop/src/domains/sessions/renderer/feed/content/feed-mermaid.tsx#L22) also uses literal `6px` in library theme CSS. Treat this as a library adapter value and give it the intended diagram role when migrating it.

Rendered Shiki code reads [shared Xcode token references](../../apps/desktop/src/platform/renderer/components/xcode-code-theme.ts#L18). The [onboarding CodeMirror adapter](../../apps/desktop/src/domains/projects/renderer/onboarding/editor/project-setup-editor-theme.ts#L1) selects the library's Xcode theme and overrides only background and gutter background. Shared syntax token changes do not configure its other syntax settings through this adapter. The source does not establish whether the two current palettes differ visually. The adapter's [memoization](../../apps/desktop/src/domains/projects/renderer/onboarding/editor/project-setup-editor.tsx#L26) also depends only on the dark boolean.

[readCssSize](../../apps/desktop/src/platform/renderer/lib/read-css-size.ts#L2) applies `parseFloat` to custom property text. Its current split dimensions use pixel values. Replacing those tokens with `rem` or `calc()` expressions needs real CSS unit resolution. Examples of these consumers are [CockpitShell:128](../../apps/desktop/src/platform/renderer/cockpit/components/cockpit-shell.tsx#L128) and [InspectorSplit:70](../../apps/desktop/src/platform/renderer/cockpit/inspector-split/inspector-split.tsx#L70).

[Storybook's decorator](../../apps/desktop/.storybook/preview.ts#L19) updates both appearance mechanisms. Its toolbar offers Light and Dark. It does not test System preference resolution. The [Vitest story project](../../apps/desktop/vitest.config.ts#L13) supplies `initialGlobals: { theme: 'dark' }` with one Chromium instance. This source does not show an automated Light project. The required accessibility scan therefore does not prove both appearance states without an additional run.

## Migration order

Use small, reviewable owner clusters:

1. Resolve undefined typography and contradictory emphasis requests. This establishes what the repeated labels mean.
2. Reuse `ContractFailureAlert` and set the copy wrapper's matching button variant. These changes use existing owners.
3. Consolidate Session inspector headers and path titles. Review scrolling, actions, and mixed-direction paths together.
4. Finish onboarding row and tile recipes inside onboarding. Keep each interaction with its current owner.
5. Audit icon role omissions and explicit numeric icons by semantic cluster. Keep decorative sizes separate from control roles.
6. Add theme invalidation or CSS unit resolution only when the theme model or token units require it. Make appearance review cover Light and Dark.

This order needs no broad generic component library. Tokens own reusable visual values. Recipes own combinations of values. Components own structure and interaction. Screen containers own state and local arrangement. Registry-generated primitives retain their current generator boundary.

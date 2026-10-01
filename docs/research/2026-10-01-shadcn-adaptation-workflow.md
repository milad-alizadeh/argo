# Shadcn adaptation and update workflow for the desktop cockpit

2026-10-01. Follow-up to [the token audit](2026-10-01-token-theme-audit.md) and [proposed architecture](2026-10-01-token-theme-system.md). This is a proposed workflow, not an implemented gate or an approval to replace registry files. It preserves the user's requirement that shadcn components keep their original sizes and styling while Argo uses an app-owned visual layer.

## The ownership choice

shadcn/ui distributes source code into the project and explicitly invites its owners to edit that code. Its introduction calls this “Open Code” and presents direct editing as the normal customization path. The CLI has read-only ways to inspect a registry item and compare a project file with the current registry version. [shadcn introduction](https://ui.shadcn.com/docs), [CLI reference](https://ui.shadcn.com/docs/cli), [March 2026 CLI v4 announcement](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4).

**Argo policy is deliberately stricter:** Treat `apps/desktop/src/platform/renderer/components/ui/` as registry-owned source. Do not hand-edit it for product typography, spacing, or behavior. Keep app compositions and recipes outside that directory. This is a local maintenance rule, not a claim that shadcn requires immutability. `docs/design-stack.md` already says authors do not edit `ui/` by hand. The local `components.json` selects `base-nova`, Base UI, `cssVariables: true`, and the `ui` alias. `apps/desktop/package.json` fixes `shadcn` at `4.21.0`; `bun.lock` resolves Tailwind to `4.3.3`. The CLI version is pinned by the repository dependency, but the hosted registry payload is a separate source that can change. [shadcn components.json reference](https://ui.shadcn.com/docs/components-json), [shadcn CLI reference](https://ui.shadcn.com/docs/cli).

This policy does not require a wrapper for every primitive. Product code can import an unmodified registry component directly when its default structure, behavior, and typography fit. An app-owned composition is warranted when several product callers need the same different text role, state, or behavior. One-off layout stays with its owner. A wrapper that simply forwards every prop and changes nothing adds maintenance work without a visual contract. This is an Argo recommendation.

## The current fault line

The checked-in `ui/empty.tsx` contains `type-title` on `EmptyTitle`, `type-body` on `EmptyDescription`, and `type-body` on `EmptyContent`. Those are Argo roles inside the registry directory. The file's origin or exact divergence cannot be inferred from its location alone. The current global `tokens.css` also redefines Tailwind's `--text-xs`, `--text-sm`, and `--text-base` through app roles, so an unchanged registry class can render at a different size. `styles/typography.css` repeats selectors such as `.type-body.type-body`; `styles/globals.css` has unlayered rules for `[data-slot="icon"]`, focus ring shadows, and button-like element weight. These affect registry output without touching a registry file. The audit's installed Tailwind compiler probe confirms that `text-xs`, `text-sm`, and `text-base` currently resolve through Argo's roles. [Local audit and probe](2026-10-01-token-theme-audit.md), [inventory](2026-10-01-token-inventory.json), [Tailwind theme variables](https://tailwindcss.com/docs/theme).

shadcn's current Empty documentation describes a composition of `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, and `EmptyContent`, each with a `className` prop. It does not promise the exact `base-nova` font sizes in that API table. Today's GitHub base source uses `cn-empty-*` classes, whose styling is elsewhere, so copying a guessed `text-sm` or `text-lg` from a different style would be unsound. Fetch and compare the resolved `base-nova` item before restoring this file. [Empty documentation](https://ui.shadcn.com/docs/components/base/empty), [official current base source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/empty.tsx).

There are three distinct proofs:

| Proof | Question | Evidence |
| --- | --- | --- |
| Registry source identity | Is `ui/empty.tsx` the transformed output of the chosen registry item? | Capture the fetched item, source URL, fetch date, content hash or upstream commit, CLI version, selected style/config, and a candidate generated in scratch space. Compare the candidate with the checked-in file after accounting for documented import/path transformations. |
| Default namespace intact | Does `text-sm` still mean Tailwind's default size, and do global selectors leave registry shapes alone? | Inspect theme definitions and compiled `text-xs/sm/base` plus any affected utility. Check global rules that target generic elements or registry `data-slot`s. [Tailwind theme variables](https://tailwindcss.com/docs/theme), [font-size utilities](https://tailwindcss.com/docs/font-size). |
| Rendered defaults intact | Does a direct, unadapted registry component look and behave as intended in Argo? | Render an unadapted story beside the fetched reference for Light and Dark; inspect computed font size, line height, weight, spacing, icon dimensions, focus, and color roles. Run visible-control and accessibility checks. Source equality alone does not prove runtime equality. |

The first check also needs a chosen baseline. “Original” can mean the exact payload that was installed or the current live registry item. Record both when they differ. `add empty --diff` compares the project with the registry state it fetches now; it does not by itself reconstruct the historical install payload or explain whether a local difference came from an intentional edit, a CLI transform, or a registry update. [shadcn CLI reference](https://ui.shadcn.com/docs/cli), [March 2026 CLI v4 announcement](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4).

## The app layer

Keep `tokens.css` as the single authored shared theme contract, including shadcn's semantic color names and complete Light/Dark values. shadcn recommends CSS variables for such roles and expects pairs like `primary`/`primary-foreground`. A palette can change while a registry component keeps the same role and class string. Preserve Tailwind's default type and size meanings; app typography gets its own names, such as `--typography-body-size` and an explicit `type-body` utility. The proposed architecture gives one owner's geometry to that owner and shared roles to the central contract. [shadcn theming](https://ui.shadcn.com/docs/theming), [Tailwind theme variables](https://tailwindcss.com/docs/theme), [proposed architecture](2026-10-01-token-theme-system.md).

App-owned styling must be opt-in. Scope typography recipes to an app composition or put the role class on the specific element. Do not use a global `button`, `svg`, `[data-slot="empty-title"]`, or `.type-*` rule that silently changes every registry use. Tailwind's `@utility` can define app classes in the utility layer. CSS cascade layer order, specificity, and `!important` still decide the rendered result; a class passed through `className` is not proof that it overrides or replaces the component's own text class. Unlayered normal rules can beat layered utilities, and repeating `.type-body.type-body` raises specificity over a caller's ordinary weight class. [Tailwind custom utilities](https://tailwindcss.com/docs/adding-custom-styles), [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer), [MDN specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity).

For `Empty`, first restore the registry source after the resolved `base-nova` comparison. Then choose the smallest app composition that gives product empty states their intended typography. A schematic interface is below; it is **not** a claim about current registry classes or a ready patch:

```tsx
// App-owned module outside components/ui; implementation chosen after the
// fetched Empty source and compiled CSS are inspected.
function ProductEmpty({ title, description, actions }: ProductEmptyProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle className="product-empty-title">{title}</EmptyTitle>
        <EmptyDescription className="product-empty-description">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {actions ? <EmptyContent>{actions}</EmptyContent> : null}
    </Empty>
  )
}
```

The app classes in that example are recipe names, not verified CSS. Before using them, inspect the actual base styles and compiled cascade. If `EmptyTitle` owns a font-size class that `cn` removes when given another Tailwind font-size utility, a tested explicit class override can suffice. If it owns a `cn-empty-title` rule with stronger or different layer precedence, use a scoped app recipe with a documented override and verify computed values. Avoid `!important` and broad selectors as a workaround. Argo's `cn` is customized with a hand-maintained `TEXT_SIZES` list that currently includes metadata names such as `body-weight`; class merging needs a focused test when app roles are introduced. [Local `cn` configuration](../../apps/desktop/src/platform/renderer/lib/utils.ts), [Tailwind custom utilities](https://tailwindcss.com/docs/adding-custom-styles), [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer).

### A concrete typography bridge

Current Vite, Storybook, and TypeScript configuration redirect imports from `cn` to Argo's configured helper. A Node probe of the bare package alone does not reproduce that alias. The configured helper still does not recognize `type-body` as a complete typography override. A probe with its current `TEXT_SIZES` extension leaves `text-sm font-medium tracking-tight type-body` intact. Thus passing one app role class does not remove the vendor's competing size, weight, and tracking classes. [Vite alias](../../apps/desktop/vite.renderer.config.ts#L35), [Storybook alias](../../apps/desktop/.storybook/main.ts#L54), [TypeScript paths](../../apps/desktop/tsconfig.web.json#L18), [cn custom themes](https://github.com/shadcn-ui/cn#custom-themes).

When the chosen registry version uses standard mergeable Tailwind utilities, an app-owned role recipe can expand to a complete static class string:

```ts
const titleRole =
  'text-(length:--typography-title-size) ' +
  'leading-(--typography-title-line-height) ' +
  'font-(weight:--typography-title-weight) ' +
  'tracking-(--typography-title-tracking)'
```

Use the same shared role recipe for an adapted Empty title and the corresponding custom product title. Keep this expansion in the app typography owner, not in every caller. The values remain authored once in CSS. Title versus heading is a design choice; the recipe must select the role that the product approves. [Tailwind font size](https://tailwindcss.com/docs/font-size), [line height](https://tailwindcss.com/docs/line-height), [font weight](https://tailwindcss.com/docs/font-weight), [letter spacing](https://tailwindcss.com/docs/letter-spacing).

Read-only probes in this worktree used the configured `createCn` extension with installed `cn@0.2.6`. Given `text-sm font-medium tracking-tight` and the complete role string above, it removed those three competing classes. Given `text-sm/relaxed text-muted-foreground`, it retained the semantic text color and replaced the size and line-height shorthand. The installed Tailwind 4.3.3 compiler emitted all four expected properties from the role variables. These probes establish merging and generation, not browser rendering or the unverified original `base-nova` Empty classes.

If the selected registry instead expresses typography through a `cn-empty-title` stylesheet rule, arbitrary utility merging does not remove that rule. A second option is a root-scoped app recipe that targets only Empty's declared slots and applies the same role values. Put the override in the appropriate utility layer or an explicitly scoped app layer with established priority. Do not assume `@layer components` overrides utilities: utility-layer declarations win over the component layer. An unlayered scoped rule also wins, but then ordinary caller utilities cannot replace its values. Prefer explicit app variants for that route and test the resulting cascade. [Tailwind component classes](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes), [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer).

Keep computed typography checks in a dedicated browser/style-contract test. Storybook `play` functions continue to assert reader-visible behavior and accessible semantics under the desktop rules. Manual temporary captures supply visual review. This keeps each proof in the test surface that can actually establish it. [Desktop Storybook rules](../../apps/desktop/AGENTS.md#storybook).

The target has two simultaneous outcomes: a direct `Empty` retains its selected registry defaults, and `ProductEmpty` matches the approved Argo title and description roles. They need not have the same typography. Preserving source while changing a global palette is compatible with shadcn's semantic theme model; preserving *rendered* defaults while applying Argo's different typography to every Empty is impossible if those requirements disagree. The opt-in composition resolves that tension. A custom Empty-like product component should consume the same app text roles and recipe where the intended pattern is shared; it need not import `Empty` if its structure or behavior differs. [shadcn Empty composition](https://ui.shadcn.com/docs/components/base/empty), [shadcn theming](https://ui.shadcn.com/docs/theming).

## Read-only drift and deliberate update

The installed `shadcn@4.21.0` CLI's local `add --help` confirms `--dry-run`, `--diff [path]`, `--view [path]`, `--cwd`, and `--overwrite`. Current official docs describe `add empty --diff` for checking registry changes and `add empty --view` for inspecting the payload; the older standalone `diff` command is deprecated by the installed CLI in favor of `add --diff`. Run commands from `apps/desktop` or pass `--cwd` to point there. Use the repository's installed CLI, not `npx shadcn@latest`, for the comparison tied to this app. [shadcn CLI reference](https://ui.shadcn.com/docs/cli), [March 2026 CLI v4 announcement](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4).

From `apps/desktop` in a worktree with dependencies installed, the documented read-only checks are:

```sh
rtk node ../../node_modules/shadcn/dist/index.js add empty --view
rtk node ../../node_modules/shadcn/dist/index.js add empty --diff
rtk node ../../node_modules/shadcn/dist/index.js add empty --dry-run
```

The command shape was verified against the installed CLI help. The registry request was attempted with `--view` on 2026-10-01 and failed with `ENOTFOUND ui.shadcn.com` in this worktree; no live payload was captured and no registry source was installed here. A separate web-tool attempt to open the `base-nova` Empty JSON endpoint also returned an access error. The current online documentation and GitHub base source are evidence of upstream behavior, not a substitute for a resolved `base-nova` payload. The CLI dependency version alone does **not** pin the mutable hosted registry. For a reproducible update, retain the exact fetched JSON and its hash in review evidence or use a commit-addressed upstream source after verifying it resolves to the same configured style and transforms. Official GitHub-registry guidance calls a full commit SHA the most reproducible ref for that registry mode; do not assume that rule silently pins the built-in shadcn endpoint. [shadcn GitHub registries](https://ui.shadcn.com/docs/registry/github), [CLI reference](https://ui.shadcn.com/docs/cli).

An update should proceed in this order:

1. **Record the baseline.** In a fresh worktree, record Argo commit, `components.json`, installed CLI and Tailwind versions, current `ui/` file hashes, and any earlier registry payload provenance. A missing earlier payload is an uncertainty, not proof of local customization.
2. **Read the current registry.** Run the read-only view, diff, and dry-run commands. Save a reviewable report with the fetched source identity, hash, dependencies, target files, and candidate differences. Do not run `--overwrite` as a discovery step. [shadcn CLI reference](https://ui.shadcn.com/docs/cli).
3. **Resolve each difference.** Compare current checked-in source to the fetched candidate in scratch space. Separate registry evolution, configured path/import transforms, and Argo modifications. Restore `ui/` to the chosen registry candidate only in a deliberate implementation change; move product variation to app-owned modules. Do not blanket overwrite unrelated primitives.
4. **Check the adapters.** Compile and inspect any app recipe that relies on class names, `data-slot`s, variants, ref/prop behavior, or `cn` merging. Review changed package dependencies and theme variables from the item payload. [Registry item schema](https://ui.shadcn.com/docs/registry/registry-item-json).
5. **Prove both render contracts.** Render direct registry defaults and adapted product states in Light and Dark. Pair the adapted `Empty` with the existing custom Empty-like product state, checking title/description size, line height, weight, spacing, media size, action layout, focus, and readable contrast. Exercise the relevant controls and accessibility semantics. Keep captures temporary under the repo's visual-verification rule.
6. **Review and land.** Review the complete diff and provenance report, fix findings, and commit the reviewed change. Run the full required local gate on that committed tree under the repo's quality rules. If a gate finds a defect, fix and commit it before rerunning the affected proof. Keep vendor refresh and app adaptation reviewable. Normal repo rules leave push and PR creation to `/ship`.

`--diff` is a **candidate update report**, not a source-identity proof or a rendered regression test. Three independent proofs remain necessary after every registry update: the selected source matches the checked-in primitive, default namespace and global CSS leave it intact, and the browser renders its defaults correctly. A failure in any one proof should be resolved before treating the update as routine.

## Acceptance criteria for the first implementation

- `ui/empty.tsx` matches an identified `base-nova` registry candidate after documented transforms; the source and hash are in review evidence. Any intentional Argo change inside `ui/` is called out as a policy exception, not hidden as a vendor default.
- The compiled default `text-xs`, `text-sm`, and `text-base` utilities retain their Tailwind meanings; Argo text roles use distinct names and do not change unadapted registry rendering. Global icon, focus, and control-weight rules are audited for the same effect.
- A direct Empty story and an app-adapted Empty story render in both appearances; their computed typography and layout match their respective reference. A custom product empty state uses the same app roles where its meaning matches. Interaction and accessible semantics are checked through visible controls.
- The drift report says which revision, style, CLI, payload, local file, and app adapters were compared. It can report “unknown historical baseline” honestly. It does not equate a zero CLI diff with proof that the browser looks the same.

These criteria turn the user's “keep the original shadcn styling” rule into observable checks while leaving Argo free to build its own visual language around the primitives.

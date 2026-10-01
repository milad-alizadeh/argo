# Shadcn workflows and token use: first-party research

2026-10-01. This note explains shadcn's expected workflow for component use, extension, and updates. It recommends the parts of that model that fit Argo. Recommendations assume a clean-slate design for a desktop app that is not live. For the concrete Empty comparison and drift checks, see [the dedicated workflow](2026-10-01-shadcn-adaptation-workflow.md).

## The core distinction

shadcn/ui is a source distribution system. Its official introduction says the project owns the copied component code and can edit it directly. It presents composition, a registry schema, and a CLI as ways to build a project-specific component library. That is the official workflow, including direct customization of the copied source. [shadcn introduction](https://ui.shadcn.com/docs).

Argo's requested workflow is stricter. Treat the installed `components/ui` files as pristine registry source and put product changes in app-owned code. This is a deliberate local rule, not an official shadcn requirement. It makes upstream comparison easier but moves customization to composition, app recipes, and occasional explicit policy exceptions. It does not imply a wrapper around every primitive. A direct import is the simplest use when the selected registry default fits. [shadcn introduction](https://ui.shadcn.com/docs), [Argo design stack](../design-stack.md).

## Select a base once

`components.json` tells the CLI which style, base color, CSS-variable mode, CSS entry, icon library, and aliases the project uses. Its `aliases.ui` determines the installed UI directory. The current official documentation says `style`, `tailwind.baseColor`, and `tailwind.cssVariables` are initialization choices. Changing CSS-variable mode requires reinstalling components. The CLI's `init --base` selects the underlying component library, while `add` uses the project's configuration. [shadcn components.json](https://ui.shadcn.com/docs/components-json), [shadcn CLI](https://ui.shadcn.com/docs/cli).

Argo already selects `base-nova`, Base UI, neutral, CSS variables, and its `ui` path in `apps/desktop/components.json`. Keep that one selected foundation for new registry shapes. If another base or style is required, treat the change as a project-wide design decision. Comparing and composing two different defaults weakens the pristine-source rule. The latter is an Argo inference, not a shadcn prohibition. [Local configuration](../../apps/desktop/components.json), [shadcn components.json](https://ui.shadcn.com/docs/components-json).

## Use the supplied semantic contract

shadcn recommends CSS variables for theming. Its generated classes consume names such as `background`, `foreground`, `primary`, and `primary-foreground`. Paired surface/foreground roles state what content belongs on a surface. It documents new roles under `:root` and `.dark`, exposed to Tailwind through `@theme inline`. Changing those role values changes the theme without rewriting component class strings. [shadcn theming](https://ui.shadcn.com/docs/theming), [shadcn Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4).

Tailwind theme variables are also utility definitions. A variable in `--text-*` creates a font-size utility, `--color-*` a color utility, and `--spacing-*` spacing and sizing utilities. Plain CSS variables do not create utilities. Tailwind recommends `@theme inline` when a utility-facing variable references another variable so the generated utility resolves the reference at the consumer. Resetting a namespace with `--color-*: initial` removes its default values and utilities. [Tailwind theme variables](https://tailwindcss.com/docs/theme), [Tailwind font size](https://tailwindcss.com/docs/font-size).

For Argo, keep one CSS-authored shared theme contract with shadcn's existing semantic names as the compatibility layer. Add an Argo role only for a missing meaning, such as a domain status ink or an app text role. A second complete vocabulary of `argo-background`, `argo-card`, and `argo-primary` gives two names to the same decisions.

Preserve default `text-xs`, `text-sm`, `text-base`, spacing, and component size semantics so a pristine registry file renders as its selected style intends. Put product typography behind separate, opt-in names such as `--typography-body-size` and `type-body`. Ordinary custom properties are enough unless a utility is needed. This conclusion follows from Argo's pristine-default requirement and the documented Tailwind/shadcn binding model. It is not a universal shadcn rule. [shadcn theming](https://ui.shadcn.com/docs/theming), [Tailwind theme variables](https://tailwindcss.com/docs/theme), [Argo token architecture](2026-10-01-token-architecture-practices.md).

A small file split is sensible. One central contract declares the shared role names and utility bindings. Each theme file supplies Light and Dark values for those roles. Each role has one authored value per theme and appearance. Neither a second TypeScript palette nor a giant all-owner `tokens.css` is needed. Keep component geometry and domain-only decisions with their owners.

This is a source-organization recommendation, not a format mandated by shadcn or Tailwind. It preserves the single CSS source of truth and makes theme completeness reviewable. [shadcn theming](https://ui.shadcn.com/docs/theming), [Tailwind theme variables](https://tailwindcss.com/docs/theme).

This still allows a custom Argo palette. "Pristine component styling" can mean unchanged source, classes, layout, and size while semantic colors take theme values. If it instead means pixel-identical colors to a particular upstream screenshot, a custom palette and that requirement conflict. Define the reference before evaluating a visual change. This is an inference from shadcn's semantic theming model. [shadcn theming](https://ui.shadcn.com/docs/theming).

An app typography role is necessary only where product text opts into product typography. A direct registry title or description can keep its default text utility. Adding an app role to every registry text slot defeats unchanged default rendering. If an app-owned composition adapts a slot, apply its role at that composition boundary. Make sure that the computed result matches the recipe.

Argo's current rule requires a typography role for every reader-visible string without an ownership exception. A local test expects `text-xs`, `text-sm`, and `text-base` to map to app roles. Scope the clean-slate policy to app-owned text and test the two contracts separately. Registry defaults retain the selected style's numeric scale, and adapted/product text uses named roles. This identifies a present rule/test conflict with the proposed policy. It does not establish why the existing remapping was written. [desktop instructions](../../apps/desktop/AGENTS.md), [local test](../../apps/desktop/src/platform/renderer/styles/typography-contract.test.ts).

## Extend the smallest owner

shadcn components already expose useful variants and composition points. The documented Button has `variant`, `size`, and `className`. Its `buttonVariants` helper can style a semantic link without turning that link into a button. Empty is a composition of header, media, title, description, and content, with `className` at each part. These APIs let a caller choose an existing shape before writing a wrapper. [shadcn Button](https://ui.shadcn.com/docs/components/base/button), [shadcn Empty](https://ui.shadcn.com/docs/components/base/empty).

Class Variance Authority (CVA), which shadcn source uses, defines named variants and compound variants for repeated class combinations. Tailwind's `@utility` defines reusable utility classes, including variant support. shadcn's registry schema can distribute components, styles, and themes across projects, but one Electron renderer does not need a private registry merely to share local app recipes. [CVA variants](https://cva.style/getting-started/variants/), [Tailwind custom styles](https://tailwindcss.com/docs/adding-custom-styles), [shadcn registry item schema](https://ui.shadcn.com/docs/registry/registry-item-json).

For Argo, apply this decision order in new UI work:

1. Import a registry component directly when its default and existing variant fit.
2. Pass a local `className` for one owner's layout adjustment when it does not alter the shared component contract.
3. Make an app-owned recipe or composition outside `ui/` when several product uses share a different text role, state, or behavior. Name the variant for its role, not a pixel value.
4. Make an app-owned component when shared structure or accessibility behavior is real.
5. Add a registry item or shared library only when distribution to another project is a current requirement.

Keep a component's internals in the owning domain until cross-domain reuse is proved. The steps are Argo's ownership policy, not an official shadcn hierarchy. If an adapted Empty and a custom product component express the same text roles, use the same app typography recipe. They need not have the same markup or import `Empty` when their structures differ. Reuse the role decision, then reuse the component only when behavior and structure also match.

## Class merging is not a style proof

shadcn's `cn` project merges conflicting Tailwind classes and supports custom class groups through `cn/config`. Argo's configured helper extends the font-size group with a hand-maintained list. A passed app role can fail to replace a vendor font, weight, or tracking rule if the merger does not know the relationship. Class merging also cannot remove a separate CSS selector's declaration.

CSS cascade layers and specificity still determine the rendered value after class merging. Normal unlayered CSS can override layered utilities. For `!important` declarations, earlier layers take priority over later layers. [shadcn `cn`](https://github.com/shadcn-ui/cn#custom-themes), [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer), [MDN specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity), [local helper](../../apps/desktop/src/platform/renderer/lib/utils.ts).

For Argo, a product text recipe defines size, line height, weight, and tracking as one named choice. Make sure that `cn` handles the actual registry classes. Inspect computed styles in the browser. Keep app override selectors scoped to the app composition.

Global `button`, `svg`, or registry `data-slot` selectors can silently change an untouched primitive. Avoid relying on a repeated `.type-body.type-body` selector or `!important` for ordinary customization. These are design rules inferred from CSS behavior and Argo's pristine-default goal, not shadcn requirements. [Tailwind custom styles](https://tailwindcss.com/docs/adding-custom-styles), [MDN cascade layers](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer).

## Add and update with evidence

The current CLI documents `add --dry-run`, `add --view`, and `add --diff`. They preview without writes, show resolved file content, and compare with the current registry item, respectively. Its `--overwrite` writes existing files, so it belongs in a deliberate update, not discovery. The installed `shadcn@4.21.0` CLI help was checked on 2026-10-01 and supports those flags. Its standalone `diff` command is marked deprecated in favor of `add --diff`. Official CLI v4 guidance says `--diff` can check for registry updates. [shadcn CLI](https://ui.shadcn.com/docs/cli), [CLI v4 announcement](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4).

The built-in shadcn registry is fetched from a hosted endpoint. Pinning the CLI dependency does not freeze that remote payload. Official GitHub-registry guidance says a full commit SHA is the most reproducible ref for GitHub registry addresses. It does not establish that a bare built-in item name has a pinned revision. A `--diff` result compares with the fetched payload and cannot alone distinguish upstream evolution from local edits. [shadcn CLI](https://ui.shadcn.com/docs/cli), [shadcn GitHub registries](https://ui.shadcn.com/docs/registry/github).

For Argo, use this clean-slate workflow:

1. Keep `components.json` and the installed CLI version fixed for a review.
2. Read the item with `--view`, `--diff`, or `--dry-run`. Record the fetched payload or upstream commit, content hash, fetch date, style/base, dependencies, and affected files in review evidence.
3. Choose the exact registry candidate and update only named registry files. Review app recipes against any changed variants, slots, or class names. A zero CLI diff proves neither source provenance nor visual equivalence.
4. Render a direct default and its app adaptation in both appearances. Make sure that computed typography, layout, focus, and colors match each reference. Exercise visible controls and accessibility behavior. Use temporary captures for visual review. Keep ordinary code review and repo gates as the landing proof.

Use the CLI from the app workspace. The first two steps are built on documented CLI capabilities. Provenance capture, selective update, and paired rendering are Argo recommendations. No wrapper or private registry is required to satisfy them.

## Limits

The live `base-nova` Empty registry payload was not available to this research session: the installed CLI's read-only `add empty --view` failed with `ENOTFOUND ui.shadcn.com`, and a direct web-tool read of that JSON endpoint failed. The official Empty API and upstream base source were opened, but neither establishes the resolved `base-nova` title or description size. This note therefore states no exact original Empty measurements. [shadcn Empty](https://ui.shadcn.com/docs/components/base/empty), [official base source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/empty.tsx).

This is source research, not a rendered test of Argo's current components. The [dedicated workflow](2026-10-01-shadcn-adaptation-workflow.md) records the local Empty and global CSS interactions that a clean implementation must verify.

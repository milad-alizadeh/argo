# Clean-slate token, theme, and component plan

2026-10-01. This is the recommended plan for an app that is not live. It replaces the migration sequence in [the earlier architecture proposal](2026-10-01-token-theme-system.md). It does not change production code or the current agent instructions.

Build on the selected shadcn style as the default visual language. Give app-specific decisions explicit owners. Keep theme colors, text recipes, and component behavior separate.

This plan combines [the source audit](2026-10-01-token-theme-audit.md), [token research](2026-10-01-token-architecture-practices.md), [theme research](2026-10-01-theme-management-practices.md), and [official shadcn workflow research](2026-10-01-shadcn-official-workflows.md). The recommendations are Argo decisions, not requirements imposed by shadcn.

## 1. Choose one component foundation

Use Base UI and one shadcn style. The current choice, `base-nova`, is a reasonable starting point. Select its configuration once and record the installed registry source. This plan does not compare other styles or approve their exact measurements.

Keep `components/ui` as registry-owned source under Argo's requested policy. Use its components directly when their defaults fit. Keep their default type sizes, spacing scale, variants, and focus behavior intact. Official shadcn permits direct source edits. The stricter boundary is our maintenance choice. [Official ownership and configuration research](2026-10-01-shadcn-official-workflows.md#the-core-distinction).

Define preservation precisely: component source, structure, and default size meanings remain intact, while semantic colors take the selected theme's values. A custom palette intentionally changes colors. It cannot also remain pixel-identical to the original palette.

Done: an unadapted Button, Input, Dialog, and Empty have an identified source and reviewed default rendering in Light and Dark.

## 2. Define one small token contract

Use CSS as the authored source. Keep one central contract for shared names and Tailwind bindings. Put each theme's color values in its own CSS file. One contract does not require one giant file.

Use shadcn names where the meaning already exists: `background`, `foreground`, `card`, `popover`, `muted`, `primary`, `accent`, `border`, `input`, and `ring`, including their required pairs. Keep the selected registry's required compatibility roles. Add an app role only for a missing meaning, such as a status or syntax color. Do not create a parallel `argo-background` vocabulary. [Semantic contract research](2026-10-01-shadcn-official-workflows.md#use-the-supplied-semantic-contract).

The ownership rules are:

- Shared colors and repeated design decisions belong in the central contract.
- Theme files assign complete Light and Dark color values to that contract.
- App text roles describe title, heading, body, metadata, or code where those purposes differ.
- One component's width, inset, or runtime measurement stays beside its owner.
- Ordinary local layout uses the existing Tailwind spacing utilities.

Keep app typography metadata outside Tailwind's `--text-*` size namespace. Use ordinary names such as `--typography-body-size`, `--typography-body-line-height`, `--typography-body-weight`, and `--typography-body-tracking`. Base the initial app scale on the selected registry style. Approve any difference explicitly. [Tailwind namespace research](2026-10-01-token-architecture-practices.md#css-and-tailwind-resolution).

Equal values do not always mean duplicate roles. Keep two names when their meanings can change independently. Merge two names for one meaning. Keep optional raw palette aliases only when they remove real repetition.

The proposed source layout is:

```text
platform/renderer/
  styles/
    globals.css                 imports, resets, root theme selectors
    tokens.css                  shared foundations and utility bindings
    themes/
      default.css               complete Light and Dark colors
      <theme-id>.css            complete Light and Dark colors
  lib/
    typography.ts               app text recipes, without copied values
  components/
    ui/                         selected registry output
    product-empty.tsx           proven cross-domain composition, if needed

domains/<owner>/renderer/
  <component>.tsx               owner-specific structure and behavior
  <component>.css               owner-specific geometry, when needed
```

These are proposed locations, not files created by this research. Theme identity metadata can live in TypeScript. Color values remain authored in CSS. A generated native background artifact is output, not a second authored palette.

Done: every shared token has one meaning, and each visual decision has a clear owner.

## 3. Share recipes and behavior at the right boundary

A recipe is a named combination of styling decisions. A component owns structure, interaction, and accessibility behavior. Reuse each only when callers share that contract.

Choose in this order:

1. Use an existing registry component and its variant when they fit.
2. Keep one owner's layout adjustments with that owner.
3. Use an app recipe for a repeated product-specific visual choice.
4. Use an app composition for repeated structure or behavior.

There is no wrapper for every registry primitive. There is no universal typography class on every text slot. A direct registry text slot already owns its default typography.

For app text, keep each approved recipe in one place. A complete recipe chooses size, line height, weight, and tracking. Use static Tailwind classes that consume the role variables where class merging supports them. Test merging and the rendered result. A custom role name alone does not prove that it replaces the registry's classes. [Verified recipe and cascade examples](2026-10-01-shadcn-adaptation-workflow.md#a-concrete-typography-bridge).

The Empty example has two valid cases. A direct `Empty` keeps the selected registry defaults. If product empty states need different text or structure, `ProductEmpty` owns that difference outside `ui/`.

A custom product empty state and an adapted registry Empty use the same app title and description recipes when their meaning matches. If registry defaults already fit, keep them. Match the approved recipe, rather than copying a guessed pixel size between files.

Keep app overrides scoped to the app composition. Avoid global element or registry-slot rules that change all controls, icons, or focus rings. Keep default `text-xs`, `text-sm`, `text-base`, and numeric spacing meanings intact.

Done: direct registry defaults remain intact, and equivalent product states share the same intentional text and behavior choices.

## 4. Give theme state one owner

Keep theme identity separate from appearance preference. A theme such as `default` or `argo` supplies both Light and Dark. System chooses an appearance from the operating system. It is not a third palette.

For Electron, main owns the saved preference and its resolved state. Validate stored identifiers, expose the initial state and change operation through preload, and subscribe to one change event. Apply `data-theme`, the resolved `.dark` class, and `color-scheme` on `<html>` before the window becomes visible. [Electron and root-state research](2026-10-01-theme-management-practices.md#recommended-state-model).

Start with color themes. Keep typography and density stable unless the product explicitly approves them as separate customization choices. Follow ADR-0038: opaque surfaces, the accepted surface hierarchy, and shadows only on unanchored overlays. Custom colors do not authorize different surface behavior. [ADR-0038](../adr/0038-the-desktop-cockpit-is-opaque.md).

Give native windows, diagrams, charts, and editors the same resolved colors as the DOM. Generate the native background from the CSS source using a concrete opaque value accepted by Electron. Resolve CSS colors at library boundaries that need concrete values. Use one syntax-color policy for both code consumers.

Every copied color snapshot refreshes when theme identity or resolved appearance changes. Switching between two dark themes must still update diagrams, editors, and the native background. Put selectors on `<html>` so ordinary body-mounted portals inherit them.

To add a code-defined theme:

1. Add one theme file with complete Light and Dark values for the shared color contract.
2. Import that file and register its identifier and display label.
3. Run completeness, contrast, native equality, and rendered contract checks.

Components and utility bindings remain unchanged. A runtime theme editor or import format is outside the present need.

Done: a second theme works at startup and during a same-appearance switch without component-specific theme branches.

## 5. Make the rules and tests match the system

The current desktop rule requires a role for every visible string without distinguishing registry-owned text. The typography test also requires global size remapping. These rules do not express the desired ownership boundary. [Instruction conflict in the audit](2026-10-01-token-theme-audit.md#13-agent-instructions-do-not-define-the-typography-boundary).

Use `docs/design-stack.md` as the authoritative design contract. Keep a short conditional pointer in `apps/desktop/AGENTS.md`. Put the ownership rule, theme contract, and extension workflow in the design contract once. Replace the blanket string rule with the following proposed policy:

```text
Direct registry components use their selected registry typography.
App-owned text and deliberately adapted slots use approved app text recipes.
An intentional inherited recipe satisfies the app text rule.
Product adaptations live outside components/ui.
Default Tailwind size and spacing namespaces retain their meanings.
Shared roles belong in the central contract.
Owner-local geometry stays local.
```

This is proposed wording, not an edit to the current instructions. Update the instructions and their contract tests in the same implementation change. Replace assertions that require remapped default sizes with assertions that preserve the selected baseline.

Check the separate contracts:

- Token checks reject same-block collisions, missing required roles, and invalid typography namespaces.
- Theme checks cover every resolved palette, foreground/ground pair, and same-appearance switch.
- Native checks prove that window and CSS backgrounds agree.
- Browser checks prove registry defaults and app adaptations separately, including typography and focus.
- Class-merging checks exercise the public app recipe interface.
- Storybook interaction and accessibility checks cover Light and Dark through visible controls.

Keep computed-style assertions in dedicated browser contract tests. Keep Storybook `play` focused on visible behavior and accessible semantics, as the desktop rules require.

For additions and updates, use the installed CLI to inspect the registry candidate. Record its source identity and review changes before writing named files. Then review direct and adapted rendering. A drift report compares source candidates. It does not prove that global CSS leaves their rendering intact. [Official workflow research](2026-10-01-shadcn-official-workflows.md#add-and-update-with-evidence), [detailed update workflow](2026-10-01-shadcn-adaptation-workflow.md#read-only-drift-and-deliberate-update).

Done: a contributor can choose a component, role, recipe, or local value without inventing another global system.

## Boundaries and remaining choices

This plan defines ownership and workflow. The final palette, exact app text measurements, and custom theme labels still need product decisions. The exact live `base-nova` Empty payload was unavailable during research, so no original Empty size is assumed.

The original audit remains a record of the current app. Its migration ordering is not the implementation plan for this clean-slate direction. No aliases, staged deprecations, or compatibility wrappers are required solely for old app callers.

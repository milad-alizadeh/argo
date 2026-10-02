# Ready-made shadcn themes for Argo

**Checked:** 2026-10-02  
**Scope:** color-only use in Argo Desktop's existing Tailwind v4, shadcn Base UI token system. Theme means the selected color scheme; Mode means System, Light, or Dark. Each selected Theme must include both appearances, while System resolves the operating-system mode without changing the Theme.

## Recommendation

Run a visual trial with **Catppuccin**, **Ocean Breeze**, and **Northern Lights**. They offer visibly different purple, teal, and green/blue identities, each with actual Light and Dark definitions. My design judgment is that Catppuccin best preserves a calm work surface while adding clear color; Ocean Breeze and Northern Lights make useful more colorful alternatives. Do not choose by the theme preview alone: compare dense session lists, status badges, forms, popovers, sidebar, and charts in both modes.

Keep **Claude** and **Kodama Grove** in the five-theme research shortlist as warm alternatives, but rank them below the trial three: Claude's light destructive token is near-black, and Kodama Grove's supplied typography and prominent earthy surfaces would need to be disregarded or reviewed carefully. This is an aesthetic and compatibility judgment, not a source claim.

## Source and selection

The shadcn theme contract is semantic CSS variables: a surface token with its foreground counterpart, plus border, input, ring, chart, and sidebar roles. The official customization guide describes the `:root` / `.dark` model and color-variable roles. Argo already has its own Tailwind v4 `@theme inline` bindings and keeps component source. [shadcn theming guide](https://ui.shadcn.com/docs/theming) · [shadcn customization guide](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/customization.md)

The shortlist comes from the public [tweakcn Theme Picker gallery](https://tweakcn-picker.vercel.app/), a separate project whose README says its themes are adapted from the tweakcn collection and that it is not affiliated with tweakcn. Its project source is [MIT licensed](https://github.com/BankkRoll/tweakcn-theme-picker#license); it offers individual theme registry entries and manual CSS. The same repo identifies `registry/themes/*.css` as its canonical Tailwind v4/OKLCH source, with generated copies under `public/r/`. Direct source CSS and live preview links are listed below. [Project README and license](https://github.com/BankkRoll/tweakcn-theme-picker) · [canonical theme CSS directory](https://github.com/BankkRoll/tweakcn-theme-picker/tree/main/registry/themes) · [registry install instructions](https://tweakcn-picker.vercel.app/docs/installation)

The registry project documents 43 paired themes, v4 OKLCH exports, and selectors of the form `{theme}-{light|dark}`. Each candidate's source file was checked for both mode blocks and these roles: background/foreground, card, popover, primary, secondary, muted, accent, destructive and their foreground pairs, border, input, ring, chart-1 through chart-5, and sidebar/sidebar-primary/sidebar-accent/border/ring roles. The files also include radius, font, spacing, tracking, and shadow declarations; those declarations are present in the export but are explicitly outside Argo's import scope.

### Shortlist

| Theme | Preview | Direct token source | Light / Dark color character from the definitions | Assessment |
|---|---|---|---|---|
| **Catppuccin** | [preview](https://tweakcn-picker.vercel.app/) (select Catppuccin) | [catppuccin.css](https://github.com/BankkRoll/tweakcn-theme-picker/blob/main/registry/themes/catppuccin.css) | Light: cool lavender-gray background, vivid violet primary, cyan-blue accent. Dark: deep purple-gray background, lighter lavender primary, cyan accent. | Recommended. Strong distinction without a fluorescent palette; verify dark destructive (`oklch(0.76 0.13 2.76)`) against Argo's separate danger indicator treatment. Full role set exists. |
| **Ocean Breeze** | [preview](https://tweakcn-picker.vercel.app/) (select Ocean Breeze) | [ocean-breeze.css](https://github.com/BankkRoll/tweakcn-theme-picker/blob/main/registry/themes/ocean-breeze.css) | Light: near-white cool background, green-teal primary, pale blue secondary and mint accent. Dark: deep blue background, teal primary and blue-slate surfaces. | Recommended. Very legible surface separation in Dark from the values; in Light, test white-on-green primary foreground contrast before adopting. Full role set exists. |
| **Northern Lights** | [preview](https://tweakcn-picker.vercel.app/) (select Northern Lights) | [northern-lights.css](https://github.com/BankkRoll/tweakcn-theme-picker/blob/main/registry/themes/northern-lights.css) | Light: near-white neutral surface, emerald primary, blue secondary and cyan accent. Dark: blue-charcoal background with green, blue and cyan roles. | Recommended as the more colorful third option. In Light the green primary and secondary both specify white foreground; check contrast in actual buttons. Full role set exists. |
| **Claude** | [preview](https://tweakcn-picker.vercel.app/) (select Claude) | [claude.css](https://github.com/BankkRoll/tweakcn-theme-picker/blob/main/registry/themes/claude.css) | Light: warm off-white/gray-brown surfaces and terracotta primary. Dark: neutral charcoal with terracotta primary and warm off-white text. | Alternate. Complete shadcn roles, but Light `--destructive` is near-black (`oklch(0.19 0 106.59)`), so destructive controls would not read as danger without a local override. Dark `--sidebar-border` is almost white (`oklch(0.94 0 0)`), likely too bright for a dense sidebar. |
| **Kodama Grove** | [preview](https://tweakcn-picker.vercel.app/) (select Kodama Grove) | [kodama-grove.css](https://github.com/BankkRoll/tweakcn-theme-picker/blob/main/registry/themes/kodama-grove.css) | Light: warm sage/cream surfaces with leaf-green primary. Dark: warm olive charcoal, muted green primary and ochre accent. | Alternate. Complete shadcn roles, but it declares Merriweather as sans, plus serif and shadow choices that Argo must ignore. Its Light background (`oklch(0.88 0.05 91.79)`) is notably tinted for a dense work view. |

The gallery labels Claude “Anthropic's signature warm terracotta”, Ocean Breeze “calm coastal blues and teals”, Northern Lights “aurora borealis greens and blues”, and Kodama Grove “forest spirits and natural harmony.” These are gallery descriptions; the mode-specific summaries above come from the linked CSS declarations. The preview is a gallery with a mode control rather than a stable per-theme permalink, so choose the named theme there and inspect each mode.

## Token compatibility and import limits

| Argo role | Candidate coverage | Notes |
|---|---|---|
| `--background` / `--foreground` | Present in both modes for all five. | Use as exported after selector adaptation. |
| `--card` / `--card-foreground`; `--popover` / `--popover-foreground` | Present in both modes for all five. | Keep pairs together; candidate values sometimes intentionally differ from background. |
| `--primary` / `--primary-foreground`; `--secondary` / `--secondary-foreground`; `--muted` / `--muted-foreground`; `--accent` / `--accent-foreground` | Present in both modes for all five. | Test all foreground pairs against their surfaces in rendered controls. White text on the light green Ocean Breeze and Northern Lights primary needs particular contrast scrutiny. |
| `--destructive` / `--destructive-foreground` | Both are present in all five source exports. | Argo's current `theme-bindings.css` maps `--destructive` but has no `--color-destructive-foreground` Tailwind binding, and current component source does not consume that paired utility. Preserve the source value only if needed; do not add a new binding without a current consumer. Use `--destructive` for native shadcn destructive treatments only. Values vary: for example Catppuccin Dark uses a soft rose and Claude Light uses near-black. Argo's `--danger-indicator` is a distinct app role and must not be blindly aliased to this token. |
| `--border`, `--input`, `--ring` | Present in both modes for all five. | All candidates provide these roles; inspect focus-ring and separator visibility in the running components. |
| `--chart-1` … `--chart-5` | Present in both modes for all five. | All five provide colored series. |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-primary` and foreground, `--sidebar-accent` and foreground, `--sidebar-border`, `--sidebar-ring` | Present in both modes for all five. | All five provide the dedicated sidebar set. Claude Dark's nearly white sidebar border is a specific review item. |
| Argo shared status roles (`--success`, `--warning-subtle`, `--warning-foreground`, `--active-indicator`, `--success-indicator`, `--warning-indicator`, `--danger-indicator`, `--complete-indicator`, `--neutral-indicator`, and other app roles) | **Not defined** in these exports. | Preserve or locally map these roles in Argo. The themes cannot supply Argo's status palette as-is. |

This follows the reviewed token owner at `apps/desktop/src/platform/renderer/styles/theme-bindings.css` and its two paired theme sheets in the reviewed `ticket-3102-shared-tones-badge` tree at `ee510d1997e23d437f405b995a6bc6ded049aa78`. Argo themes currently own extra colors and semantic status tokens beyond shadcn's core token set. The badge recipes read `warning-subtle` / `warning-foreground` for warning fills and separate indicator tokens for active, success, warning, danger, complete, and neutral marks (`components/design-system/tone-recipes.ts`).

**Status and destructive treatment should be decided separately.** The reported heavy brown Needs input badge is a warning-filled status treatment, so trial `--warning-subtle` and `--warning-foreground` locally as a restrained, paired surface/text treatment in both modes. The pastel-pink danger mark is `--danger-indicator` territory. Keep it independently mapped to a clearer danger indicator color. A theme's native `--destructive` may stay whatever the theme supplies for destructive buttons; do not use it as the warning fill or assume it is a good small danger indicator. None of these candidate exports supplies the warning/status roles, so those mappings are an explicit local compatibility task, not imported theme data.

### Safe manual adaptation example

The source files are color-plus-appearance bundles with selectors such as `[data-theme="catppuccin-light"]` and `[data-theme="catppuccin-dark"]`. Argo stores Theme and Mode independently. For a Catppuccin trial, take only the color role declarations listed above, put them under Argo's selectors, and retain its current Tailwind bindings and all component code:

```css
:root[data-theme="catppuccin"] {
  /* Copy the Light color-role declarations from catppuccin.css here. */
}

:root[data-theme="catppuccin"].dark {
  /* Copy the Dark color-role declarations from catppuccin.css here. */
}
```

The app's existing mode resolver adds/removes `.dark`; System therefore follows OS appearance while `data-theme="catppuccin"` stays selected. For review, compare the linked original definitions side by side. Do not copy `--radius`, `--font-*`, `--spacing`, `--letter-spacing`, `--shadow-*`, `--tracking-normal`, or provider/component files. Preserve Argo's `@theme inline` bindings, its native component geometry, and its existing component source.

The vendor's convenient command is `npx shadcn@latest add https://tweakcn-picker.vercel.app/r/theme-catppuccin.json`; its README says the registry adds individual theme CSS. Its full-system command adds a ThemeProvider and switcher and assumes mode-qualified theme names. That model couples palette and appearance (`catppuccin-light` / `catppuccin-dark`) and does not match Argo's independent Theme/Mode contract. The registry `add` workflow is therefore **not plug-and-play for Argo**; use the direct canonical CSS as a source reference and manually adapt the color allowlist, or implement an explicit importer later. The vendor notes the CLI changes project files. Do not run the registry command against Argo during the Storybook trial.

The MIT license covers the theme-picker repository; its README says the themes are adapted from tweakcn and does not state per-theme attribution terms. If Argo copies CSS from this repository, include the repository's MIT license text as required by that license. Keep source/theme attribution in code or release notes as a courtesy and preserve any upstream notices copied with the CSS. The theme selection itself should be recorded by its upstream name and source URL, especially for Catppuccin and branded names.

## Proposed Storybook trial

Use the existing Theme and Mode toolbar globals on the currently served Storybook tree. Keep Theme as the palette choice and Mode as System, Light, or Dark; in System, confirm the OS-resolved appearance can vary without the selected palette changing. Reuse the existing stories—do not add duplicate Light/Dark stories.

1. Trial Catppuccin, Ocean Breeze, Northern Lights, Claude, and Kodama Grove one at a time through Theme. Inspect both Light and Dark using Mode on the same stories.
2. Review an existing session-list story with waiting/Needs input/active/completed/danger states, the appearance-dialog story, and representative button, input, popover, sidebar, and chart stories. Focus on dense text, surface hierarchy, separators and focus, primary/secondary contrast, warning-filled status, danger indicators, and destructive controls.
3. Record a short Light/Dark comparison for each candidate; reject any mode that requires changing typography, shape, spacing, shadows, or component source to look coherent. Separately record whether local warning and danger-indicator mappings need adjustment.
4. Choose two or three palettes for follow-up review based on visible distinction and readable pairs. Keep the same Storybook toolbar and story set for every candidate so only theme/mode changes.

The existing toolbar globals and `applyAppearance` path are visible in the reviewed tree's `.storybook/preview.ts`; no Storybook server or source change is part of this report.

# #3105 registry candidate record

Fetched 2026-10-02 from the selected `base-nova` registry with the installed `shadcn@4.21.0` CLI.
The configuration selects Phosphor icons, `rsc: false`, TypeScript, neutral colors, and CSS variables.
The raw hashes match the 2026-10-01 audit. Each payload declares `cn` as its dependency.
Menubar also declares `dropdown-menu` as a registry dependency.

The transformed hash covers the source emitted by `add <name> --view <name>.tsx`.
Only the preview framing was removed before hashing. No CLI command wrote a repository file.
The CLI resolves registry aliases, selects Phosphor imports, and formats the source.
All targets resolve under `apps/desktop/src/platform/renderer/components/ui/`.

| Item | Raw payload SHA-256 | Transformed source SHA-256 | Declared file target |
| --- | --- | --- | --- |
| `dropdown-menu` | `335c59dba30145f434a9cc9ccb0438a3c5e2afe857fc11b029de1ecb415224d7` | `4895571d12a00507a1648f40a073c5acd3c0474b1fc836a8e49f05c4ad41a666` | `registry/base-nova/ui/dropdown-menu.tsx` |
| `context-menu` | `57bfdd236a7f4cb83625edf4c33265ce009738947666d00311034a88f6868756` | `d94b2f803eb892bb5cf1f1dd4d86a4b96a8813065da8a7eb4fc2ce50755801d3` | `registry/base-nova/ui/context-menu.tsx` |
| `select` | `425e9b0a28b72617f18fabd75384050113295b88e7ba01c35bede2c72bd5d476` | `0536b0c0117737f40d27d7e38bc5b68e7c07943ed97d6b04eaafc42e7abf6c32` | `registry/base-nova/ui/select.tsx` |
| `menubar` | `265f030bd11d52072325f749bfd2c8070a9a1cc48098aa3fb245b2460801e6cd` | `70fd7478d5513d37f1bd5552d439aca8a0610f9d1a79bef219ecac1b3dd51efe` | `registry/base-nova/ui/menubar.tsx` |
| `navigation-menu` | `1fdd735ea7449af8ebbd932b3e89b34a1efa8a3b193ac979d0d723660526c017` | `8d9550c2a04d2d6262d7dee5058b6ae3f9a293fdddeb584fa437db85a37c3d80` | `registry/base-nova/ui/navigation-menu.tsx` |

Source review confirms that the only component-body differences are the audited `strokeWidth={2}` overrides.
This slice removes three in DropdownMenu, three in ContextMenu, four in Select, two in Menubar, and one in NavigationMenu.
The files retain local formatting, sorted imports and exports, and type-only React imports.
Menubar retains its relative DropdownMenu import instead of the CLI alias.
ContextMenu and Select retain their inert `use client` directives in the Vite renderer.
These are the exact recorded source transformations for this slice.

## App treatments

Composer owns its trigger and popup recipes. Caller classes merge with the required trigger classes.
The Mode popup uses `tabIndex={0}`, like the configuration popup, so its scrollable content remains keyboard accessible.
Its story proves that Tab closes the menu and reaches the following control.
Mode and model options share label and detail slots because each pairs a choice with explanatory text.
Model options retain native radios inside the named `ChoiceRow` treatment.
Work menus own their row and count recipes and compose the shared `MenuDropdownTrigger`.
Work titles and metadata wrap because both identify the work that a reader selects.
The configuration popup caps its height at Base UI's available space.
Model choices scroll independently from the Effort footer, so every control remains usable in a short viewport.
Context actions also compose that trigger. Their standard items keep registry typography.
`AllowButton` owns the separator treatment for its split action.

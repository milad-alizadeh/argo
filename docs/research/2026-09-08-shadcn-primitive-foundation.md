# The shadcn primitive foundation: one base, chosen once

**Date:** 2026-09-08 · **For:** [Choose the shadcn primitive foundation per component](https://github.com/milad-alizadeh/argo/issues/1753),
under the migration map [cross-platform Electron desktop migration](https://github.com/milad-alizadeh/argo/issues/1730),
amending the system choice [Select a React UI component system](https://github.com/milad-alizadeh/argo/issues/1731)
and extending [Map SwiftUI controls to shadcn/ui](https://github.com/milad-alizadeh/argo/issues/1742) ·
**Status:** docs verified against source; a recommendation, and every contradiction re-checked one by one

## The answer

**Hold one foundation everywhere. It is Base UI, and it is set once by `shadcn init -b base`, which is
already the default.** Nothing happens to `Sidebar` under this recommendation, because the premise
that `Sidebar` breaks the rule is **false**: `base/sidebar` imports `@base-ui/react`, not Radix.

Three facts decide it, and none was available to #1742.

**The foundation is a project-level flag, not a per-component switch.** `shadcn init` carries
`-b, --base <base>   the component library to use. (base, radix, aria)`. `shadcn add` carries **no**
base flag and no `base/<name>` prefix syntax, and `components.json` documents **no** foundation
field. So "each component's default" is not a configuration the tool offers — the three docs paths
are a docs toggle over three parallel registries, and the plain `add` command on all three variant
pages is byte-identical (`shadcn add dialog`).

**The components Argo needs most do not use a foundation at all.** `Message Scroller` and
`Questionnaire` take their behaviour from **`@shadcn/react`**, a headless package shadcn now ships
itself. `bases/base/ui/message-scroller.tsx` and `bases/radix/ui/message-scroller.tsx` carry the
*same* import — `from "@shadcn/react/message-scroller"`. `Message`, `Marker`, `Bubble` and
`Attachment` wrap nothing; they are `cva` markup. So the Feed and the Composer are untouched by this
decision, and #1752 and #1754 are not really blocked on it.

**The three variants are different APIs, not three skins.** `base/dialog` imports `Dialog` from
`@base-ui/react/dialog`; `radix/dialog` imports `Dialog` from `radix-ui`; `aria/dialog` imports
`Dialog, DialogTrigger, Heading, ModalOverlay, Modal` from `react-aria-components` — a different
composition with different part names for one concept. Mixing means two vocabularies for "a dialog",
not two stylesheets.

**A methodological finding, stated up front because it changes how the repo should read a fetch.**
Asked to summarise `/docs/components`, WebFetch invented the heading "All 77 components" on a page
whose header carries no count at all, and invented a host (`shadcn-ui.com`) it never fetched. The
"63 links under a header saying 77" contradiction is most likely that artefact rather than a defect
in the site. Counts and status codes below come from observed HTTP responses and from source files,
not from a summary.

## Verification: the five contradictions, one by one

All fetches 2026-09-08.

### 1. `/llms.txt` still says "Radix UI primitives" — **reproduced**

[`https://ui.shadcn.com/llms.txt`](https://ui.shadcn.com/llms.txt) — 200, 162 lines. One occurrence
of "radix", on line 3, verbatim: *"It is built with TypeScript, Tailwind CSS, and Radix UI
primitives."* **Zero** occurrences of "Base UI", "@base-ui" or "React Aria". Its component links are
the unprefixed `/docs/components/<name>` form, which now 307s to `/base/`. `llms.txt` is stale
against the rest of the site. The per-component pages are the more specific source and are what this
note uses.

### 2. The changelog carries no entry for the Base UI switch — **not reproduced**

[`https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default`](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
returns **200**, titled "July 2026 - Base UI as the Default". A control URL with the wrong month
(`2026-06-base-ui-default`) returns 404, so the 200 is the page and not a catch-all. The entry says,
verbatim:

> "Starting today, **Base UI is the default component library in shadcn/ui**."
> "Base UI is stable. It's at 1.6.0 with 6M+ weekly downloads."
> "Radix is not being deprecated. We still support it, and every update and new component will ship
> for both libraries (unless a component only exists in Base UI)."
> "Prefer Radix for new projects? It's one flag away: `pnpm dlx shadcn init -b radix`"
> "You don't need to migrate. But if you want to, we built a skill for it: `pnpm dlx skills add shadcn/ui`"

[`/docs/changelog`](https://ui.shadcn.com/docs/changelog) — 200 — also lists `2026-01-base-ui`,
`2026-02-radix-ui`, `2025-06-radix-ui` and `2026-07-react-aria`, all 200. The URL #1742 could only
cite from an earlier note is real. **#1742's caveat should be retired.**

### 3. `registry.json` returns 404 — **reproduced, and the live path found**

`https://ui.shadcn.com/registry.json` **404**. `https://ui.shadcn.com/r/registry.json` **404**. But
[`https://ui.shadcn.com/r/index.json`](https://ui.shadcn.com/r/index.json) is **200** and holds
exactly **63** entries, every one `"type": "registry:ui"`, each with `meta.links` for `base`, `aria`
and `radix`. Per-item JSON lives at `/r/styles/<base>-<style>/<name>.json`, all three verified:

| URL | result | first primitive import |
|---|---|---|
| `/r/styles/base-nova/dialog.json` | 200 | `import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"` |
| `/r/styles/radix-nova/dialog.json` | 200 | `import { Dialog as DialogPrimitive } from "radix-ui"` |
| `/r/styles/aria-nova/dialog.json` | 200 | `from "react-aria-components"` (Dialog, DialogTrigger, Heading, ModalOverlay, Modal) |
| `/r/styles/base-nova/index.json` | 200 | `dependencies: ["class-variance-authority","cn","lucide-react","@base-ui/react"]` |
| `/r/styles/radix-nova/index.json` | 200 | `dependencies: ["class-variance-authority","cn","lucide-react","radix-ui"]` |

The last two rows matter for the decision: **the primitive package is a dependency of the base's
*style* item, installed at `init`, not of any component.** Each component's own `dependencies` is
just `["cn"]`. So a component pulled by URL from a second base arrives importing a package the
project never installed.

### 4. "63 links under a header saying 77" — **not reproduced as stated**

[`/docs/components`](https://ui.shadcn.com/docs/components) — 200. The header is **"Components"**
with the subtitle *"Here you can find all the components available in the library. We are working on
adding more components."* **There is no count in the header**; neither "77" nor "63" appears as a
visible count anywhere on the page.

Observed unique hrefs in the raw HTML: **64** `/docs/components/base/*`, **63**
`/docs/components/aria/*`, **65** `/docs/components/radix/*`. A real 63 exists but elsewhere:
`r/index.json` holds 63 UI registry items, and
[`bases/base/ui/_registry.ts`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/_registry.ts)
names exactly 63. The docs index is wider than the registry because it also lists guides that are not
single registry items (`data-table`, `date-picker`, `typography`). The spread across the three
variants is **observed and unexplained**; see *Unverified* below.

### 5. The Command page attributes `cmdk` to the wrong author — **overstated, not a misattribution**

[`/docs/components/base/command`](https://ui.shadcn.com/docs/components/base/command) — 200 — says:
*"The `<Command />` component uses the [`cmdk`](https://github.com/dip/cmdk) component by
[Dip](https://www.dip.org/)."* Checked against the public record:

- `https://github.com/pacocoursey/cmdk` returns **301** with `location: https://github.com/dip/cmdk`.
  The repository really moved; shadcn's link is current, not wrong.
- `https://registry.npmjs.org/cmdk/latest` — 200 — still lists `author` **Paco**
  (`github.com/pacocoursey`), `repository` `pacocoursey/cmdk`, and maintainers **paco** and
  **dipnpm** (`benji@dip.org`). Version 1.1.1.
- `https://www.npmjs.com/package/cmdk` was **403 Forbidden** to the fetcher — a blocked fetch, not a
  finding about the package.

So shadcn credits the current **steward** where npm still names the original **author**. That is a
repo transfer read as a misattribution. Not a reason to distrust the site.

### A sixth contradiction, and the one that voids the ticket's premise

**"`Sidebar` alone wraps Radix rather than Base UI" — not reproduced.** `/docs/components/sidebar`
307s to `/docs/components/base/sidebar` (200), whose source block and the file at
[`bases/base/ui/sidebar.tsx`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/base/ui/sidebar.tsx)
both open with:

```
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
```

`@base-ui` appears 4 times on that page; `@radix-ui` **0** times. The Radix variant is a genuinely
different file (`import { Slot } from "radix-ui"`). The Radix-era Sidebar source survives only at the
**legacy** endpoint `https://ui.shadcn.com/r/styles/new-york/sidebar.json` (200,
`"dependencies": ["@radix-ui/react-slot", ...]`), which is the deprecated `new-york` registry, not
today's default. If the #1742 reading came from there, it described the old registry.

**Consequence: the ticket's first bullet — "accepting that Sidebar breaks the rule" — has no subject.
There is no exception to accept.**

## Verification: the eight index entries

All eight are **real, published components with pages and installable code**. None is an index entry
with no page. Each exists as an authored `.tsx` file in **all three** bases' `ui/` directories
([base](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/base/ui),
[aria](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/aria/ui),
[radix](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/bases/radix/ui)).

| Entry | Page | What it is | Foundation it wraps |
|---|---|---|---|
| [Message Scroller](https://ui.shadcn.com/docs/components/base/message-scroller) | 200 | chat scroll container — anchoring, tail-follow, prepend-safe history, jump-to-message | **`@shadcn/react`**, foundation-independent |
| [Attachment](https://ui.shadcn.com/docs/components/base/attachment) | 200 | a file/image **chip**, with media, metadata, upload state and actions | none — `cva` markup |
| [Bubble](https://ui.shadcn.com/docs/components/base/bubble) | 200 | the message surface: variants, alignment, grouping, reactions | none (`/docs/react/bubble` 404) |
| [Direction](https://ui.shadcn.com/docs/components/base/direction) | 200 | `DirectionProvider` + `useDirection()` for RTL | not confirmed; docs never name the upstream package |
| [Marker](https://ui.shadcn.com/docs/components/base/marker) | 200 | inline status, system note, bordered row or labelled separator in a conversation | none — presentational |
| [Message](https://ui.shadcn.com/docs/components/base/message) | 200 | one conversation row: avatar, header, footer, alignment, `MessageGroup` | none — layout only |
| [Native Select](https://ui.shadcn.com/docs/components/base/native-select) | 200 | a styled native `<select>` | the HTML element |
| [Questionnaire](https://ui.shadcn.com/docs/components/base/questionnaire) | 200, "new" | multi-step single/multi/freeform/skippable questions | **`@shadcn/react`** + native form elements |

### `Message Scroller`, in the detail #1752 needs

API cross-referenced at [`/docs/react/message-scroller`](https://ui.shadcn.com/docs/react/message-scroller) (200).
Parts: `MessageScrollerProvider · MessageScroller · MessageScrollerViewport · MessageScrollerContent ·
MessageScrollerItem · MessageScrollerButton`. Hooks: `useMessageScroller()` →
`{ scrollToMessage, scrollToEnd, scrollToStart }`; `useMessageScrollerVisibility()` →
`{ currentAnchorId, visibleMessageIds }`; `useMessageScrollerScrollable()` → `{ start, end }`.

What it gives ADR-0030 for free:

- `Provider.defaultScrollPosition` — `"start" | "end" | "last-anchor"`, default **`"end"`**. This is
  ADR-0029's "a feed opens at its tail", as a prop.
- `Provider.autoScroll` (default `false`) — "Follow new content only while the reader is already at
  the live edge", with `scrollEdgeThreshold` (default `8`) defining the edge. That is ADR-0030 rule 5.
- `Viewport.preserveScrollOnPrepend` (default `true`) — "When older rows are prepended above the
  current transcript, `MessageScrollerViewport` preserves the visible row."
- `Item.scrollAnchor` + `Provider.scrollPreviousItemPeek` (default `64`) — a fixed-row anchor with a
  peek of the previous item above it. That is ADR-0030 rule 4's "preserved *position*".
- `Item.messageId`, and data attributes `data-scrollable`, `data-autoscrolling`,
  `data-pending-scroll`, `data-message-id`, `data-scroll-anchor`.

What it does **not** give: **"Virtualization is intentionally left outside the primitive."** The docs
point at `@tanstack/react-virtual` over `MessageScrollerViewport` for transcripts of thousands of
turns. It also documents no measurement, no off-main typesetting, and no event callbacks — scroll
state is read only through the three hooks, inside the Provider.

`@shadcn/react`, from [`registry.npmjs.org/@shadcn/react/latest`](https://registry.npmjs.org/@shadcn/react/latest)
(200): **version 0.3.1**, "Unstyled components for React.", MIT, `sideEffects: false`, **zero runtime
dependencies**, peers `react >=19` and `@types/react >=19` (both optional), exports only
`./questionnaire` and `./message-scroller`, unpacked **56,185 bytes** across 9 files.
`apps/desktop` runs React 19.2.1, so the peer is satisfied.

### `Attachment`, in the detail #1754 needs

**It is not a drop target.** Exports: `Attachment, AttachmentGroup, AttachmentMedia,
AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction,
AttachmentTrigger`. Props: `state` (`idle | uploading | processing | error | done`), `size`,
`orientation`, `AttachmentMedia.variant` (`icon | image`). The page's headings, in order, are
Attachment, Installation, Usage, Composition, Features, Image, States, Sizes, Group, Trigger,
Accessibility, API Reference. **No** drag, drop, file-input, paste or preview-generation logic appears
anywhere on it, and the source file confirms it: no `onDrop`, no `<input type="file">`, no clipboard
handling.

Corroborating negatives, all observed: `/docs/react/attachment` **404** (no headless counterpart, so
there is no behaviour to find); `/docs/components/base/file-upload` **404**;
`/docs/components/base/dropzone` **404**. **shadcn ships no file-acquisition component.**

## The recommendation

**One foundation, held everywhere: Base UI.** Run `shadcn init -b base` — which is the documented
default — and never pass a base again.

Why Base UI and not one of the other two:

1. **It is the widest set.** 63 registry items against `aria`'s 57. `aria` has no `menubar` at all
   (`/docs/components/aria/menubar` **404**, and `r/index.json`'s `menubar` entry carries `base` and
   `radix` links with the `aria` key absent), no `navigation-menu` and no `toast`. And the changelog
   reserves growth to Base UI in writing: new components ship for both libraries *"unless a component
   only exists in Base UI"*.
2. **It is the base the maintainers hold to a parity contract.**
   [`bases/README.md`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases/README.md)
   describes "two parallel registries" — `base/` and `radix/` — and requires that shared surfaces be
   changed in **both**. `aria` exists as a third directory registered in
   [`bases.ts`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/bases.ts) and is absent
   from that contract. It is the least-guarded of the three.
3. **It is what every default resolves to.**
   [`registry/config.ts`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/config.ts)'s
   `DEFAULT_CONFIG` is `{ base: "base", style: "nova", ... }`; every unprefixed docs URL 307s to
   `/base/`; the changelog makes Base UI the `init` default. Taking the default is the cheapest
   position to hold and the one the official migration skill assumes.
4. **It is stable, current, and written by the people who wrote Radix.** `@base-ui/react` **1.8.0**,
   published **2026-09-04** ([npm](https://registry.npmjs.org/@base-ui/react/latest)), MIT, peers
   `react ^17 || ^18 || ^19`. Its own releases page marks **1.0.0 on 2025-12-11** as *"Stable 🎉 —
   35 unstyled UI components"*, and minors have landed roughly monthly since. Its About page states
   the lineage plainly: *"From the creators of Radix, Material UI, and Floating UI, Base UI is an
   unstyled React component library for building accessible user interfaces"* — Colm Tuite and Jenna
   Smith, named on that team, are Radix Primitives' own authors. So choosing Base UI over Radix is not
   choosing against Radix's designers; it is following them.

**What happens to `Sidebar`: nothing.** It is a Base UI file already. It composes local `Sheet`,
`Tooltip`, `Button` and `Separator` and reaches into `@base-ui/react` only for `mergeProps` and
`useRender`. There is no exception to carve, and #1742's line "Sidebar is the one component the docs
say wraps Radix" should be struck.

**One caveat to hold honestly.** "Base UI 1.x" is stable per *package*, not per component: its 1.3.0
notes read *"Marks Drawer as stable (breaking change)"* and 1.4.0 *"Introduces preview OTP Field
component"*. Argo owes neither. But check a component's own status before leaning on it.

**Where Argo still leaves the foundation, and it is fine:** `Command` wraps `cmdk`, `Resizable` wraps
`react-resizable-panels`, `Message Scroller` and `Questionnaire` wrap `@shadcn/react`, and
`Message`, `Marker`, `Bubble`, `Attachment`, `Input`, `Textarea` and `Native Select` wrap nothing.
None of those is a second *foundation*; each is a focused library or plain markup, which #1731
already permits.

**And Radix is not dying, so this is not a rescue.** Its last release is **2026-07-20**, with
`1.7.0-rc` prereleases on 2026-07-28/30/31 and repo `pushed_at` **2026-08-08**; the repository is
neither archived nor disabled. The widely repeated "Radix is in maintenance mode" claim has **no
first-party support**, and the top search hits for it concern Radix DLT, an unrelated blockchain
company. The one-base rule is chosen for consistency, not for fear of Radix.

## What a mixed foundation costs

### Bundle size — real, and not what decides it

Whole-package figures, minified and gzipped, from bundlephobia (**third-party**; none of the three
projects publishes a bundle-size table of its own — verified against Base UI's `handbook/styling.md`
and `llms.txt`, Adobe's `frameworks.md`, and Radix's overview pages):

| Package | Version | min | min+gzip | deps |
|---|---|---|---|---|
| [`@base-ui/react`](https://bundlephobia.com/package/@base-ui/react@1.8.0) | 1.8.0 | 456,208 B | **146,917 B** | 5 |
| [`radix-ui`](https://bundlephobia.com/package/radix-ui@1.6.7) | 1.6.7 | 249,484 B | **71,742 B** | 55 |
| [`react-aria-components`](https://bundlephobia.com/package/react-aria-components@1.21.1) | 1.21.1 | 975,320 B | **274,114 B** | 7 |
| `@shadcn/react` | 0.3.1 | — | — (bundlephobia **422**) | 0 |

Read those with three caveats. They are whole-package and pre-tree-shaking, so an app importing four
components ships far less. Radix is the only one where genuine per-component figures exist, because it
ships ~55 packages: `@radix-ui/react-dialog@1.1.23` is **12,585 B** gzipped and
`@radix-ui/react-select@2.3.7` is **29,377 B**. And React Aria's 274 kB includes localised strings for
30-plus languages, which Adobe ships a bundler plugin to strip
([`frameworks.md`](https://react-aria.adobe.com/frameworks.md): *"By default, React Aria includes
localized strings for 30+ languages. To optimize the JavaScript bundle to include only your supported
languages, install our bundler plugin."*) — the post-plugin figure is **unverified** by anyone.

Two foundations also carry two helper runtimes and then some: Base UI ships `@babel/runtime`,
React Aria ships `@swc/helpers`, Radix bundles `tslib` (~22 kB min inside `radix-ui`). Ship all three
and you ship all three.

**This is the weakest of the three costs.** Electron ships its renderer bundle on disk beside the app;
there is no download for a user to wait on. A hundred kilobytes gzipped decides nothing here.

### Behaviour consistency — **this is what forces the decision**

The three are not skins over one API. Verified at source, for one component:

- `base/dialog` — `import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"`
- `radix/dialog` — `import { Dialog as DialogPrimitive } from "radix-ui"`
- `aria/dialog` — `import { Dialog, DialogTrigger, Heading, ModalOverlay, Modal } from "react-aria-components"`

React Aria's Dialog is a *different composition*: an overlay and a modal are separate parts, and the
title is a `Heading`. Base UI's composition escape hatch is a `render` prop; Radix's is `asChild`. A
mixed app therefore holds two or three prop vocabularies, two dismissal models and two portal
behaviours for one concept — and a developer reading a Feed row cannot tell from the call site which
set of rules applies.

**And the conflict is mechanical, not only stylistic.** Radix is the most invasive of the three, and
its source says so. `@radix-ui/react-focus-guards` inserts sentinel spans straight into the document
and coordinates every instance through module scope:

```
let count = 0;
let guards: { start: HTMLSpanElement; end: HTMLSpanElement } | null = null;
document.body.insertAdjacentElement('afterbegin', start);
document.body.insertAdjacentElement('beforeend', end);
```

On top of that, `@radix-ui/react-dialog` pulls `aria-hidden` (which walks and mutates `aria-hidden`
across sibling subtrees) and `react-remove-scroll` (document-level scroll locking), each with its own
refcount. React Aria, for its part, documents its focus-visible modality as **page-global** —
`useFocusVisible` returns *"Whether keyboard focus is visible globally"*. Two independent focus traps
with no shared notion of a topmost layer will fight when a modal from one library opens over a modal
from the other. Base UI is the only one that also asks for **global CSS** — `isolation: isolate` on
the layout root — which changes the stacking context the other library's portalled content lands in.

The toolchain then makes that cost **unavoidable rather than manageable**. `shadcn add` has no base
flag and `components.json` records no foundation, so a mixed project has nowhere to state its own rule
and nothing to check it. Worse, the primitive package sits on the base's *style* item, so a component
fetched by URL from another base arrives importing a package `init` never installed. Every later
`shadcn add`, every registry update and the official migration skill assume one base. A mixed
foundation is not a supported configuration; it is a fork maintained by hand.

That is the decisive cost. Bundle size does not force the decision, and neither does ARIA.

### Keyboard and ARIA semantics — the smallest gap, and two surprises

All three claim the same specification, and they are unequally good at proving it.

- **Base UI** — *"Base UI components adhere to the [WAI-ARIA Authoring Practices] to provide basic
  keyboard accessibility out of the box"*; *"Many components provide support for arrow keys,
  alphanumeric keys, Home, End, Enter, and Esc"*; components *"manage focus automatically following a
  user interaction"*, with `initialFocus` / `finalFocus` props, and Popover grades trapping as
  `modal='trap-focus'`. Its homepage adds a **WCAG 2.2** claim. Tested *"on a wide range of platforms,
  devices, browsers, screen readers"* — **no screen reader is named**, and no ARIA version. It states
  plainly that *"it's the developer's responsibility to visually indicate focus."*
  ([accessibility](https://base-ui.com/react/overview/accessibility))
- **Radix** — *"Components adhere to the WAI-ARIA design patterns **where possible**"*, and it is the
  only one of the three that ships a **per-component keyboard table** (Select documents `Space`,
  `Enter`, `ArrowDown`, `ArrowUp`, `Esc` behaviour row by row). But **no screen reader is named, no
  ARIA version is named, and it makes no screen-reader testing claim at all.** Best keyboard
  documentation, worst assistive-technology evidence.
  ([accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility))
- **React Aria** — *"following the WAI-ARIA and ARIA Authoring Practices guidelines"*, and the only one
  that **names its test matrix**: VoiceOver on macOS (Safari, Chrome), JAWS on Windows (Firefox,
  Chrome), NVDA on Windows (Firefox, Chrome), VoiceOver on iOS, TalkBack on Android (Chrome). Plus
  *"localized strings for 30+ languages"* across 37 locales, and a candid *"Automated accessibility
  testing tools sometimes catch false positives in React Aria."* Yet its **per-component keyboard
  documentation is the thinnest of the three** — `ListBox`, `Select` and `Modal` carry no keyboard
  tables at all. ([quality](https://react-aria.adobe.com/quality))

So **React Aria has the strongest accessibility claim and Radix has the clearest keyboard
documentation, and Base UI wins neither.** That is the one honest argument against taking the default,
and it is worth stating rather than hiding. React Aria loses anyway: it is the narrowest shadcn
registry (57 items, no `menubar`), it sits outside the maintainers' parity contract, it costs 274 kB
gzipped against 147 kB, and its named matrix buys reach — JAWS, NVDA, TalkBack — that a macOS-first
Electron cockpit does not ship to yet.

A **mix** is worse than any of the three alone on this axis, for the mechanical reasons above. And no
first-party source says whether a mix works: **none of Base UI, Radix or Adobe documents coexistence
with another headless library, in either direction.** The closest any vendor comes is Adobe's
`UNSAFE_PortalProvider`, which is *"particularly useful when your application already uses custom
portalling for other elements"* — and the `UNSAFE_` prefix is Adobe's own warning. That silence is a
finding, not permission.

**One hypothesis the brief raised, and it is false.** The three do **not** collide on
`@floating-ui/react-dom`. Base UI declares `^2.1.9`, Radix's `react-popper` declares `^2.0.0`; `^2.1.9`
satisfies `^2.0.0`, so any modern resolver installs **one** copy. React Aria depends on Floating UI
not at all and shares **no** transitive dependency with either other library. So a mix costs additive
bytes and behavioural risk, not a duplicate-resolution problem.

## Per-component: the foundation each one uses

From #1742's 28 clean and 9 partial rows. "Base UI" means the `base` variant of the shadcn component,
which is what `init -b base` installs.

| Argo surface | shadcn component | Foundation under this recommendation |
|---|---|---|
| Buttons, icon buttons, button groups | Button, Button Group | Base UI (`useRender`, `mergeProps`) |
| `Menu`, `ProjectMenu`, `StartSkillMenu`, `BacklogRowMenu` | Dropdown Menu | Base UI — maps to [Base UI **Menu**](https://base-ui.com/react/components/menu) |
| `.contextMenu` sites | Context Menu | Base UI |
| `Picker`, `ConnectScopePicker`, `ModePicker` | Select | Base UI (typeahead documented) |
| `RoomSegments`, `Picker(.segmented)` | Toggle Group | Base UI |
| `Toggle` (switch, button) | Switch, Toggle | Base UI |
| `.sheet`, `FeedLightbox` | Dialog | Base UI (`initialFocus` / `finalFocus`; Esc requests close) |
| `.confirmationDialog`, `.alert` | Alert Dialog | Base UI |
| `.popover` sites | Popover | Base UI (`modal='trap-focus'` where trapping is wanted) |
| `.help` (57 sites) | Tooltip | Base UI |
| `ArgoDisclosure`, `BacklogTwist`, `RawOutputDisclosure` | Collapsible / Accordion | Base UI |
| `DeckTabs` | Tabs | Base UI (`activateOnFocus` default **false**, `loopFocus` default **true**) |
| `ScrollView` | Scroll Area | Base UI |
| `Form` + `Section` | Field, Card | Base UI |
| `SearchFieldLine` + picker | Combobox | Base UI (`@base-ui/react` declared on the item) |
| `TextField` | Input | **none** — plain `<input>` |
| `ComposerTextInput` | Textarea (ruled out) | **none** — plain `<textarea>`; see #1754 |
| `ComposerMenu` family | Command | **`cmdk`** — not a foundation. Item declares `cmdk` |
| `NavigationSplitView` rail | Sidebar | Base UI — `mergeProps` + `useRender` only. **No exception** |
| `NavigationSplitView` widths | Resizable | **`react-resizable-panels`** — not a foundation |
| `ProgressView` | Spinner | **none** |
| `Divider`, `ArgoBadge`, `ArgoKeyPress`, `Label`, `ContentUnavailableView` | Separator, Badge, Kbd, Item, Empty | **none** — markup |
| the Session Feed | Message Scroller | **`@shadcn/react` 0.3.1** — foundation-independent |
| Feed prompt rows | Message, Bubble | **none** — markup |
| Feed system / in-progress rows | Marker (+ Spinner) | **none** — markup |
| `FeedAskAnswerRow` and agent questions | Questionnaire, Input Group, Kbd | **`@shadcn/react`** + native form elements |
| `AttachmentDropTarget` | Attachment (chips only) | **none**, and it is not a drop target |
| RTL, if ever | Direction | Base UI `DirectionProvider`; `init` also carries `--rtl` |
| `WrapFlow` | — | dissolves into `flex-wrap` |
| menu bar, windows, panels, clipboard | — | Electron main process, not a component |

**Where the recommendation is not possible: nowhere.** Every Argo surface either takes the Base UI
variant or takes no foundation at all. The one real per-base gap in the whole registry —
`aria/menubar` 404 — is on a component Argo does not owe, because its menu bar is Electron's `Menu`.

## What the three blocked tickets can now assume

### #1752 — the Feed's list primitive, and ADR-0030 in the DOM

**Unblocked, and narrowed.** `Message Scroller` is real, is installable, and is the right anchoring
primitive — but its behaviour comes from `@shadcn/react`, so **the foundation choice does not touch
the Feed**. #1752 can proceed against Base UI without waiting on anything here.

Does `Message Scroller` change #1752's answer? **It answers half of it and leaves the hard half.** It
supplies open-at-tail, follow-only-at-the-live-edge, prepend-safe history and a fixed-row anchor as
props — ADR-0029 and ADR-0030 rules 4 and 5, already built. It supplies **no measurement, no
virtualisation and nothing off the main thread**, so ADR-0030's core — *every row has a final height
at the current width before the first draw* — remains entirely Argo's to build. #1748's approved model
("one kept, settled DOM document for each Session") is compatible with that: a settled document needs
no virtualiser at all.

If one is ever needed, TanStack Virtual fits ADR-0030's shape rather than fighting it:
[`estimateSize`](https://tanstack.com/virtual/latest/docs/api/virtualizer) is documented as returning
*"the actual size (or estimated size if you will be dynamically measuring items)"* — so pre-measured
heights can be fed in and `measureElement` simply never called, which is the opposite of estimation.
`initialMeasurementsCache` seeds a captured height set, `anchorTo: 'end'` pins to the tail, and
`getItemKey` takes a stable row id. That is a note for #1752, not a decision made for it.

Also for #1752: `Message Scroller` documents **no event callbacks**. Scroll state is readable only via
`useMessageScrollerVisibility()` (`currentAnchorId`, `visibleMessageIds`) and
`useMessageScrollerScrollable()`, from inside the Provider. The Minimap sharing one settled revision
(ADR-0030 rule 7, and #1748's open acceptance item) has to be built on those hooks.

### #1754 — the Composer's text surface

**Unblocked, and one open question closed.** `Attachment` **does not** change the drop target. It has
no drag, drop, file-input, paste or preview logic; `/docs/react/attachment` 404s; and shadcn ships no
`file-upload` or `dropzone` component (both 404). So `AttachmentDropTarget` stays a hand-written DOM
surface — `dragover`/`drop`, an `<input type="file">`, and clipboard paste — and `Attachment` renders
the resulting chips and their `state` (`idle | uploading | processing | error | done`), with
`AttachmentGroup` for the scrollable strip.

On the text surface itself: `Textarea` is a plain `<textarea>` wrapper in **all three** bases, so the
inked command mark is ruled out under every foundation equally. The foundation choice is irrelevant to
#1754's question, which stays exactly as posed: `contenteditable`, or an editor library, and which.

### #1755 — keyboard, focus and menu semantics

**Unblocked, with two of its five questions materially changed.**

**Deck tabs.** The conflict is smaller than #1742 assumed. [Base UI
Tabs](https://base-ui.com/react/components/tabs) documents `activateOnFocus` — *"Whether to
automatically change the active tab on arrow key focus. Otherwise, tabs will be activated using Enter
or Space key press"* — default **`false`**; and `loopFocus` — *"Whether to loop keyboard focus back to
the first item when the end of the list is reached while using the arrow keys"* — default **`true`**.
So Base UI already separates focus from activation, which is most of what #404 and #378 wanted. What it
still does is move focus across the strip with arrow keys, which Argo's rule forbids. That remains a
decision — but it is a props-and-DOM decision inside one foundation, not a foundation choice.

**The focus ring.** It has a home. Base UI states outright that *"it's the developer's responsibility
to visually indicate focus"* — and shadcn is the developer here, and has already done it:
`bases/base/ui/tabs.tsx` carries `focus-visible:border-ring focus-visible:ring-[3px]`, and the base
style layer carries `outline-ring/50`. So #1755's "the app must state one, once, somewhere" resolves
to *the `--ring` token of the chosen base and style*, and the open part is only whether Argo accepts
shadcn's ring or restyles it — which #1731 defers.

**Unchanged by this note:** native vs DOM menus, the 57 `.help` sites, and who owns the shortcut table.
Nothing in the foundation question bears on them. One small addition: `Direction`
(`DirectionProvider` + `useDirection()`) is a real component, and `shadcn init` carries `--rtl` /
`--no-rtl`, so text direction is a project-level flag rather than something #1755 must invent.

## What still needs a human at a browser

A fetch cannot run the CLI, cannot see a JS-rendered count the way a reader does, and — as this note
found the hard way — can be summarised into text that was never on the page. Ten minutes, in this
order, before the first `shadcn add`:

1. **Run `shadcn init` in a scratch directory** and read the prompts. Confirm the base prompt exists,
   offers `base / radix / aria`, and — the thing no doc states — **see what it writes into
   `components.json`**. The documented schema has no base field, so something records it somewhere.
   This is the single most load-bearing unverified fact in this note.
2. **Open [`/docs/components`](https://ui.shadcn.com/docs/components)** and count the grid by eye.
   Confirm there is no "77" and no count in the header.
3. **Open [`/docs/components/base/sidebar`](https://ui.shadcn.com/docs/components/base/sidebar)** and
   read the source block. Confirm `@base-ui/react`, and no `@radix-ui`. This is the claim that voids
   the ticket's premise; see it yourself.
4. **Open [`/docs/components/base/message-scroller`](https://ui.shadcn.com/docs/components/base/message-scroller)
   and [`/docs/react/message-scroller`](https://ui.shadcn.com/docs/react/message-scroller)** and read
   the props table and the sentence "Virtualization is intentionally left outside the primitive."
5. **Open [`/docs/components/base/attachment`](https://ui.shadcn.com/docs/components/base/attachment)**
   and confirm Composition and Features hold no drag, drop or file input.
6. **Check `@shadcn/react` on npm.** It was **0.3.1** today. A pre-1.0 package now sits under the Feed
   and the Ask rows; look at whether the version has moved and whether a 1.0 is signalled.
7. **Open [`/docs/components/aria/menubar`](https://ui.shadcn.com/docs/components/aria/menubar)** and
   confirm it still 404s — the one real per-base coverage gap in the registry.
8. **Open [`/docs/changelog/2026-07-base-ui-default`](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)**
   and confirm it still reads "Base UI is the default component library in shadcn/ui". #1742 recorded
   this page as missing; it is not.

## Unverified

Stated plainly, because the ticket asked for a docs check and a docs check has limits.

- **Where `-b/--base` is persisted.** `components.json`'s documented fields
  ([`/docs/components-json`](https://ui.shadcn.com/docs/components-json)) are `$schema`, `style`,
  `tailwind`, `rsc`, `tsx`, `aliases`, `registries` — **no base field** — and the CLI's
  `rawConfigSchema` in
  [`packages/shadcn/src/registry/schema.ts`](https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/registry/schema.ts)
  matches (`style: z.string()`, plus `rtl`, `iconLibrary`, `menuColor`, `menuAccent`). I did not run
  the CLI, so **how a project records its base is unverified**. Item 1 of the browser check.
- **Whether `shadcn add <full registry URL>` from a second base works.** The `add` argument is
  documented as "name, url or local path to component", and `/r/styles/<base>-<style>/<name>.json`
  resolves for all three bases — so it looks reachable. That it would then import an uninstalled
  primitive package is **inferred** from the style item's `dependencies` array, not run.
- **Per-component bundle numbers for Base UI and React Aria.** Both ship one package, so bundlephobia
  cannot split them; only Radix's ~55 packages give real per-component figures. All numbers here are
  third-party and pre-tree-shaking. React Aria's post-locale-plugin size is published by nobody.
  `@shadcn/react`'s bundlephobia build returned **422**; only npm's unpacked 56,185 B / 9 files stands.
- **Coexistence.** None of the three projects documents whether it can share an app with another
  headless library. Base UI needs no provider (only `isolation: isolate` for popup stacking);
  React Aria's `I18nProvider`, `RouterProvider` and `Provider` are all optional, and `SSRProvider` is
  explicitly *"not necessary"* on React 18+; Radix needs none either. So there is **no first-party
  statement either way** — nothing here proves a mix works, and nothing proves it breaks. The two
  conflict risks named above (duelling focus containment, duelling `aria-hidden` and scroll lock) are
  **inferred from mechanism**, not documented by any vendor.
- **React Aria's module-level focus state.** `useFocusVisible` is documented as page-global, which is
  verified. Beyond that, `FocusScope.tsx` was unreachable — `raw.githubusercontent.com`, jsDelivr and
  the GitHub blob page all 404 on the `packages/@react-aria/focus/src/` path (the literal `@` defeats
  those CDNs), and GitHub's code-search API returned **401** unauthenticated. The exported
  `isElementInChildOfActiveScope` hints at an active-scope singleton; the implementation is unread.
- **Typeahead in React Aria and Radix.** Both certainly implement it; neither documents it on a page I
  could find. Only Base UI's Select states it in prose.
- **The docs-index link spread**: 64 `base`, 63 `aria`, 65 `radix` hrefs against 63 registry items in
  `r/index.json` and 63 names in `bases/base/ui/_registry.ts`. Observed; not explained. My own count of
  the `aria` registry's names was **57**, which does not reconcile with 63 `aria` hrefs. Both numbers
  are recorded rather than smoothed.
- **`Direction`'s upstream.** Neither the base nor the radix page names the package behind
  `DirectionProvider`; I could not tell whether it re-exports one or is hand-rolled context.
- **Radix's governance and exact publish timestamp.** Dated from its docs releases page (2026-07-20)
  plus decoded `1.7.0-rc` timestamps; `registry.npmjs.org/radix-ui`'s `time` field was too large to
  fetch and `npmjs.com` returned **403**. `api.github.com/repos/radix-ui/primitives/releases` returns
  `[]` — they publish notes on their docs site only. A search result attributing stewardship to WorkOS
  is **third-party and unconfirmed**; do not repeat it as fact.
- **No official Radix → Base UI migration guide exists.** `base-ui.com/react/guides/migrating-from-radix`
  **404s**, and Base UI's own `llms.txt` lists no migration page. Their tracker has it open —
  mui/base-ui#1239 *"Pain points during Radix Primitives migration"* and #2970 *"create codemod to ease
  Radix Primitives migration?"*. shadcn's own AI migration skill (`skills add shadcn/ui`) is the only
  tool named anywhere, and it is shadcn's, not Base UI's. Argo has nothing to migrate, so this costs
  nothing now — but it would if a base were ever switched.
- **Off-main text measurement in a browser.** `OffscreenCanvas` is documented as available in Web
  Workers, but [MDN's page](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) does not
  confirm that `measureText`/`TextMetrics` work there. ADR-0030's off-main measurement therefore has no
  verified route yet. That is #1752's problem; it is flagged, not solved.
- **The fetcher itself.** WebFetch fabricated a "77 components" header and a `shadcn-ui.com` host on
  two pages that returned 200. Any count or URL in this repo traceable to a summarised fetch should be
  re-checked against raw HTTP.

## Amendment owed to #1731

#1731's note says:

> "The current shadcn initializer uses Base UI by default. This internal base is part of the generated
> shadcn implementation, not a second product-level framework choice."

**The second sentence stands; the first half of it is now imprecise.** The base *is* a choice — one of
three, `base | radix | aria` — but it is made **once, at `init`, with `-b`**, and it is not a
product-level framework choice in the sense #1731 was rejecting. So #1731's conclusion is
**strengthened, not overturned**: one system, take the default. The amendment is one sentence, not a
reversal.

#1742's caveat section needs two corrections: the Base UI changelog entry **exists** (fetched, 200),
and **`Sidebar` does not wrap Radix**.

## Primary sources

**In this repository, read directly:**

- `docs/research/2026-09-08-swiftui-controls-to-shadcn.md` (branch `argo/#1742-map-swiftui-controls-shadcn`)
  — the 53-control mapping this note extends.
- `docs/research/2026-09-08-react-component-system.md` (branch `research/select-react-ui-component-system`)
  — the decision this note amends.
- `docs/adr/0029-a-feed-opens-at-its-tail.md`, `docs/adr/0030-geometry-is-settled-before-it-is-shown.md`
  — the Feed's contract, rules 4, 5 and 7 in particular.
- `rules/swift.md` — "Tokens only", and Full Keyboard Access as the contract.
- `apps/desktop/package.json` — React **19.2.1**, Electron 44.2.0, Vite 7.2.6. **No `components.json`,
  no Tailwind, no shadcn component installed anywhere in the tree**; `src/renderer/App.tsx` is a
  placeholder. Nothing has been committed to a foundation yet.
- `docs/designs/prototypes/session-feed-core.prototype.html` (branch `argo/#1748-prototype-session-feed`,
  commit `9d9e7672`) — the approved Feed prototype is **hand-written HTML**, not shadcn. So #1748's
  fixed inputs (`Message Scroller`, `Message`, `Marker`, `Questionnaire`) were never exercised.
- `CONTEXT.md`, `docs/domain/not-domain-entities.md` — Feed, Deck and Minimap are UI surfaces, not
  domain entities.

**Fetched 2026-09-08 — shadcn/ui docs:** [`/llms.txt`](https://ui.shadcn.com/llms.txt) ·
[`/docs/components`](https://ui.shadcn.com/docs/components) · [`/docs/cli`](https://ui.shadcn.com/docs/cli) ·
[`/docs/components-json`](https://ui.shadcn.com/docs/components-json) ·
[`/docs/installation`](https://ui.shadcn.com/docs/installation) ·
[`/docs/changelog`](https://ui.shadcn.com/docs/changelog) ·
[`/docs/changelog/2026-07-base-ui-default`](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default) ·
[`/docs/changelog/2026-07-react-aria`](https://ui.shadcn.com/docs/changelog/2026-07-react-aria) ·
[`/docs/changelog/2026-06-chat-components`](https://ui.shadcn.com/docs/changelog/2026-06-chat-components) ·
the `base`, `aria` and `radix` variants of `dialog`, `tabs`, `sidebar`, `command`, `direction` ·
the eight pages `attachment`, `bubble`, `direction`, `marker`, `message`, `message-scroller`,
`native-select`, `questionnaire` · [`/docs/react/message-scroller`](https://ui.shadcn.com/docs/react/message-scroller) ·
[`/docs/react/questionnaire`](https://ui.shadcn.com/docs/react/questionnaire)

**Fetched 2026-09-08 — shadcn/ui registry endpoints:** `/r/index.json` (200, 63 items) ·
`/r/styles/{base,radix,aria}-nova/{dialog,tabs,index}.json` (200) ·
`/r/styles/new-york/sidebar.json` (200, legacy Radix-era) · `/registry.json` and `/r/registry.json`
(**404**) · `/r/{message-scroller,attachment}.json` (**404**) ·
`/docs/react/{attachment,bubble}` and `/docs/components/base/{file-upload,dropzone}` (**404**) ·
`/docs/components/aria/menubar` (**404**)

**Fetched 2026-09-08 — shadcn/ui source (`github.com/shadcn-ui/ui`, `main`):**
`apps/v4/registry/README.md` · `apps/v4/registry/bases.ts` · `apps/v4/registry/config.ts` ·
`apps/v4/registry/bases/README.md` · `apps/v4/registry/bases/{base,aria,radix}/ui/` listings ·
`bases/{base,aria}/ui/_registry.ts` · `bases/base/ui/{sidebar,message-scroller,attachment}.tsx` ·
`bases/{radix,aria}/ui/dialog.tsx` · `bases/radix/ui/message-scroller.tsx` ·
`packages/shadcn/src/registry/schema.ts`

**Fetched 2026-09-08 — the foundations, first-party:**
[Base UI quick start](https://base-ui.com/react/overview/quick-start) ·
[accessibility](https://base-ui.com/react/overview/accessibility) ·
[about](https://base-ui.com/react/overview/about) · [releases](https://base-ui.com/react/overview/releases.md) ·
[composition](https://base-ui.com/react/handbook/composition.md) ·
[dialog](https://base-ui.com/react/components/dialog.md) · [popover](https://base-ui.com/react/components/popover.md) ·
[select](https://base-ui.com/react/components/select.md) · [tabs](https://base-ui.com/react/components/tabs) ·
[direction-provider](https://base-ui.com/react/utils/direction-provider.md) ·
`mui/base-ui` `InternalBackdrop.tsx` ·
[Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility) ·
[introduction](https://www.radix-ui.com/primitives/docs/overview/introduction) ·
[releases](https://www.radix-ui.com/primitives/docs/overview/releases) ·
[select](https://www.radix-ui.com/primitives/docs/components/select) ·
[portal](https://www.radix-ui.com/primitives/docs/utilities/portal) ·
`radix-ui/primitives` `focus-guards.tsx` · `api.github.com/repos/radix-ui/primitives` ·
[React Aria getting started](https://react-aria.adobe.com/getting-started) ·
[quality](https://react-aria.adobe.com/quality) · [frameworks](https://react-aria.adobe.com/frameworks.md) ·
[FocusScope](https://react-aria.adobe.com/FocusScope) ·
[useFocusVisible](https://react-aria.adobe.com/useFocusVisible.md) ·
[PortalProvider](https://react-aria.adobe.com/PortalProvider.md) ·
[I18nProvider](https://react-aria.adobe.com/I18nProvider.md) ·
[SSRProvider](https://react-aria.adobe.com/SSRProvider.md) ·
npm registry metadata for `@base-ui/react@1.8.0`, `@base-ui-components/react` (deprecated,
*"Package was renamed to @base-ui/react"*), `radix-ui@1.6.7`, `@radix-ui/react-dialog@1.1.23`,
`@radix-ui/react-popper`, `react-aria-components@1.21.1`, `@shadcn/react@0.3.1`, `cmdk@1.1.1` ·
bundlephobia for the first three plus two Radix components ·
[TanStack Virtual virtualizer API](https://tanstack.com/virtual/latest/docs/api/virtualizer) ·
[MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) ·
`github.com/dip/cmdk` (and the 301 from `github.com/pacocoursey/cmdk`)

**Blocked or failed fetches, recorded as findings:** `npmjs.com/package/cmdk` **403** ·
`npmjs.com/package/@shadcn/react` **403** (both worked around via `registry.npmjs.org`) ·
`bundlephobia` for `@shadcn/react` **422** · `api.github.com/search/code` **401** ·
`react-aria.adobe.com/accessibility` **404** (moved to `/quality`) ·
`base-ui.com/react/guides/migrating-from-radix` **404** (no such guide) ·
`@react-aria/focus/src/FocusScope.tsx` **404** on every raw-content CDN.

# Alert and Notice for #3109

Reviewed baseline: `ee523b8ae723950df51eed99a116a7ea679e57d3`.
Fetched 2026-10-02 with the installed `shadcn@4.21.0` CLI and the desktop configuration.
The selected style is `base-nova`, with neutral base color, CSS variables, Phosphor icons,
`rsc: false`, `tsx: true`, no RTL, and no prefix.

The read-only command was `bunx shadcn@4.21.0 add alert --view alert.tsx`.
The payload came from `https://ui.shadcn.com/r/styles/base-nova/alert.json`.
Its SHA-256 is `0799cfc29a481568f6e9b48e96518a446032350dec576bfe31b7f67b4b262028`.
The CLI source SHA-256 is `cfbca450df71b3571701d659c1b7eb9e27d3d92efb7afdf5c292c685f95e3949`.
Only the preview framing was removed before hashing the source.
The formatted candidate SHA-256 is `541b89914bc4a5d8e533a80d19ef952ad8dabe71e6812c2a37315aef9d69c6b8`.

The payload declares `cn` as its only dependency and no registry dependencies.
It declares one `registry:ui` file at `registry/base-nova/ui/alert.tsx`.
The configured UI alias places it at `src/platform/renderer/components/ui/alert.tsx`.
The CLI preserves the selected `cn` import. Repository formatting sorts imports and exports,
uses single quotes and trailing commas, and changes the React import to type-only.
Alert needs no icon, RSC, or same-folder import transform. No support file is written.
These identities and transforms are also recorded in `tests/styling/registry-baseline.json`.

The candidate review found two local additions: `min-w-0` on AlertTitle and AlertDescription.
Restore those slots to the selected native source. Keep shrinking and wrapping in Notice's
explicit app slot recipes. Preserve native Alert variants, typography, attributes, and alert semantics.

## App ownership

Notice uses the public Alert, AlertTitle, and AlertDescription slots. Its finite tone API
accepts neutral, success, warning, or danger. The shared `noticeToneRecipe` lives beside
existing status and indicator recipes. Neutral, success, and danger use the opaque card
surface. Warning uses the existing opaque warning surface and foreground pair.
No color role, raw palette value, shadow, or theme-dependent geometry is added.

Notice preserves Alert attributes, the root ref, and its default alert role. The caller can
retain an existing role, as SignInNotice does with its named region. Its title
and icon explicitly use the root tone. The description uses normal semantic foreground,
and links use primary foreground with the native underline and focus treatment. Dense
explanatory text does not inherit an error tone. Shrinking and wrapping belong to these slots.
ContractFailureAlert centralizes localized error content through Notice's danger recipe.
SignInPanel and SourceSettings reuse that composition instead of copying its root treatment.

SignInNotice keeps its actions, wrapping, margins, and width constraints at the caller.
SignInPanel keeps sign-in state, callbacks, provider actions, and focus rescue. Its named
`DEVICE_CODE_RECIPE` defines mono font, title-size metrics, medium emphasis, and wide tracking
as one recipe. It adds no shared typography role. SourceConnectionItem keeps its compact
media, title, and description recipes local. Registry Item source and default measurements
remain unchanged.

Separate raw Alert stories show the native default, destructive variant, and action slot.
Notice stories show every tone, long content, recovery, disabled action, attributes, and ref
forwarding. Contract failure stories include localized long error content. Sign-in stories
cover device code, browser consent, retry, requesting, connection, and local notice actions.
SourceSettings stories cover read failure, failed disconnect, recovery, and disabled disconnect.
All stories inherit the required axe check and the existing Theme and Mode controls.
No story forces a mode or duplicates an appearance. Plays assert visible behavior and semantics.
The device-code play checks the copy/open callback. It does not run the main-process provider
flow or verify the operating system clipboard.

## Baseline limits

The complete recorded registry check finds one existing Input mismatch. The recorded hash is
`10612b2f3e8b9072a8339dacd0ee737bf81fd99c033da04210e103eaec367ca6`.
The baseline Input source hash is
`32509ed42a794f6d81c7ca8170f3a2a0b10a237b1dcc14a47e51c4ee711f8423`.
Input has no diff against the supplied baseline and was last touched at `68562cb11`.
Alert matches the formatted reviewed candidate byte-for-byte. The other seven recorded
registry items pass their existing hashes. #3109 changes only the Alert identity entry.

At a 237px Storybook canvas height, the existing Tickets sidebar's empty scrolling body
fails `scrollable-region-focusable`. Temporarily restoring the exact baseline Alert and
SignInNotice reproduces that failure. The current implementation passes at an 800px desktop
canvas height. No rule was disabled and no unrelated sidebar source was changed.

The supplementary direct-consumer check passes Session List failure and Question failed,
unsupported, and locked states. The two existing Session Feed failure fixtures stop during
render because `onStalledChange` is an implicit Storybook action. They do not complete a play.
Those fixture files have no diff in #3109 and remain outside this implementation scope.

## Initial reviewed checkpoint

All 48 scoped stories reached the played phase with no play, render, or unhandled error
and passed the inherited axe check at a 980 by 800px canvas in Default Dark mode.
A fresh independent reviewer repeated all 48 and found no actionable source or interface
findings. The reviewer also checked representative Default Light and Dark states at
980 and 360px canvas widths, including long errors, local actions, and recovery focus.

Raw Alert retains its native 14px text, 20px line height, medium title, and muted description.
Notice inherits those metrics. At this checkpoint its title, description, and icon used
the current tone; the blind-review correction below supersedes description paint.
Measured Notice contrast was at least 6.07:1 in Light and 6.62:1 in Dark; its surfaces were
opaque. The device code measured 18px mono text, 24px line height, medium weight, and
1.8px tracking. Compact source titles measured 14/20px and descriptions 12/16px.
Neither narrow error content nor device codes caused horizontal canvas overflow.

Biome passed for all 14 changed code and registry files. The node, web, e2e, tools, and
styling TypeScript checks passed. The complete diff check passed. Alert's source still
matches the formatted CLI candidate, and an in-memory class change fails its identity.
The inherited Input identity mismatch prevents a whole-registry pass.

Exact files, story URLs, results, and limits are recorded in
`/private/tmp/argo-3109-report.json`. The independent review is recorded in
`/private/tmp/argo-3109-independent-review.json`. Browser captures were inspected and
deleted. No packaged Electron, provider main-process, or operating system clipboard
check was made. No exhaustive theme or browser matrix was run. The changes remain
uncommitted and unpushed for the coordinator.

## Focused Light action proof

On 2026-10-02, the existing Storybook Color mode toolbar was changed from Dark to Light.
The Color theme remained Default. The manager viewport was 1280 by 1140px and the
rendered canvas was 980 by 800px. No story or source global was changed.

[Raw Alert Action](http://localhost:6007/?path=/story/design-system-primitives-alert--action&globals=theme:light)
passed its play: Tab focused Retry, Enter activated it, and its callback ran once.
[Notice Recovery Action](http://localhost:6007/?path=/story/design-system-patterns-notice--recovery-action&globals=theme:light)
passed its play: Retry connection showed Connection restored and removed the retry button.
[Notice Disabled Action](http://localhost:6007/?path=/story/design-system-patterns-notice--disabled-action&globals=theme:light)
passed its play: Retry connection was disabled and a click did not call its callback.

All three reached the played phase with zero render, play, or unhandled error events.
All three inherited axe scans passed with zero violations. The harness confirmed Light
from the rendered document after each story. Exact events and results are saved in
`/private/tmp/argo-3109-light-actions-results.json` and included in the existing report.
This closes the focused Light action proof gap. The inherited limits above still apply.

## Blind-review correction

The single blind review found that Long Error painted its title, dense explanation, and
recovery link in the same destructive color. Notice now uses `text-foreground` for the
shared AlertDescription slot and `text-primary` for its links. The native link underline,
hover foreground, and focus treatment remain. Title, icon, border, and tone surfaces remain
unchanged. This applies to every Notice consumer through the public Alert slots.
An initial muted foreground candidate failed contrast on the Light warning surface;
normal foreground passes all Notice tones in both inspected Modes.

Long Error's play now tabs to the recovery link and asserts keyboard focus. No color or
measurement assertion was added to the play. The existing Mode toolbar selected Light
and Dark, with Default Theme and a 980 by 800px canvas. All seven Notice stories reached
the played phase in each Mode with no render, play, or unhandled errors; all 14 inherited
axe scans passed with zero violations. This includes the focused
[Light Long Error](http://localhost:6007/?path=/story/design-system-patterns-notice--long-error&globals=theme:light)
and [Dark Long Error](http://localhost:6007/?path=/story/design-system-patterns-notice--long-error&globals=theme:dark).

Exact results are in `/private/tmp/argo-3109-description-light-results.json` and
`/private/tmp/argo-3109-description-dark-results.json`. Rendered slot measurements are in
the matching `argo-3109-description-light-metrics.json` and
`argo-3109-description-dark-metrics.json` files. Both final captures were inspected and
deleted. Biome and the complete diff check passed after the correction. No further
independent or blind-review round was started. The changes remain uncommitted.

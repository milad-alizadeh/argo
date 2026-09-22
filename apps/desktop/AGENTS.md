# Desktop Rules

What no linter checks about `apps/desktop`. The surfaces themselves are
[ADR-0038](../../docs/adr/0038-the-desktop-cockpit-is-opaque.md), and the caps are `biome.jsonc`.

## Tokens (#1912)

`docs/design-stack.md` names the token contract, and these are the rules for writing to it.

- Production visual constants use shared tokens or intentional named component-local tokens beside their owner.
- Exploration can use easy-to-find local values when the existing roles cannot express a direction.
  Resolve them into production tokens before review.
- A token is named for its role, not its value, with one small role set per family. `--text-body`
  survives a change of size; `--text-13` does not.
- Every string the reader sees takes a typography role.
- A screen is a thin container: it resolves state and hands a pure render surface the result.

## Accessible names (#1784)

The Swift app said this with 57 `.help` sites. A web tooltip is silent to a screen reader, so
naming is now a separate act from showing a tooltip. One rule covers the three shapes:

- **An icon-only control** carries `aria-label` with the name a sighted reader would say out
  loud. A tooltip on it is optional and repeats that same string.
- **A mark that is not a control** puts its fact in text, visible or visually hidden. It never
  puts the fact only in a tooltip, and it never takes a `tabIndex` to make a tooltip reachable:
  that invents a focus stop the Swift app never had.
- **A labelled control whose help adds a fact** keeps its label and points `aria-describedby` at
  the fact.

Anything else takes the mark rule: the fact goes in text.

## Focus (#1785)

Chromium's `:focus-visible` arms on a key press and not on a pointer press, which is the rule
`ArgoFocusVisibility` wrote by hand in Swift. The browser is now the source of that reading.

The ring is drawn from `--ring` in both appearances. A shadcn component draws its own
`focus-visible` ring, and that ring is the app's ring because the token is the same. Everything
that shadcn does not draw takes the one root rule in `globals.css`.

Write `outline: none` only in a rule that draws a replacement ring in the same declaration
block. A control that removes the outline and draws nothing is a keyboard cursor that vanished,
and nothing reports it.

## Test runners (#2372)

`bun test` runs the suite. Bun 1.3.14 ships no `node:sqlite`, so anything that reaches the Session
index runs on Node instead, under the `node` Vitest project. `*.vitest.ts` is that role's one
suffix, and Bun's own matcher never claims it. `bun run test` runs both, in that order.

Reach for `*.vitest.ts` only for a test that needs a runtime Bun does not have. Everything else
stays `*.test.ts` beside the rest of the suite.

## Rendered UI tests

For rendered UI work, use a Storybook `play` function as the TDD seam. The function operates the
story through visible controls and asserts the resulting screen behavior.
Assert reader-visible behavior and accessible semantics. Do not assert CSS classes or computed styles.

Every story also runs an axe accessibility scan (#2623), required, no separate opt-in. A story
that exists only to be looked at, not tested, takes the `view-only` tag rather than an empty
`play`. Fix a real finding: reach for a shared token first, since most findings are a shared token
failing contrast against a ground the token's own definition never listed. Disable an axe rule
only for markup you did not author (an example already lives in `.storybook/preview.ts`), and name
the vendored element in the same line; disabling a rule for first-party code hides the finding
instead of fixing it.

## Shortcuts (#1786)

One table: `src/platform/contract/commands.ts`. Every chord in the app is an entry there, and every
entry says where it fires.

| Scope | Where it fires |
| --- | --- |
| `menu` | An accelerator on the application menu, built in the main process. |
| `window` | A key handler on the window, live whatever holds focus. |
| `element` | A key handler on one element, live only while that element holds focus. |

Enter and Escape inside a dialog are DOM semantics, not chords, so they are not entries.

## Appearance

The app offers System, Light and Dark, and System is the default (#1820). The main process owns
the choice: it holds `nativeTheme.themeSource`, so the native window frame changes with it, and
it writes the choice to `userData`.

Read a color through a token in both appearances. A value that is right in the dark appearance
and wrong in the light one is the failure this rule exists to catch, and no gate looks for it.

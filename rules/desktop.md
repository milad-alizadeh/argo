---
paths:
  - "apps/desktop/**"
---

# Desktop Rules

What no linter checks about `apps/desktop`. The surfaces themselves are
[ADR-0038](../docs/adr/0038-the-desktop-cockpit-is-opaque.md), and the caps are `biome.jsonc`.

## Tokens (#1912)

`docs/design-stack.md` names the token contract, and these are the rules for writing to it. They
lived in a `rules/design.md` naming a different file as the contract until #1912.

- A visual constant is reached by name. The contract is the only place a raw value lives, and a
  measurement at a call site is what `scripts/check-design-tokens.sh` reports.
- A value the contract does not hold yet is added there first, and then read by name. Promoting a
  component to shared comes after that, never with the value still inline.
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

## Shortcuts (#1786)

One table: `src/shortcuts.ts`. Every chord in the app is an entry there, and every entry says
where it fires.

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

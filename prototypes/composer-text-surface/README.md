# Composer text surface — prototype

Throwaway. Answers one question, [#1754](https://github.com/milad-alizadeh/argo/issues/1754):
**what draws the Electron composer's text?**

Four surfaces, one route, switched by `?variant=`:

| Key | Surface | Runtime dependency |
| --- | --- | --- |
| A | `<textarea>` with a mirrored ink layer behind it | none |
| B | `contenteditable`, rebuilt and re-inked by hand | none |
| C | Lexical, plain-text mode | `lexical` + `@lexical/react`, ~30 kB gz |
| D | CodeMirror 6 | `@codemirror/{state,view,commands}`, ~120 kB gz |

```bash
bun install
bun run dev      # http://localhost:5273/?variant=A
bun drive.mjs    # drives the same script through all four in Chrome, writes shots/
```

The switcher pill is at the top, not the bottom: the thing being judged is at the bottom.

## What each variant has to carry

Everything above the surface is shared, so the variants are compared on the same work: the
menu model, the catalogs, the key intents and the host state are one implementation
(`src/shared/`), ported from `ComposerMenu.swift`, `ComposerKeyIntent.swift` and
`ComposerTextView.swift`. Each variant owns only the four things the ticket asks about:

1. The inked `/command` mark (`commandMark`, #1256 — index 0 only, past the first space).
2. Return sends, Shift-Return breaks the line, ⌘/⌃-Return passes.
3. The `/`, `@` and `+` menus, opened at a token boundary against the caret, walked with the
   arrows, taken with ⏎ or ⇥, dismissed with esc — the caret never leaving the composer.
4. Where the caret is on screen, so the menu can stand against it.

The geometry is the real one: 13pt body at 1.5, six lines then the field scrolls inside itself,
27pt menu rows, a ten-row list ceiling — `ArgoComposerVessel.swift`.

## What the harness measured

`bun drive.mjs` runs one script through all four against the installed Chrome. All four now pass
every step: the mark inks, the two menus open and filter, `milad@example.com` opens nothing, ⇥
and ⏎ pick, esc dismisses and leaves the line sendable, ⇧⏎ grows the field to six lines and then
scrolls, ⏎ sends and clears.

What the run turned up that reading the docs would not have:

- **All three DOM variants (A, B, C) share one hazard**: reporting the caret rect from a layout
  effect that runs on every render is an infinite render loop unless the host compares the rect
  before setting state. Every one of them hit it, and the page failed to mount at all.
- **Lexical's ink lands short.** Typing at the end of a styled `TextNode` puts the new characters
  in a *fresh unstyled sibling*, so a transform that only splits leaves `/i` inked out of `/imp`.
  The head node has to be topped back up from the sibling on every keystroke.
- **The hand-rebuilt DOM (B) disagrees with the browser about a delete at a boundary**:
  backspacing the draft empty leaves `"\n"` where the other three leave `""`.
- **CodeMirror's undo crosses the send boundary**: `setValue('')` is an ordinary transaction, so
  ⌘Z after a send brings the sent line back. One annotation fixes it; it is not free.
- **A harness caveat worth keeping**: a synthetic ⌘A or ⌘Z over CDP never reaches the browser's
  own command layer, so it only appears to work in C and D — because those two implement
  select-all and undo in JavaScript. Nothing here proves or disproves A's and B's undo.

`shots/` holds five screenshots per variant and `shots/report.json` the measured run.

## Reading the variants

`src/shared/surface.ts` is the whole contract. Each variant reports, in the readout beside the
composer, what it gets free, what had to be hand-written, and what it costs. Read those three
lists side by side — that is the decision.

Not built: Tiptap/ProseMirror. It sits in Lexical's class (a document model, a decoration API,
a mention plugin) at roughly twice the weight, so C stands for both.

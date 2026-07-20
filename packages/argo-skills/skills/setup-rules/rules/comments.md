# Comment Discipline

Comments are a liability: they drift from the code and nobody re-verifies them
on every edit the way tests and types get re-verified. Default to NO comment.
Good code and good names are the documentation. Binds `//`, `/* */`, and `#`
alike, in every language in the repo.

## The one sanctioned comment: WHY the code cannot say

A comment earns its place only when it encodes a WHY that cannot be recovered by
reading the code itself:

- a constraint or invariant the code must honor (a version ceiling, an ordering
  requirement, a fail-closed contract)
- a workaround, paired with the reason it exists (the bug/limitation it routes around)
- a choice that looks wrong on first read but is deliberate

If the WHY becomes inferable from the code (a rename, a type, an assertion makes
it obvious) — delete the comment. It's now drift risk, not documentation.

## Forbidden in code

- **WHAT-restatement:** a comment repeating what the next line already says in
  English. Delete the comment and the code reads as clearly? It never earned its place.
- **Tombstone / changelog comments:** `// removed X because Y`, `// old: … new: …`,
  dated notes, commented-out code kept "just in case." Git history is the changelog.
- **Multi-paragraph rationale:** a comment block past a couple of lines is a design
  doc that leaked into the source. Move it to the commit message or an ADR.

## The one exception: the interface surface

Docs, `SKILL.md` files, rule files, and public API documentation are different —
there, naming a verb, path, gate, or config key IS the contract the reader depends
on. Referential naming is expected there, forbidden inside code.

Three positions in UI code are that same surface, because Storybook renders them
verbatim to a reader who never opens the file: the declaration of an exported
component, each prop in its props type, and each exported story. A comment there
is REQUIRED, not merely permitted.

- **Write it as `/** */`, never `//`.** react-docgen and Storybook's CSF enrichment
  read docblocks only, so a `//` in one of those positions is silently dropped and
  ships as documentation nobody will ever see. That makes it a defect, not a style
  slip. `ui-components.md` states what each of the three has to say.
- **Nothing else moves.** Inside a function body — a story's `render` or `play`
  included — WHAT-restatement, tombstones, and multi-paragraph rationale stay
  forbidden.

## Self-check — in-body comments

1. Does this comment say WHAT the next line does, in different words? Delete it.
2. Is it now inferable from the code around it? Delete it.
3. Is it more than a couple of lines? Move it to the commit message.

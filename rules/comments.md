# Comment Discipline

**An ordinary comment is one line**, and most declarations spend nothing. That is the budget,
and it binds `//`, `///`, `/* */` and `#` alike.

It does **not** bind a docblock something renders or a linter requires. Nothing here is
published and no linter requires one, so in this repo that exemption is empty — but it is
what the last two sections are for, and it is why `///` gets no extra room.

Comments drift. Nothing re-verifies them the way tests and types get re-verified, and one
line is short enough to actually re-read on every edit.

## The test: could a future edit make this sentence wrong?

One question decides whether a comment stays, and it is **not** length.

**A fact can be falsified.** A measured number, a framework behaviour, an ordering
requirement, an external format's semantics, a defence of code that looks wrong. Someone
changes the code, the sentence becomes false, and something breaks. Keep it, and give it
whatever room it needs to be usable — eight lines of AppKit behaviour is right when all
eight lines are the behaviour.

**An argument cannot be falsified.** "X rather than Y, because Y would have…" stays true
forever no matter what the code does, because it is about a decision and not about the
code. One line if the decision still constrains the next edit, otherwise the commit
message or an ADR.

Length is the symptom people reach for and it is the wrong instrument: the longest
comments here are also the most load-bearing, so any line ceiling takes those first.

If the fact becomes inferable — a rename, a type, an assertion makes it obvious — delete
the comment. It is drift risk now, not documentation.

## Not a comment

- **A rejected alternative.** The largest single category of bloat here. A reader who
  deletes it still edits the file correctly; they lose the argument, and the argument
  belongs in the commit message.
- **WHAT-restatement.** A comment repeating in English what the next line already says.
  Delete it and the code reads as clearly? It never earned its place.
- **Tombstones and changelog.** `// removed X because Y`, `// old: … new: …`, dated
  notes, commented-out code kept "just in case." Git history is the changelog.
- **Provenance narration.** A bare `#412` or `ADR-0017` on the constraint line is a
  reference and is fine. The story of how it got there is not.

## `///` is not a bigger budget

A doc-comment marker earns more room in exactly one case: **something renders it to a
reader who never opens the file.** That reader is the whole justification, so find them
before writing the block.

They exist in two shapes, and the second is the one people miss:

- **A command here builds a page** — a `.docc` catalog, `typedoc`, `sphinx`, `jazzy`.
- **Publishing does it with no command in the repo at all** — `pkg.go.dev` renders every
  exported Go comment off a tag, `docs.rs` renders on publish, an npm package's types
  reach people who never clone. In those ecosystems the docblock is published by default
  and this section does not restrain it.

Two things that are *not* that reader: `public`, which is a module boundary and not an
audience, and an IDE hover popup, which is read by someone who already has the file open.

**Nothing in this repo is published.** No DocC catalog, and no `docc`, `jazzy`,
`sourcedocs` or `typedoc` step in `package.json`, `turbo.json`, `scripts/` or `.github/`.
`ArgoEngine` and `ArgoUI` use `public` to cross a boundary `scripts/swift-boundaries.sh`
enforces, and nothing ships those symbols outside this repo. So every `///` here is read
by someone with the file open, which makes it an ordinary comment on the one-line budget.

The day a docs build lands, this paragraph changes and the budget lifts for exactly the
declarations that build renders — and the comment must then use the form that generator
reads, because a generator that silently drops a line comment turns the omission into a
defect rather than a style slip.

## Self-check before you finish

**First: is this a docblock that something renders, that a linter requires, or that the
language executes?** Then stop — none of the questions below apply to it. In this repo
nothing meets that description, so the answer is normally no.

For every other comment:

1. Could a future edit make it false? Keep it, at the length it needs.
2. Would it stay true no matter what the code does? Cut it, whatever its length.
3. Does it say WHAT the next line says, in different words? Cut it.
4. Is it now inferable from a rename, a type or an assertion? Cut it.
5. Does it run past one line, on a declaration nothing renders? Bring it back to one.

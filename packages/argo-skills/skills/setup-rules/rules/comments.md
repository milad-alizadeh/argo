---
paths:
  - "{{SOURCE_GLOBS}}"
---

# Comment Discipline

**An ordinary comment is one line**, and most declarations spend nothing. That is the budget,
and it binds every comment syntax equally, whatever each language's happens to be.

It does **not** bind a docblock something renders or a linter requires. Those are governed by
the last two sections, and they are exempt from everything above them.

Comments drift. Nothing re-verifies them the way tests and types get re-verified, and one
line is short enough to actually re-read on every edit.

## The test: could a future edit make this sentence wrong?

One question decides whether a comment stays, and it is **not** length.

**A fact can be falsified.** A measured number, a framework behaviour, an ordering
requirement, an external format's semantics, a defence of code that looks wrong. Someone
changes the code, the sentence becomes false, and something breaks. Keep it, and give it
whatever room it needs to be usable — eight lines of framework behaviour is right when all
eight lines are the behaviour.

**An argument cannot be falsified.** "X rather than Y, because Y would have…" stays true
forever no matter what the code does, because it is about a decision and not about the
code. One line if the decision still constrains the next edit, otherwise the commit
message or an ADR.

Length is the symptom people reach for and it is the wrong instrument: the longest
comments in a codebase are usually its most load-bearing, so any line ceiling takes those
first.

If the fact becomes inferable — a rename, a type, an assertion makes it obvious — delete
the comment. It is drift risk now, not documentation.

## Not a comment

- **A rejected alternative.** Usually the largest single category of bloat. A reader who
  deletes it still edits the file correctly; they lose the argument, and the argument
  belongs in the commit message.
- **WHAT-restatement.** A comment repeating in English what the next line already says.
  Delete it and the code reads as clearly? It never earned its place.
- **Tombstones and changelog.** `// removed X because Y`, `// old: … new: …`, dated
  notes, commented-out code kept "just in case." Git history is the changelog.
- **Provenance narration.** A bare ticket or ADR reference on the constraint line is fine.
  The story of how it got there is not.

## A doc-comment marker is not a bigger budget

A docblock earns more room in exactly one case: **something renders it to a reader who
never opens the file.** That reader is the whole justification, so find them before
writing the block.

They exist in two shapes, and the second is the one people miss:

- **A command here builds a page** — a docs script in the manifest, a generator step in
  CI, a `.docc` catalog, a `typedoc`/`sphinx`/`godoc`/`jazzy` config.
- **Publishing does it with no command in the repo at all** — `pkg.go.dev` renders every
  exported Go comment off a tag, `docs.rs` renders on publish, a published package's types
  reach people who never clone it. In those ecosystems the docblock is published by
  default and this section does not restrain it.

Two things that are *not* that reader: a `public`/exported marker, which is a module
boundary and not an audience, and an IDE hover popup, which is read by someone who already
has the file open.

{{DOC_SURFACES}} {{DOC_COMMENT_FORM}}

## Where the comment is not a comment

Sometimes the docblock is a runtime object or a build requirement. **Nothing in this file
reaches it** — not the one-line budget, not the forbidden list, not the self-check.

- **A docstring that is code.** Python's is `__doc__`, read by `argparse`, Click and FastAPI
  at run time, and a doctest inside one **is a test**. Deleting it is a code change, and the
  suite goes green afterwards because there is nothing left to collect.
- **A doc comment a linter requires** (Go's `revive` `exported`, Rust's `missing_docs`).
  Cutting it fails the build rather than saving a line.
- **A doc comment whose convention is to restate the name.** Go's begins with the
  identifier — `// UserStore persists users.` above `type UserStore` — which is
  WHAT-restatement by shape and required documentation by function. The convention wins.
- **Adjacency rules.** Go drops the text entirely if one blank line separates the comment
  from the declaration, with no complaint from `gofmt` or `go vet`. Keep the form the tool
  reads.

## Self-check before you finish

**First: is this a docblock that something renders, that a linter requires, or that the
language executes?** Then stop — none of the questions below apply to it.

For every other comment:

1. Could a future edit make it false? Keep it, at the length it needs.
2. Would it stay true no matter what the code does? Cut it, whatever its length.
3. Does it say WHAT the next line says, in different words? Cut it.
4. Is it now inferable from a rename, a type or an assertion? Cut it.
5. Does it run past one line, on a declaration nothing renders? Bring it back to one.

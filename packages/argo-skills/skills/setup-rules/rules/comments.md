---
paths:
  - "{{SOURCE_GLOBS}}"
---

# Comment Discipline

**An ordinary comment is one line**, and most declarations spend nothing. It binds every
comment syntax equally. Comments drift, because nothing re-verifies them the way tests and
types are re-verified, and one line is short enough to re-read on every edit.

It does **not** bind a docblock something renders, a linter requires, or the language
executes. The last two sections say which those are here.

## The test: could a future edit make this sentence wrong?

- **A fact can be falsified** (a measured number, a framework behaviour, an ordering
  requirement, a defence of code that looks wrong). Keep it, at whatever length it needs.
- **An argument cannot be falsified** ("X rather than Y, because Y would have…"). One line if
  the decision still constrains the next edit; otherwise the commit message or an ADR.
- If the fact becomes inferable (a rename, a type, an assertion) delete the comment.

## Not a comment

- **A rejected alternative.** The argument belongs in the commit message.
- **WHAT-restatement.** If deleting it leaves the code as clear, it never earned its place.
- **Tombstones and changelog.** `// removed X`, `// old: … new: …`, dated notes, commented-out
  code. Git history is the changelog.
- **Provenance narration.** A bare ticket or ADR reference on the constraint line is fine.
  The story of how it got there is not.

## A doc-comment marker is not a bigger budget

A docblock earns more room in exactly one case: **something renders it to a reader who never
opens the file**. Either a command here builds a page (a docs script, a `.docc` catalog, a
`typedoc`/`sphinx`/`godoc` config), or publishing does it with no command in the repo at all
(`pkg.go.dev`, `docs.rs`, a published package's types). A `public`/exported marker is a module
boundary, not an audience, and an IDE hover popup is read by someone with the file open.

{{DOC_SURFACES}} {{DOC_COMMENT_FORM}}

## Where the comment is not a comment

Nothing in this file reaches a docblock that is a runtime object or a build requirement:

- **A docstring that is code.** Python's is `__doc__`, read at run time, and a doctest inside
  one is a test.
- **A doc comment a linter requires** (Go's `revive` `exported`, Rust's `missing_docs`), and
  one whose convention is to restate the name (`// UserStore persists users.`).
- **Adjacency rules.** Go drops the text if a blank line separates comment from declaration.
  Keep the form the tool reads.

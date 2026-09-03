# Comment Discipline

**An ordinary comment is one line**, and most declarations spend nothing. It binds `//`, `///`,
`/* */` and `#` alike. Comments drift, because nothing re-verifies them the way tests and types
are re-verified, and one line is short enough to re-read on every edit.

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
- **Provenance narration.** A bare `#412` or `ADR-0017` on the constraint line is fine. The
  story of how it got there is not.

## `///` is not a bigger budget

A doc marker earns room only where **something renders it to a reader who never opens the
file**. Nothing in this repo is published and no docs build exists, and an Xcode Quick Help
popup is read by someone with the file open. So every `///` here is an ordinary comment on the
one-line budget. The day a docs build lands, this paragraph changes for exactly the
declarations it renders.

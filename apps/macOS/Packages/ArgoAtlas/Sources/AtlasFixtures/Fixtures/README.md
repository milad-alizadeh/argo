# The Map fixture

`argo-map.json` is a real measurement of this repository at commit `4478553`, trimmed to 89 of
its 2,452 files. It is not synthetic: every number in it was measured, and a tiler tested only
against tidy numbers is a tiler that breaks on the first repository.

## How it was measured

`git ls-files` for what exists, one pass of `git log --name-only` for the history, and the bytes
of each file for the rest. Five measures, all of which any git repository yields with no prior
setup:

| measure | what it is | absent when |
| --- | --- | --- |
| `bytes` | the file's size on disk | never |
| `lines` | its line count | the file holds a NUL byte, so it is binary and has no lines |
| `commits` | commits that touched the path | never, for a tracked file |
| `authors` | distinct authors among those commits | never, for a tracked file |
| `age_in_weeks` | whole weeks since the last commit touching it | never, for a tracked file |

The set is the generator's, not Argo's — nothing downstream may assume these five and no others
(#1145). The shipped generator is `ArgoEngine`'s and is not written yet; when it lands it may
measure more, and this fixture stays valid because the bag is open.

## What was kept, and why

Six subtrees, each kept whole so the nesting inside them is the repository's own:
`apps/macOS/Packages/ArgoAtlas`, `apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Evidence`,
`apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures`, `docs/domain`, `docs/designs/composer-picker`
and `rules`.

They were chosen for the awkward cases they carry, which is the whole point of the fixture:

- **One enormous file.** `ArgoFixtures/Fixtures/settled-session.jsonl` is 4,800 lines and 4.8 MB
  against a median of 61 lines — 78× the median, which is the ratio a treemap has to survive.
- **Deep nesting.** `Shell/Deck/Evidence/Syntax/EvidenceLanguage.swift` sits eleven levels down.
- **A file measuring zero.** 57 of the 89 measure `age_in_weeks: 0`, which is the value a band
  on a log scale divides by.
- **A file carrying no value for a measure others have.** The twenty PNGs under
  `composer-picker` have no `lines` at all, so anything drawing `lines` has to draw them anyway.

One awkward case this repository does not produce is a Plot whose measure bag is empty: every
tracked file here has a size and a history. That case is covered by a decode test written
inline rather than faked into a real measurement.

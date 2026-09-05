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

## The couplings

`couplings` was counted later, when the map learned to draw ties (#1160), and it is measured the
same way the rest of the file is: one pass of `git log --no-renames --name-only` at the same
commit, restricted to these 89 paths, by the shipped generator's own rules — Jaccard, a
commit-size cap at the p90 of the commits that touched more than one of them, and the strongest
20 neighbours per file. 718 commits, 31 of which touched two or more of these files, under a cap
of 12: **231 couplings**.

The count is small because the fixture is a TRIM. Most of this repository's commits touch none of
the 89 files kept, so the history behind them is a fraction of the history behind the whole map —
which is the right shape for a fixture and the wrong one for a claim about the repository. What it
is for is the drawing: enough ties, at enough different strengths, that a cord drawn without its
own strength or a pair drawn twice is visible in a render rather than plausible.

## The written layer

`argo-notes.json` is the same repository's Notes (#1159), and it is a **second file on purpose**:
the map is drawn from `argo-map.json` alone, this is fetched separately, and anything that never
asks for it draws exactly the same map. It is the one fixture here that was **written rather than
measured** — four notes and three folder captions, written by hand into the shape the prototype's
writer produces (`docs/designs/prototypes/atlas-notes-write.mjs`), down to the `model` the shape
records; each note carries the flag the measurements raised that got it written, and a caption
carries none.

Three of the four record a `subject`: the first sixteen hex digits of the SHA-256 of what was read
at the time of writing, taken from the checkout at commit `4478553` — real digests, so a check runs
for real. Two of those three subjects have been edited since, and read **stale**; one has not, and
reads **current**. The fourth records no digest at all and stays **unchecked**, which is not a claim
either way.

A folder caption records none either, because a folder holds no content of its own to digest, so a
caption is never marked. Nothing here is keyed to a path the Map holds no Plot at: a key naming
nothing on the map costs the reader nothing, it is simply never asked for.

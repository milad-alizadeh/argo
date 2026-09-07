# 0032 · The host is asked by commit, not by ref

Status: accepted (#1618) · 2026-09-07

Binding on `apps/macOS`. It settles what a Delivery's join key is once the code host has deleted
the branch, which this repository does on every merge. It leaves [ADR-0017](./0017-argo-owned-glue-state.md)
and [ADR-0008](./0008-persistence-files-only-derived-layer.md) standing, and most of what follows is the
reasoning for the two readings it refuses.

## Context

`GitHubDeliveries.delivery(ofBranch:)` asked the host one way:

```
/repos/<scope>/pulls?state=all&sort=updated&direction=desc&head=<owner>:<branch>
```

That filter matches the pull request's **live head ref**. GitHub deletes the head branch on merge
here, and once the ref is gone the filter stops matching. The answer therefore decays: a recently
merged pull request is still findable, an older one is not.

Two things break, and only one of them is a pixel.

**A row cannot draw a merged mark**, because `Delivery.pullRequest` has no source once the
fan-out answers `[]`.

**A worktree is never reaped.** `Hub.hasLanded` uses the same call, and
`WorktreeReaping.Candidate.verdict(landed:)` reaps only on `true` — "a host that was not asked,
could not be reached or holds no pull request answers `false` and the worktree stays." A merged
branch the host no longer indexes by ref answers `false` forever, so the directory survives. This
is the larger consequence and the ticket did not know about it.

### Measured

81 local worktree branches on this checkout, each asked both ways:

| lookup outcome | branches |
| --- | --- |
| both queries answer | 21 |
| ref filter only | 5 |
| **head SHA only** | **40** |
| neither | 15 |

Half the checkout is invisible to the shipped lookup. The 15 that answer neither way return
HTTP 422 `No commit found for SHA`: the local tip was never pushed, so the host does not have
that commit. Ref alone reaches 26 of 81, SHA alone reaches 61, and the two composed reach 66.

## Decision

**The branch stays the Delivery's join key. The host stops being asked by the ref.**

`CodeHostPort.delivery(of:in:grant:revalidating:)` takes a `BranchHead` — the branch and the
commit at its head, as one value, because they are one join key read off one `WorkspaceProjection`
and the parameter-count gate refuses a fifth argument. Inside `GitHubDeliveries`, and nowhere
else:

1. Ask `head=<owner>:<branch>`. If it answers, take it. **A live branch's behaviour does not
   move.**
2. On an empty answer, ask `/repos/<scope>/commits/<sha>/pulls`. That endpoint keys on a commit,
   and a commit is not deleted on merge.
3. **A 422 from step 2 reads as `nil`, and does not stop the fan-out.** Every other failure is a
   refusal and stops it, as before.
4. Where a commit carries several pull requests, prefer a merged one, then the most recently
   updated. The commits endpoint takes no `sort`, so this order is Argo's and is chosen rather
   than inherited.
5. Where nothing answers, the row draws **no mark** — the same rendering as a branch nobody
   opened a pull request for.

`WorktreeReaping.Candidate` grows `headSha`, filled at `candidate(at:workspace:)` from the
`WorkspaceProjection` that already carries it, so `hasLanded` stops being blind.

Nothing is persisted, nothing is asserted, and every fact stays DERIVED.

## Why not the other two readings

**A durable Delivery ledger** — persist the derived Delivery so a merged one survives a launch.
Refused. ADR-0017 says in terms that "persisting a derived join is the drift bug ADR-0008 killed
the SQLite mirror to avoid," and it enumerates exactly two categories of owned state: the Project
registry and user-asserted links. A Delivery is neither. This reading looks like the smaller
change and is the only one of the three that needs a standing ADR overturned, and it buys a
record that goes stale the moment a pull request is reopened.

**Move the join to the pull request number** — resolve branch to number once, persist the number,
fetch by number after that. Refused, though it is the honest one the ticket preferred.
`DeliveryAssertions` already persists a per-Project `branch → Int` map, so the storage shape
exists and the change looks cheap. But that number is there because **a human asserted it**, and
a number Argo remembered from its own derivation is a different provenance in the same field.
Conflating the two would make `DeliveryTicketLink`'s `asserted` fallback mean two things, and the
join precedence in ADR-0014 depends on it meaning one.

Both readings answer a question that does not need owned state, because the host still holds the
answer and is simply being asked the wrong way.

## Not a case

**A merged Delivery whose worktree has been reaped.** The fan-out walks local Workspaces
(`DeliveryDerivation.branches(of:)`), so a branch with no worktree is asked about by nothing and
has no row to draw a mark on. No Workspace, no row, no Delivery — which follows from Delivery
being derived per branch from local git ∪ the host.

This is written down because the durable-ledger reading only looks necessary if you believe a
rowless Delivery should still be remembered.

## Consequences

**Cost falls, and this is worth stating so the change is not read as a regression against
#1588.** Today the 40 blind branches answer `nil`, are therefore not `isFinished`, are therefore
excluded from the `settled` cache, and are re-asked **every tick, forever**. After this they
answer merged once and the cache retires them. Against that, the 15 unpushed branches pay one
extra request per tick. On this checkout the net is roughly −40/+15 requests per tick.

**#1619 rests on a premise this invalidates.** "A branch with no pull request is asked about
every minute, forever" counts 40 branches that do have one — a merged one — and read as no-PR
branches only because the lookup is blind. Anything that prunes those branches from the fan-out
must land after this, or the merged marks never return.

**The 422 rule is the sharpest thing here and was not what the ticket asked about.** A throw from
the per-branch fan-out sets `union.refusal` and `break`s the loop, deliberately, because a host
that refused one branch is refusing the read. But 422 on this endpoint means *this commit is not
mine*, which is a true per-branch fact. Left to throw, any one of 15 unpushed branches could
truncate a whole derivation, silently and in an order nobody would reproduce.

**Reaping is fixed but not run.** The lookup change makes `hasLanded` answer truthfully for
around 40 directories at once. The count is reported and the sweep is taken deliberately, by a
person, having seen it.

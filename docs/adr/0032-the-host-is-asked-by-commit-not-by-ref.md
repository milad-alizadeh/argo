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

### Re-measured, with the head filter (#1618)

The 40 above were counted before the head filter existed, and they do not survive it. 74 local
worktree branches, each asked both ways:

| lookup outcome | branches |
| --- | --- |
| ref filter answers, merged | 15 |
| ref filter answers, not merged | 9 |
| **commit answers a pull request headed by this tip, merged** | **1** |
| commit answers, but no pull request is headed by this tip | 39 |
| commit absent (422) | 10 |

So the fallback recovers **one** branch on this checkout, not forty. The other 39 were the base's
own merge pull request answering for a worktree sitting at the base's tip, and 4 of them were
verified by hand to carry a head ref belonging to an unrelated branch. Two consequences the first
measurement got backwards:

- **`hasLanded` would have reaped live worktrees.** Unfiltered, `argo/#1582-background-shell-rail`
  answers merged pull request #1650, whose head ref is `worktree-ticket-1633-bundle-module-trap`.
  `WorktreeReaping` states the invariant this breaks in terms: "a branch nobody ever pushed cannot
  pass — there is no pull request to have merged."
- **Cost rises rather than falls.** Those 39 branches and the 10 that 422 still answer `nil`, are
  still not `isFinished`, and are therefore still re-asked every tick — now at one extra request
  each. Net is about +49 per tick on this checkout, not −25. #1619's premise stands: those really
  are branches with no pull request of their own.

## Decision

**The branch stays the Delivery's join key. The host stops being asked by the ref.**

`CodeHostPort.delivery(of:in:grant:revalidating:)` takes a `BranchHead` — the branch and the
commit at its head, as one value, because they are one join key read off one `WorkspaceProjection`
and the parameter-count gate refuses a fifth argument. Inside `GitHubDeliveries`, and nowhere
else:

1. Ask `head=<owner>:<branch>`. If it answers, take it. **A live branch's behaviour does not
   move.**
2. On an empty answer, ask `/repos/<scope>/commits/<sha>/pulls`. That endpoint keys on a commit,
   and a commit is not deleted on merge. **Only a pull request whose own HEAD is that commit is
   taken**, and it is filed under the branch that was asked about rather than under the host's
   `head.ref`. GitHub documents this path as listing the merged pull request that *introduced* the
   commit, so a branch at the base's tip is otherwise answered with whichever pull request produced
   that tip — measured below.
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

**Cost rises, by about 49 requests a tick on this checkout.** The paragraph this replaces claimed
the opposite off the 40-branch count, and the re-measurement above is why it does not hold: a
branch the commit path answers nothing of its own for is still `nil`, still not `isFinished`, and
still re-asked every tick — now with a second request on it. The saving is one branch's, and the
reason to take this change is that a merged Delivery must stay knowable and a live worktree must
not be reaped, not that it is cheaper.

**#1619's premise stands.** "A branch with no pull request is asked about every minute, forever"
was thought to be counting 40 branches that did have one; with the head filter, 39 of them have
none. #1619 may prune them, and this ADR asks nothing of its ordering any more.

**The 422 rule is the sharpest thing here and was not what the ticket asked about.** A throw from
the per-branch fan-out sets `union.refusal` and `break`s the loop, deliberately, because a host
that refused one branch is refusing the read. But 422 on this endpoint means *this commit is not
mine*, which is a true per-branch fact. Left to throw, any one of 15 unpushed branches could
truncate a whole derivation, silently and in an order nobody would reproduce.

**Reaping is fixed but not run.** The lookup change makes `hasLanded` answer truthfully for
around 40 directories at once. The count is reported and the sweep is taken deliberately, by a
person, having seen it.

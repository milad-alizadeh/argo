---
name: ship
description: "Close out an implemented ticket: commit the work, gate it once on the base it was cut from, push, and open one PR that closes the ticket. Rebasing is the landing lane's job, not this one's. Run after the diff has been reviewed."
disable-model-invocation: true
---

# Ship

A ship run ends in a PR URL, or in one of the three stops below. It never ends in a question:
anything you could not tick is written into the PR body, not handed back to the caller.

Merging stays with the human.

## The only three stops

- **You are on the default branch** (`git rev-parse --abbrev-ref HEAD`). The work should have
  been built on a branch. Say so and stop.
- **A PR is already open for this branch**
  (`gh pr list --head "$(git rev-parse --abbrev-ref HEAD)"`). Run everything below anyway — the
  push is what puts the new commits on it — then report its URL and open no second one.
- **A conflict you cannot resolve from the diff** (below). An ordinary conflict is not one of
  these: you resolve that one yourself and carry on to the PR.

## Do not rebase to open a PR

A ship run gates the branch **once**, on the base it was cut from, and pushes it there.

This used to rebase onto `origin/<base>` first, and that was the single most expensive habit in
the repo. The gate is keyed to the push, so every rebase re-ran it — over a build the rebase had
just made cold, because a replayed commit rewrites the mtime of every file it touches and llbuild
invalidates on mtime. `main` took 91 commits on the day #1377 was written. With eight lanes open,
each merge invalidated seven other bases, and the cost of the gate was lanes multiplied by
merges rather than lanes plus merges. Every rebase but the last was work thrown away, because the
branch was going to be rebased again before it landed.

So the rebase moves to where it is needed once: `scripts/land.sh`, the landing lane, which
rebases, gates and merges in one serialized pass. See `docs/agents/landing.md`.

1. **Commit everything outstanding.** Anything the steps below change is committed the same way,
   before the push.
2. **Resolve the base**, never assume it. An open PR states its own
   (`gh pr view --json baseRefName -q .baseRefName`). Otherwise it is the branch this one was cut
   from: the repo default (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`),
   unless you stacked this branch on another ticket branch, which is then the base.
3. `git fetch origin` — the whole remote, so the push below has a current remote-tracking ref.
   **Do not rebase onto it.** Being behind the base is not a defect in a branch; it is the
   normal state of one, and the landing lane is what resolves it.
4. **Say the base in the PR body**, and the merge base you gated on
   (`git merge-base HEAD origin/<base>`). That is what a reviewer needs to read the diff.

### When GitHub says the PR cannot merge

After the push, `gh pr view --json mergeable -q .mergeable` answers `CONFLICTING` for a branch
whose conflict a person has to resolve. That is the one case where ship rebases: the landing lane
cannot invent an answer either, and a PR nobody can merge is not shipped.

Then, and only then: `git rebase origin/<base>`, resolve with `resolving-merge-conflicts` — it is
the method, and `ship` does not carry a second one — `git rebase --continue` to the end, never
`--abort`, re-run the gates, and push again with `--force-with-lease`. Name every path that
conflicted in the PR body, so a reviewer can find each resolution without reading the reflog.

### The one conflict that stops the run

Both sides changed the **same behaviour** for different reasons, and nothing you can read says
which behaviour is wanted now — not the two commit messages, not the tickets they close, not the
PRs behind them. Picking a side there is inventing the answer. Leave the rebase where it stands,
report `git diff --name-only --diff-filter=U`, and name the file and the decision it needs.

That is the whole test, and it is about intent. Difficulty is not the test and size is not the
test. Two edits on neighbouring lines, an import list, a list of cases, a changelog, the same
rename made twice — these collide in text and agree in intent. Resolve them and carry on.

## Before the push

Nothing here is a reason to stop.

- **Gates.** Run them on the tree you are about to push. An edit that nothing ran is how a PR
  passes review and fails to build. For UI work, look at the affected states; unit tests do not
  show you a screen. The Swift gate remembers the tree it passed, so a second run over an
  unchanged tree costs a hash lookup — never take `ARGO_SKIP_SWIFT_GATE=1` to save time it is
  not going to spend.
- **Screenshots.** If the diff changes how a screen looks, the PR body carries one screenshot
  per changed state. Publish and embed them per `docs/agents/issue-tracker.md`, Screenshots.
- **Leftovers.** `git grep` the changed files for `.only`, debug prints, commented-out code and
  a TODO with no ticket number. The changed files carry none of them by the time you push.
- **Review findings.** Fix each in the diff, or carry it.

## Carry, never block

Each of these belongs in the PR body, and the ship continues past it.

- **No review ran.** Do not run one here — a review needs a fresh context, and running it is
  the caller's step. Say in the body that the diff is unreviewed.
- **A finding you did not fix**, each with the reason.
- **No ticket to close.** Derive `<N>` from the branch name or the ticket you built. If there
  genuinely is none, open the PR with no `Closes` line and say so in the body.

## Then ship

1. Commit what the steps above changed, with a message that states what changed and why.
2. Push with `git push -u origin HEAD`. Nothing rewrote the commits, so this is a fast-forward
   and needs no lease. `--force-with-lease` belongs to the one path that does rewrite them —
   the `CONFLICTING` case above — and a bare `--force` belongs to none, because it drops a
   teammate's push. A `stale info` rejection there means the remote branch moved since the
   fetch: fetch again, rebase again, and push.
3. **Run the PR title and body through the `simple-english` skill.** This holds for every PR,
   and it holds when the text already reads well. Draft the title and the body. Put both through
   the skill. Give `gh pr create` what it returns. The skill carries its own rules, so this step
   states none of them: a copy here goes stale against the skill. Change the style only. Keep
   every fact, and leave code, paths, error strings and `Closes #<N>` exactly as they are. If
   the skill is not installed, write short sentences in the active voice and change no
   identifier.
4. Open exactly one PR with `gh pr create --base <base>`, ready for review, its body carrying
   `Closes #<N>` and everything the section above told you to carry. Skip this step for a branch
   that already had a PR open — the push updated it.
5. Report the PR URL. The branch lands through `scripts/land.sh`, not from here, and merging
   stays with the human either way.

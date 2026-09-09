---
name: ship
description: "Close out an implemented ticket: commit the work, gate it once on the base it was cut from, push, and open one PR that closes the ticket. Rebasing is the landing lane's job, not this one's. Run after the diff has been reviewed."
disable-model-invocation: true
---

# Ship

A ship run ends in a PR URL, in one of the three stops below, or in a failure it names (step 7).
It never ends in a question: anything you could not tick is written into the PR body, not handed
back to the caller. It never ends in silence either.

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

The rebase therefore does not happen here. A branch is rebased when it is about to be merged
and not before, and merging is the human's (#1577). See `docs/agents/landing.md`.

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

- **Gates.** Step 4 below is the one call. An edit that nothing ran is how a PR passes review and
  fails to build. For UI work, look at the affected states; unit tests do not show you a screen.
- **Screenshots.** If the diff changes how a screen looks, the PR body carries one screenshot
  per changed state. Publish and embed them per `docs/agents/issue-tracker.md`, Screenshots.
- **Leftovers.** `git grep` the changed files for `.only`, debug prints, commented-out code and
  a TODO with no ticket number. The changed files carry none of them by the time you push.
- **The ticket is still open.** `gh issue view <N> --json state,stateReason` — one request, and
  it belongs HERE rather than where the run first read the ticket, because the closure that
  matters is the one that lands WHILE you work. #1619 was closed as already addressed by #1620
  ninety minutes before the lane on it opened #1657, and that lane had read an open ticket at its
  start: a check there would have caught nothing. What a closed ticket changes is below.
- **Review findings.** Fix each in the diff, or carry it.

## Carry, never block

Each of these belongs in the PR body, and the ship continues past it.

- **No review ran.** Do not run one here — a review needs a fresh context, and running it is
  the caller's step. Say in the body that the diff is unreviewed.
- **A finding you did not fix**, each with the reason.
- **No ticket to close.** Derive `<N>` from the branch name or the ticket you built. If there
  genuinely is none, open the PR with no `Closes` line and say so in the body.
- **A ticket that closed while you worked.** The work exists and may still be worth having.
  Whether it is wanted now is the human's to decide, and a decision is not a question to hand
  back, so the ship continues — with three things changed:
  - **No `Closes #<N>` line.** GitHub credits an issue's closure to the PR that carries it, so
    that one line replaced the triage verdict on #1619 with a PR nobody merged: anyone reading
    the ticket saw it closed by the very work its closure had ruled unnecessary. Name it in prose
    instead — `Answers #<N>, closed <date> as <stateReason>`.
  - **The closure leads the body**, quoting the closing comment and naming whatever it cites.
    The argument that this diff is moot is the first thing a reviewer needs, not a footnote under
    the measurements.
  - **Open it as a draft**, per step 5. A branch waiting on "is this still wanted" is not waiting
    on review, and the ready queue is for branches that are.

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
4. **Run `bun run format-and-lint` and `bun run test:hooks` before opening the PR**, and open
   nothing if either fails. There is no push-time hook any more (#1758): nothing checks a branch
   between the push in step 3 and CI's first run, so this is the last point at which a breach
   costs one command instead of a red pull request. These two are exactly what CI runs, so a
   green pair here means a green run there.

   If `implement` already ran them on this same committed tree, say so in the PR body and run
   them again anyway — they take seconds, and the tree may have moved since.
5. **Open exactly one PR, and give `gh` the body from a file.** Put what step 3 returned on disk
   first, at a scratch path outside the repository so no commit can pick it up. Write it with
   your harness's file-writing tool; with only a shell, `cat > <path> <<'BODY'` is a plain
   redirection into a file and is fine. Then one command, and nothing computed inside it:

   ```
   gh pr create --base <base> --title "<title>" --body-file <path>
   ```

   Ready for review, with `Closes #<N>` in the body and everything the section above told you to
   carry. A ticket that closed while you worked takes `--draft` and no `Closes` line, for the
   reasons above. Skip this step and step 6 for a branch that already had a PR open — the push
   updated it, and the hook gated it — and report that PR's URL.

   **The body never reaches `gh` as an argument or on stdin.** Two shapes have each cost this
   repo a ship:
   - **A heredoc inside a command substitution** — `--body "$(cat <<'EOF' ...)"`. The `--body`
     value is then computed at runtime, and a harness that isolates the session to a worktree
     screens commands before running them: it cannot tell what this one will run, so it refuses
     the whole command and `gh` never starts. That is what stopped the run in #1659. The refusal
     was the harness's own, not any script in this repo, so the exact wording varies — what does
     not vary is that a command substitution is what made the command unreadable to it.
   - **A heredoc the shell hands to stdin** — `--body-file -`, or any pipe into `gh`. This opened
     PR #1016 with an empty body and exit code 0, so nothing failed and nothing said so.

   A file has neither failure mode, and it survives a retry unchanged.
6. **Read the body back from the API before you call the PR done**, because the body is the one
   part of a PR that nothing else checks: #1016 shipped empty at exit 0 and no gate noticed.
   One request, one comparison:

   ```
   gh pr view <url> --json body -q .body | wc -c
   wc -c < <path>
   ```

   The two counts agree within a byte or two: on PR #1660 the file was 2121 bytes and the
   read-back 2122, the difference being the newline `-q` adds. A body that came back **empty, or
   under half the file**, was not shipped: repair it with `gh pr edit <url> --body-file <path>`
   and measure again.
7. **A PR you could not open is reported, never swallowed.** When `gh pr create` exits non-zero,
   say three things — the exit code, the error text whole, and the command you ran — and report
   the branch as pushed and the PR as unopened. A turn that ends on a failed `gh pr create`
   having said nothing is indistinguishable from a run that never started (#1659).
8. Report the PR URL. Merging is the human's, and nothing in this repo does it for them
   (#1577).

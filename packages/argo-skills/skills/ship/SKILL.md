---
name: ship
description: "Close out an implemented ticket: commit the work, bring the branch onto the current base, gate it there, push, and open one PR that closes the ticket. Use when the user asks to ship, raise a PR or open a pull request, and only after the diff has been reviewed."
---

# Ship

A ship run ends in a PR URL with passing CI, in one of the three stops below, or in a failure it names (step 7).
It never ends in a question: anything you could not tick is written into the PR body, not handed
back to the caller. It never ends in silence either.

## The only three stops

- **You are on the default branch** (`git rev-parse --abbrev-ref HEAD`). The work should have
  been built on a branch. Say so and stop.
- **A PR is already open for this branch**
  (`gh pr list --head "$(git rev-parse --abbrev-ref HEAD)"`). Run everything below anyway — the
  push is what puts the new commits on it — then report its URL and open no second one.
- **A conflict you cannot resolve from the diff** (below). An ordinary conflict is not one of
  these: you resolve that one yourself and carry on to the PR.

## Ship onto the current base

A ship run brings the branch onto its base **first**, gates it there, and opens the PR on that.

A PR opened on a stale base asks a reviewer to read a diff against a tree nobody has. Its checks
pass on a merge nobody will make, and its conflicts surface at merge time instead — in the human's
hands, which is the worst moment to find them. A branch that looks ready and cannot merge is not
ready. Nobody wants an out-of-date PR.

With no push-time gate a rebase costs a fetch and a replay. **Where the project has an expensive
one, weigh the replay against it** rather than rebasing by reflex: a replay rewrites the mtime of
every file it touches, and a build system that invalidates on mtime then rebuilds everything,
once per lane per merge.

1. **Commit everything outstanding.** Anything the steps below change is committed the same way,
   before the push.
2. **Resolve the base**, never assume it. An open PR states its own
   (`gh pr view --json baseRefName -q .baseRefName`). Otherwise it is the branch this one was cut
   from: the repo default (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`),
   unless you stacked this branch on another ticket branch, which is then the base.
3. `git fetch origin` — the whole remote, so the rebase and the push read a current ref.
4. **`git rebase origin/<base>`.** Already up to date is the common answer and costs nothing.
   When it conflicts, resolve with `resolving-merge-conflicts` — it is the method, and `ship` does
   not carry a second one — then `git rebase --continue` to the end, never `--abort`. Name every
   path that conflicted in the PR body, so a reviewer can find each resolution without reading the
   reflog.
5. **Re-run the gates after a rebase that moved a commit**, before the push. A replayed commit is
   a tree nothing has checked, and "it was green before the rebase" is a statement about a
   different tree.
6. **Say the base in the PR body**, and the commit you rebased onto
   (`git rev-parse origin/<base>`). That is what a reviewer needs to read the diff.

What changes is that the human is handed a branch that can actually merge.

### When GitHub still says the PR cannot merge

After the push, `gh pr view --json mergeable -q .mergeable` should answer `MERGEABLE`. A
`CONFLICTING` here means the base moved between the rebase and the push: fetch again, rebase
again, re-run the gates, and push again with `ARGO_SHIP=1 git push --force-with-lease`.

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
  per changed state. Publish and embed them the way the project records; `pixel-review`'s
  `PR-EVIDENCE.md` carries a recipe that needs no commit. Where the project renders nothing yet,
  say so once and move on: the rule stands for the day it does.
- **Leftovers.** `git grep` the changed files for `.only`, debug prints, commented-out code and
  a TODO with no ticket number. The changed files carry none of them by the time you push.
- **The ticket is still open.** `gh issue view <N> --json state,stateReason` — one request, and
  it belongs HERE rather than where the run first read the ticket. The closure that matters is the
  one that lands WHILE you work, and a check at the start of the run cannot see it. What a closed
  ticket changes is below.
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

**Every push and every `gh pr create` below carries the `ARGO_SHIP=1` prefix, exactly as
written.** A `PreToolUse` hook denies both commands to an agent, because pushing a work branch
and opening a pull request are this skill's step and nothing in a hook's payload names the skill
that is running (#1669). The prefix is how this skill says it is the one running. Drop it and the
command is refused, with the reason quoting this rule back at you. Put it on nothing else.

1. Commit what the steps above changed, with a message that states what changed and why.
2. Push with `ARGO_SHIP=1 git push -u origin HEAD`, adding `--force-with-lease` when the rebase
   moved a commit that had already been pushed. Never a bare `--force`: it drops a teammate's
   push, and the lease is the whole difference. A `stale info` rejection means the remote branch
   moved since the fetch — fetch again, rebase again, re-run the gates, and push.
3. **Run the PR title and body through the `simple-english` skill.** This holds for every PR,
   and it holds when the text already reads well. Draft the title and the body. Put both through
   the skill. Give `gh pr create` what it returns. The skill carries its own rules, so this step
   states none of them: a copy here goes stale against the skill. Change the style only. Keep
   every fact, and leave code, paths, error strings and `Closes #<N>` exactly as they are. If
   the skill is not installed, write short sentences in the active voice and change no
   identifier.
4. **Run the project's gate before opening the PR**, and open nothing if it fails. Resolve the
   command in this order, and name the one you used in the PR body:

   1. The **Rules and gates** section of the project doc (`AGENTS.md`, or `CLAUDE.md` where it
      carries a body of its own), which names the single script that runs every gate.
      `setup-quality-gates` writes that section, so a project it set up has the answer written
      down rather than guessed at.
   2. The manifest's own scripts, through whichever package manager the lockfile names:
      `quality` if it exists, otherwise `lint` and the test script together.
   3. **No gate found.** Say so in one line of the PR body and open the PR anyway. This skill
      carries rather than blocks, and a project with no gate is not a reason to strand finished
      work.

   Run the whole gate rather than one half of it. Where the script is an aggregate, a single
   linter is not a substitute: a duplication or type breach it never looked at is still there
   for CI to find. Nothing checks a branch between the push in step 3 and CI's first run, so
   this is the last point at which a breach costs one command instead of a red pull request.

   If it already ran on this same committed tree, say so in the PR body and run it again anyway.
   It takes seconds, and the tree may have moved since.
5. **Open exactly one PR, and give `gh` the body from a file.** Put what step 3 returned on disk
   first, at a scratch path outside the repository so no commit can pick it up. Write it with
   your harness's file-writing tool; with only a shell, `cat > <path> <<'BODY'` is a plain
   redirection into a file and is fine. Then one command, and nothing computed inside it:

   ```
   ARGO_SHIP=1 gh pr create --base <base> --title "<title>" --body-file <path>
   ```

   Ready for review, with `Closes #<N>` in the body and everything the section above told you to
   carry. A ticket that closed while you worked takes `--draft` and no `Closes` line, for the
   reasons above. Skip this step and step 6 for a branch that already had a PR open — the push
   updated it, and step 4 gated it — and report that PR's URL.

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
8. **Watch CI to a verdict.** After the PR exists or its existing branch has been pushed, run
   `gh pr checks <url> --watch --interval 10`. Do not report the PR as shipped while a required
   check is pending. A failed repository check is work still on the branch: inspect its failed
   run with `gh run view <run-id> --log-failed`, fix the cause in the current worktree, commit,
   run the project gate again, push with `ARGO_SHIP=1 git push` (adding `--force-with-lease` only
   when required), and watch the new run. Repeat until the required checks pass.

   A GitHub outage, runner network failure, missing secret, or unavailable external service is
   not a code failure to guess at. Re-run the affected check once when GitHub permits it. If it
   fails again for that external reason, report the PR URL and name the check, evidence, and
   external block. Do not call that CI passing.
9. Report the PR URL and its CI verdict. Merging is the human's, and nothing in this repo does it
   for them (#1577).

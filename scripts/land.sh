#!/bin/sh
# The landing lane: one place where branches are rebased, gated and merged, one at a time.
#
# Every lane used to do this for itself, and the arithmetic was the problem. `ship` rebased
# onto the base before every push, the push gate is keyed to the push, and `main` took 91
# commits on the day #1377 was written — so with eight lanes open, every merge invalidated
# seven other bases and each of those lanes ran a full, cold gate to catch up. The cost of the
# gate was lanes MULTIPLIED BY merges, and all but the last rebase of each branch was thrown
# away when the next merge landed.
#
# Here it is lanes PLUS merges. A lane gates its own work once, on the base it was cut from,
# and opens its PR there (`packages/argo-skills/skills/ship/SKILL.md`). This script is what
# brings a green PR onto the current default branch: rebase, gate, push, merge, next.
#
# What it will not do:
#
#   - run two at once. One landing at a time is the whole point, and the lock below is
#     machine-wide, so a second invocation waits rather than racing the first onto `main`.
#   - touch a lane's worktree or the shared checkout. It works in `.claude/worktrees/landing`,
#     its own tree, created on first use and left in place afterwards.
#   - merge anything it did not just gate green, or resolve a conflict. A conflict is a
#     decision, and this script has no way to make one: it reports the PR and moves on.
#   - merge a rebase that takes the base BACKWARDS. A clean rebase can still delete a file `main`
#     has or put one back over a change `main` made since the branch was cut, and the gate cannot
#     see it: a fix and its guarding test removed together leave a green suite over a revert
#     (#1573, the audit in #1570). `land_regression` below reads the rebased tree against the tip
#     and refuses.
#   - merge at all under --dry-run, which stops after the gate and reports what it would do.
#
# Usage:
#   sh scripts/land.sh 1361 1364      # these PRs, in this order
#   sh scripts/land.sh --all          # every open, non-draft, mergeable PR, oldest first
#   sh scripts/land.sh --all --dry-run
set -eu

DRY_RUN=0
ALL=0
WANTED=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --all) ALL=1 ;;
    -*)
      echo "land: unknown option $arg" >&2
      exit 2
      ;;
    *) WANTED="$WANTED $arg" ;;
  esac
done

if [ "$ALL" = 0 ] && [ -z "$WANTED" ]; then
  echo "land: name the PRs to land, or pass --all" >&2
  echo "usage: land.sh [--all] [--dry-run] [PR…]" >&2
  exit 2
fi

command -v gh >/dev/null 2>&1 || {
  echo "land: gh is required — the merge and the PR state both come from it" >&2
  exit 1
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"
git_common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || {
  echo "land: not a git repository" >&2
  exit 1
}
REPO_ROOT=$(dirname "$git_common")

# One landing at a time, machine-wide. This is the same primitive the gate uses for build
# slots, with a root of its own and exactly one slot: two landings racing would rebase two
# branches onto the same tip and merge both, which is how a merge queue produces a `main`
# that neither branch was ever tested against.
#
# NOT exported, and unset for the gate below. `build_lock_acquire` is a function in THIS
# shell, so it needs no export — and exporting would hand the gate a lock root with one slot
# that its own parent is holding. The gate would wait for a slot only its parent can release,
# `kill -0` would find that parent very much alive, and every landing would hang for ever.
ARGO_BUILD_LOCK_ROOT=${ARGO_LAND_LOCK_ROOT:-${TMPDIR:-/tmp}/argo-land-lock}
ARGO_BUILD_LOCK_SLOTS=1
# shellcheck source=scripts/build-lock.sh
. "$SCRIPT_DIR/build-lock.sh"
build_lock_acquire

git -C "$REPO_ROOT" fetch --prune --quiet origin

BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null) || BASE=""
: "${BASE:=main}"

# The landing tree. Its own worktree, so a lane's tree is never checked out from under a
# session working in it, and the shared checkout is never moved off its branch.
LANDING="$REPO_ROOT/.claude/worktrees/landing"
if [ ! -d "$LANDING" ]; then
  git -C "$REPO_ROOT" worktree add --detach "$LANDING" "origin/$BASE" >/dev/null
fi
git -C "$LANDING" reset --hard --quiet "origin/$BASE"
git -C "$LANDING" clean -qfd

if [ "$ALL" = 1 ]; then
  # Oldest first. A queue that reordered itself would starve the branch that has been waiting
  # longest, which is the one most likely to conflict with everything merged since.
  QUEUE=$(gh pr list --state open --limit 100 --json number,isDraft,mergeable \
    --jq 'sort_by(.number) | .[] | select(.isDraft == false) | select(.mergeable != "CONFLICTING") | .number')
else
  QUEUE=$WANTED
fi

if [ -z "$QUEUE" ]; then
  echo "land: nothing to land"
  exit 0
fi

# The blob a path holds in a tree, or nothing where the tree has no such path. Absence is a
# reading here, not an error: "both sides have no file" is how a deletion of something the base
# only just gained compares equal, and `rev-parse` exits non-zero for it under `set -e`.
tree_blob() {
  git -C "$LANDING" rev-parse --quiet --verify "$1:$2" 2>/dev/null || true
}

# Whether the branch DECLARED this path, on one of its own commits. The declaration travels with
# the commit rather than the command line on purpose: a deliberate deletion is a decision somebody
# reviewed, and a flag typed at the landing lane is a decision nobody can see afterwards.
#
#   Removes-file: <path>     a file this branch deletes on the base
#   Reverts-file: <path>     a file this branch puts back over a change the base made
#
# One exact path per trailer, never a glob: a pattern that matched more than its author meant is
# the same silence this guard exists to break.
land_declared() {
  printf '%s\n' "$DECLARED" | grep -Fxq -- "$1"
}

# What landing this branch would take BACKWARDS on the base, one path per line, or nothing.
#
# Read off `origin/$BASE`..`HEAD` AFTER the rebase, where `origin/$BASE` is an ancestor of `HEAD`,
# so that diff is not a derivation of what the merge will do — it IS what the merge will do.
#
# Two shapes, because #1550 had both and a check for either alone passes the other:
#
#   deletes   a path the base still has that the rebased tree does not. Thirty-one of them there.
#   restores  a path whose rebased content is what the base held BEFORE its own most recent
#             change to it. The branch has undone that change whole, which the deletion check
#             cannot see because the file is still there.
#
# The second is read against the BASE's history and not against the branch's cut, deliberately.
# A merge-base is not where a branch's content came from once its lane has merged the base in and
# resolved by taking its own side — which is how #1550 arrived at the landing lane already
# carrying the old files, and why its rebase here was clean. `origin/$BASE`'s own last commit to
# the file is a fact no resolution on the branch can move.
land_regression() {
  # `--find-renames`, so a moved file is an R and not a D. Without it every rename on every
  # branch reads as a deletion, and a guard that cries on ordinary work is one somebody turns off.
  git -C "$LANDING" diff --name-only --find-renames --diff-filter=D "origin/$BASE" HEAD |
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      land_declared "$file" || echo "deletes $file"
    done

  git -C "$LANDING" diff --name-only "origin/$BASE" HEAD |
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      # Deletions are the loop above's, in the word that fits them.
      now=$(tree_blob HEAD "$file")
      [ -n "$now" ] || continue
      # What the base held before it last touched this file. Nothing where the base only ever
      # added it, and nothing at a root commit — in neither case is there a change to undo.
      last=$(git -C "$LANDING" rev-list --max-count=1 "origin/$BASE" -- "$file")
      [ -n "$last" ] || continue
      before=$(tree_blob "$last^" "$file")
      [ -n "$before" ] || continue
      # Byte-identical to that state. A branch that changed the file to something NEW is doing
      # work on it, however much of the base's it replaced; one that lands it exactly as it stood
      # before the base's change is putting the clock back.
      [ "$now" = "$before" ] || continue
      land_declared "$file" || echo "restores $file"
    done
}

landed=0
skipped=0

for pr in $QUEUE; do
  head=$(gh pr view "$pr" --json headRefName -q .headRefName 2>/dev/null) || head=""
  if [ -z "$head" ]; then
    echo "land: #$pr — no such PR" >&2
    skipped=$((skipped + 1))
    continue
  fi

  state=$(gh pr view "$pr" --json state -q .state 2>/dev/null) || state=""
  if [ "$state" != "OPEN" ]; then
    echo "land: #$pr — $state, not open"
    skipped=$((skipped + 1))
    continue
  fi

  echo "land: #$pr ($head) onto $BASE"
  # Into the remote-tracking ref, not FETCH_HEAD: that file is per worktree, so a fetch run
  # in the repository root writes one the landing tree cannot see.
  git -C "$REPO_ROOT" fetch --quiet origin "+refs/heads/$head:refs/remotes/origin/$head"
  git -C "$LANDING" checkout --quiet -B "landing/$head" "origin/$head"
  git -C "$LANDING" reset --hard --quiet "origin/$head"

  if ! git -C "$LANDING" rebase --quiet "origin/$BASE" >/dev/null 2>&1; then
    conflicted=$(git -C "$LANDING" diff --name-only --diff-filter=U 2>/dev/null | tr '\n' ' ')
    git -C "$LANDING" rebase --abort >/dev/null 2>&1 || true
    # A conflict is a decision about what the code should now do, and this script cannot make
    # one. It goes back to the branch's own session, which has the context to resolve it.
    echo "land: #$pr conflicts on $BASE — left for its lane: $conflicted" >&2
    skipped=$((skipped + 1))
    continue
  fi

  # Before the gate, not after it: this is arithmetic on two trees and costs milliseconds, and a
  # branch that must not land should not spend a build slot and several minutes proving it is
  # green first. It reports under --dry-run for the same reason — the question "would this land"
  # is answered wrong if the one thing that would stop it is not asked.
  #
  # The gate cannot stand in for it. The gate runs the tests that are THERE, so a branch that
  # removes a fix and the test guarding it together is green by construction (#1570).

  # The branch's own commits, which after the rebase are exactly `origin/$BASE..HEAD`.
  DECLARED=$(git -C "$LANDING" log --format=%B "origin/$BASE..HEAD" |
    sed -n 's/^[Rr]emoves-file:[[:space:]]*//p; s/^[Rr]everts-file:[[:space:]]*//p')
  regression=$(land_regression)
  if [ -n "$regression" ]; then
    echo "land: #$pr would take $BASE backwards — not gated, not pushed, not merged" >&2
    echo "$regression" | sed 's/^/land:   /' >&2
    echo "land:   a deliberate one is declared in the branch: Removes-file: / Reverts-file:" >&2
    skipped=$((skipped + 1))
    continue
  fi

  # The gate, on the rebased tree. It takes a BUILD slot of its own, from the machine-wide
  # pool the lanes use — which is why the landing lock's variables are unset here rather than
  # inherited. It also consults its own content key, so a rebase that changed nothing under
  # `apps/macOS` costs a hash lookup.
  if ! (
    cd "$LANDING" || exit 1
    unset ARGO_BUILD_LOCK_ROOT ARGO_BUILD_LOCK_SLOTS
    sh "$LANDING/scripts/swift-gate.sh"
  ); then
    echo "land: #$pr fails the gate on the current $BASE — left for its lane" >&2
    skipped=$((skipped + 1))
    continue
  fi

  if [ "$DRY_RUN" = 1 ]; then
    echo "land: #$pr would be pushed and merged (dry run)"
    landed=$((landed + 1))
    continue
  fi

  # The lease, not a bare force: the rebase rewrote the commits, and the lane may have pushed
  # since this script fetched. A rejection here means exactly that, and the next run picks the
  # branch up in its new state.
  if ! git -C "$LANDING" push --force-with-lease --quiet origin "HEAD:$head"; then
    echo "land: #$pr moved while it was being landed — leaving it for the next run" >&2
    skipped=$((skipped + 1))
    continue
  fi

  if gh pr merge "$pr" --squash --delete-branch; then
    echo "land: #$pr merged"
    landed=$((landed + 1))
    # The next branch rebases onto what this one just made, so the tip has to move here too.
    git -C "$REPO_ROOT" fetch --quiet origin "+refs/heads/$BASE:refs/remotes/origin/$BASE"
  else
    echo "land: #$pr gated green but the merge was refused — check its required reviews" >&2
    skipped=$((skipped + 1))
  fi
done

echo "land: $landed landed, $skipped left"

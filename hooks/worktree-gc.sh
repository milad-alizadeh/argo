#!/bin/sh
# Reap worktrees under .claude/worktrees/ whose work has landed.
#
# Merges happen on GitHub, so no local hook ever fires when a PR lands — worktrees
# accumulate until someone notices. This is that someone.
#
# A worktree is reaped only when its work is provably in the default branch AND
# nothing would be lost:
#
#   landed   — its PR is MERGED (the authoritative signal: this repo squash-merges,
#              which makes the branch tip NOT an ancestor of main, so an ancestry
#              test alone would never reap anything), or, with no PR, the branch is
#              an ancestor of origin/<default>.
#   clean    — no uncommitted or untracked changes.
#   pushed   — no commits ahead of its upstream (an unpushed worktree is the only
#              copy of the work; see docs/agents/worktrees.md).
#   quiet    — untouched for $QUIET_MINUTES, so a session still working in a
#              just-merged worktree isn't pulled out from under it.
#   not ours — never the worktree this script is running from.
#
# Anything failing a check is reported, never removed. --dry-run reports only.
#
# It also sweeps two kinds of remote ref that exist only for the life of something else: the
# visual-review refs at the bottom of this file, and the `design/#<N>-<screen>` branches that
# carry a screen's explorable page, keyed on the ticket number in the branch name.
#
# --artifacts is the other sweep, and it reaps no worktree at all. It deletes the BUILD
# OUTPUT inside every worktree, at the paths `worktreeGc.artifactPaths` names, which is
# regenerable by definition and is where the disk actually goes: 104 GB of the 106 GB under
# .claude/worktrees on the day #1377 was written, against 9.1 GB of free space on the volume.
# A near-full APFS volume slows every write the compiler makes, so this is a throughput
# sweep as much as a disk one. It applies the quiet check and nothing else: a landed branch
# is not required, because nothing here is the only copy of anything.
#
# Usage: sh hooks/worktree-gc.sh [--dry-run]
#        sh hooks/worktree-gc.sh --artifacts [--dry-run]
set -u

QUIET_MINUTES=30
DRY_RUN=0
ARTIFACTS=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --artifacts) ARTIFACTS=1 ;;
    *)
      echo "worktree-gc: unknown option $arg" >&2
      echo "usage: worktree-gc.sh [--artifacts] [--dry-run]" >&2
      exit 2
      ;;
  esac
done

# A hook can invoke this from any cwd, so the repo is located from the script's own
# path rather than from wherever the caller happens to be standing.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 1
cd "$script_dir" || exit 1

git_common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || {
  echo "worktree-gc: not a git repository" >&2
  exit 1
}
repo_root=$(dirname "$git_common")
here=$(git rev-parse --show-toplevel)

# The build-output paths are the project's, read from hooks.json (`worktreeGc.artifactPaths`,
# glob patterns relative to each worktree). There is no default: a project that has not named
# its build output has none this sweep can find, and reporting "0 swept" for that is the shape
# of a gate that passes because nothing looked.
#
# The file is flattened to one line before the match: a formatter is free to break the array
# across lines, and a line-based read of it then finds nothing and reports a clean zero.
artifact_paths=$(
  tr -d '\n' < "$repo_root/hooks.json" 2>/dev/null \
    | sed -n 's/.*"artifactPaths"[[:space:]]*:[[:space:]]*\[\([^]]*\)\].*/\1/p' \
    | tr -d '"' | tr ',' ' '
)

# --artifacts: the build-output sweep. It runs before anything that talks to the network,
# because it needs neither a fetch nor `gh` — what it deletes is reproducible by running
# the build again, so no signal about a branch could make it safer than it already is.
if [ "$ARTIFACTS" = 1 ]; then
  # No paths, no sweep, and say which. "0 swept" from an unconfigured project reads exactly
  # like a clean one, and a project would keep filling its disk believing the sweep ran.
  if [ -z "${artifact_paths# }" ]; then
    echo "worktree-gc: no artifact paths configured — set worktreeGc.artifactPaths in hooks.json"
    exit 0
  fi

  swept=0
  held=0
  freed_kb=0

  # Kilobytes on disk under $1, or 0 when it is not there. `du -sk` rather than `-sh`:
  # this gets summed, and a human-readable unit cannot be.
  disk_kb() {
    [ -e "$1" ] || { echo 0; return; }
    du -sk "$1" 2>/dev/null | awk '{ print $1 + 0 }'
  }

  for wt in "$repo_root"/.claude/worktrees/*/; do
    [ -d "$wt" ] || continue
    wt=${wt%/}
    name=${wt##*/}

    # The build trees, never the worktree itself.
    #
    # They are collected as positional parameters rather than a space-joined string. This
    # list is the argument to `rm -rf`, and a string would be word-split on its way there —
    # so one worktree with a space in its path would delete two directories neither of which
    # was named (found in review).
    set --
    for pattern in $artifact_paths; do
      for candidate in "$wt"/$pattern; do
        [ -d "$candidate" ] && set -- "$@" "$candidate"
      done
    done
    [ $# -gt 0 ] || continue

    # A build in flight writes into its scratch path constantly, so an artifact touched
    # inside the quiet window is one somebody is still producing. This is the ONLY check,
    # and it is deliberately the conservative one: deleting under a live `swift build`
    # fails it with an error that reads like a compiler bug.
    #
    # It searches the TREE, not the top directory. `-maxdepth 0` stats the root alone, whose
    # mtime moves only when a top-level entry is added or removed — and a compiler forty
    # minutes into a build is rewriting files deep inside a directory structure that has not
    # changed shape since the first minute. That root reads as quiet, and the check that this
    # comment calls the only one would have deleted the tree under it (found in review).
    #
    # `-mmin`, not `-newermt`: both `find`s that turn up on this machine take it, and the
    # relative timestamp form of `-newermt` is rejected by one of them. `-print -quit` stops
    # at the first hit, so the usual answer costs one directory read rather than a walk of
    # three gigabytes. A probe that FAILS counts as live: the reason it failed is unknown,
    # and the destructive branch is not the one to take on unknown.
    live=0
    for target in "$@"; do
      probe=$(find "$target" -mmin "-$QUIET_MINUTES" -print -quit 2>/dev/null) || probe=probe-failed
      [ -n "$probe" ] && live=1
    done
    if [ "$live" = 1 ]; then
      echo "  hold $name — built within the last $QUIET_MINUTES min"
      held=$((held + 1))
      continue
    fi

    kb=0
    for target in "$@"; do
      kb=$((kb + $(disk_kb "$target")))
    done

    if [ "$DRY_RUN" = 1 ]; then
      echo "  sweep $name — $((kb / 1024)) MB of build output (dry run)"
    else
      for target in "$@"; do
        rm -rf "$target"
      done
      echo "  swept $name — $((kb / 1024)) MB"
    fi
    swept=$((swept + 1))
    freed_kb=$((freed_kb + kb))
  done

  echo "worktree-gc: $swept swept, $held held, $((freed_kb / 1024)) MB of build output"
  exit 0
fi

git -C "$repo_root" fetch --prune --quiet origin 2>/dev/null

default_branch=$(git -C "$repo_root" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)
default_branch=${default_branch#origin/}
: "${default_branch:=main}"

has_gh=0
command -v gh >/dev/null 2>&1 && has_gh=1

# The loop must run in this shell (it counts), so the worktree list goes through a
# temp file rather than a pipe.
list=$(mktemp) || exit 1
trap 'rm -f "$list"' EXIT
git -C "$repo_root" worktree list --porcelain > "$list"

# The ticket a design branch expires on, or empty when the name carries none. Both sweeps below
# read the same key off the same shape, and a second copy of this expression is a second place
# for the two halves of one branch to disagree about whether it is reapable.
#
# The `#` is required, not optional: it is what makes the number a ticket. Without it
# `design/2024-refresh` reads as issue #2024 and the sweep force-deletes the only copy of a page
# against an issue that has nothing to do with it.
design_ticket_of() {
  printf '%s\n' "$1" | sed -n 's|^design/#\([0-9][0-9]*\)-.*|\1|p'
}

reaped=0
kept=0

while IFS= read -r line; do
  case "$line" in
    "worktree "*) ;;
    *) continue ;;
  esac
  wt=${line#worktree }

  case "$wt" in
    */.claude/worktrees/*) ;;
    *) continue ;;
  esac
  [ "$wt" = "$here" ] && continue
  [ -d "$wt" ] || continue

  name=${wt##*/}
  branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null) || branch=""
  if [ -z "$branch" ]; then
    echo "  keep $name — detached HEAD"
    kept=$((kept + 1))
    continue
  fi

  if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
    echo "  keep $name — uncommitted changes"
    kept=$((kept + 1))
    continue
  fi

  upstream=$(git -C "$wt" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null) || upstream=""
  if [ -n "$upstream" ] && [ -n "$(git -C "$wt" rev-list "$upstream..HEAD" 2>/dev/null)" ]; then
    echo "  keep $name — unpushed commits on $branch"
    kept=$((kept + 1))
    continue
  fi

  landed=0
  if [ "$has_gh" = 1 ]; then
    state=$(cd "$repo_root" && gh pr view "$branch" --json state --jq .state 2>/dev/null) || state=""
    [ "$state" = "MERGED" ] && landed=1
  fi
  if [ "$landed" = 0 ] && git -C "$repo_root" merge-base --is-ancestor \
    "$branch" "origin/$default_branch" 2>/dev/null; then
    landed=1
  fi
  # A design branch never merges: nothing on it lands on the default branch, so both tests above
  # can only ever answer "no" and the local tree would be kept at every session end, forever. Its
  # expiry is the ticket in its name, the same key the remote sweep reads.
  design_ticket=$(design_ticket_of "$branch")
  if [ "$landed" = 0 ] && [ -n "$design_ticket" ] && [ "$has_gh" = 1 ]; then
    state=$(cd "$repo_root" && gh issue view "$design_ticket" --json state --jq .state 2>/dev/null) || state=""
    [ "$state" = "CLOSED" ] && landed=1
  fi
  if [ "$landed" = 0 ]; then
    echo "  keep $name — $branch not merged into $default_branch"
    kept=$((kept + 1))
    continue
  fi

  # `find -newermt` on the directory itself: a session actively working in it will
  # have touched some file, which bumps the containing directory's mtime.
  if [ -n "$(find "$wt" -maxdepth 0 -newermt "-$QUIET_MINUTES minutes" 2>/dev/null)" ]; then
    echo "  keep $name — touched in the last $QUIET_MINUTES min (session may be live)"
    kept=$((kept + 1))
    continue
  fi

  if [ "$DRY_RUN" = 1 ]; then
    echo "  reap $name — $branch landed (dry run)"
    reaped=$((reaped + 1))
    continue
  fi

  if git -C "$repo_root" worktree remove "$wt" 2>/dev/null; then
    # -D, not -d: a squash-merged branch never reads as merged to git.
    git -C "$repo_root" branch -D "$branch" >/dev/null 2>&1
    echo "  reaped $name — $branch"
    reaped=$((reaped + 1))
  else
    echo "  keep $name — git worktree remove refused"
    kept=$((kept + 1))
  fi
done < "$list"

# Prune stale visual-review refs on the remote. pixel-review publishes screenshots to
# refs/pr-screenshots/<slug> (slug = head branch with / → -), and the CI baselines job to
# refs/visual-baselines/pr-N. Both are ephemeral: once the PR is gone, so is their purpose.
# refs/evidence/* is a third namespace and is deliberately NOT swept: it holds
# screenshots embedded in issue bodies, which must outlive the issue.
# Reap them on the same provably-safe footing as worktrees — but only with gh to say which
# PRs are still open. Without it, or if the query fails, never delete: incomplete info is
# not a reason to reap.
# Delete one ref or branch on the remote, honouring --dry-run. $1 is the full ref or branch
# name, $2 the reason to print. A refused delete is reported, never silent: the worktree loop
# above says "git worktree remove refused" for the same reason, and a sweep that prints nothing
# reads as a sweep that found nothing.
reap_remote() {
  if [ "$DRY_RUN" = 1 ]; then
    echo "  reap $1 — $2 (dry run)"
  elif git -C "$repo_root" push --quiet origin --delete "$1" 2>/dev/null; then
    echo "  reaped $1"
  else
    echo "  keep $1 — the remote refused the delete"
  fi
}

if [ "$has_gh" = 1 ]; then
  # Check each gh query's own exit status, not a pipeline's (a trailing `tr` would mask a
  # failed gh), and prune only when BOTH succeeded — otherwise open_slugs/open_numbers may
  # be empty for lack of data, not lack of open PRs, and we'd reap live refs.
  open_branches=$(cd "$repo_root" && gh pr list --state open --limit 500 \
    --json headRefName --jq '.[].headRefName' 2>/dev/null)
  branches_ok=$?
  open_numbers=$(cd "$repo_root" && gh pr list --state open --limit 500 \
    --json number --jq '.[].number' 2>/dev/null)
  numbers_ok=$?
  if [ "$branches_ok" -eq 0 ] && [ "$numbers_ok" -eq 0 ]; then
    open_slugs=$(printf '%s\n' "$open_branches" | tr '/' '-')
    prune_refs=1
  else
    prune_refs=0
  fi

  # The design branches, each carrying one screen's explorable page. The branch name holds its
  # own key: `design/#<N>-<screen>` names the design ticket, so the sweep reads the number off
  # the name and asks `gh` whether that issue is closed. Nothing on the default branch has to
  # stay in step with the namespace for this to work, and a branch whose name carries no number
  # is never touched.
  #
  # A failed `gh` query means keep: the branch may be the only copy of a page a screen is still
  # being built against, and an unreachable host is not evidence that a ticket closed.
  #
  # One `ls-remote` for the whole namespace: this runs on a session-end hook, where a round
  # trip per branch is a round trip too many.
  design_heads=$(git -C "$repo_root" ls-remote --heads origin 'refs/heads/design/*' 2>/dev/null \
    | sed 's|.*refs/heads/||')

  # A branch name is not a word: split on newlines alone and turn globbing off, or a name
  # holding a space becomes two that match nothing, and one holding `[` is expanded against the
  # working directory. `read -d ''` would be tidier and is a bashism; this file is /bin/sh.
  saved_ifs=$IFS
  IFS='
'
  set -f
  for branch in $design_heads; do
      [ -n "$branch" ] || continue
      ticket=$(design_ticket_of "$branch")
      if [ -z "$ticket" ]; then
        echo "  keep $branch — names no ticket"
        continue
      fi

      state=$(cd "$repo_root" && gh issue view "$ticket" --json state --jq .state 2>/dev/null) || state=""
      if [ "$state" != "CLOSED" ]; then
        echo "  keep $branch — #$ticket is ${state:-unreadable}"
        continue
      fi

      reap_remote "$branch" "#$ticket closed"
  done
  set +f
  IFS=$saved_ifs

  if [ "$prune_refs" = 1 ]; then
    git -C "$repo_root" ls-remote origin 'refs/pr-screenshots/*' 2>/dev/null \
    | while IFS='	' read -r _sha ref; do
        [ -n "$ref" ] || continue
        slug=${ref#refs/pr-screenshots/}
        printf '%s\n' "$open_slugs" | grep -qxF "$slug" && continue
        reap_remote "$ref" "no open PR"
      done
    git -C "$repo_root" ls-remote origin 'refs/visual-baselines/*' 2>/dev/null \
    | while IFS='	' read -r _sha ref; do
        [ -n "$ref" ] || continue
        n=${ref##*/pr-}
        printf '%s\n' "$open_numbers" | grep -qxF "$n" && continue
        reap_remote "$ref" "PR #$n not open"
      done
  fi
fi

git -C "$repo_root" worktree prune

if [ "$reaped" = 0 ] && [ "$kept" = 0 ]; then
  echo "worktree-gc: nothing to do"
else
  echo "worktree-gc: $reaped reaped, $kept kept"
fi
exit 0

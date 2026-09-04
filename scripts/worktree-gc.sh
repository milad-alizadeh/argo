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
#              copy of the work; see the implement skill).
#   quiet    — untouched for $QUIET_MINUTES, so a session still working in a
#              just-merged worktree isn't pulled out from under it.
#   not ours — never the worktree this script is running from.
#
# Anything failing a check is reported, never removed. --dry-run reports only.
#
# --artifacts is the other sweep, and it reaps no worktree at all. It deletes the BUILD
# OUTPUT inside every worktree — `apps/macOS/build` and `Packages/*/.build` — which is
# regenerable by definition and is where the disk actually goes: 104 GB of the 106 GB under
# .claude/worktrees on the day #1377 was written, against 9.1 GB of free space on the volume.
# A near-full APFS volume slows every write the compiler makes, so this is a throughput
# sweep as much as a disk one. It applies the quiet check and nothing else: a landed branch
# is not required, because nothing here is the only copy of anything.
#
# Usage: sh scripts/worktree-gc.sh [--dry-run]
#        sh scripts/worktree-gc.sh --artifacts [--dry-run]
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

# --artifacts: the build-output sweep. It runs before anything that talks to the network,
# because it needs neither a fetch nor `gh` — what it deletes is reproducible by running
# the build again, so no signal about a branch could make it safer than it already is.
if [ "$ARTIFACTS" = 1 ]; then
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

    # The build trees, never the worktree: Xcode's DerivedData for the app target, and one
    # SPM scratch path per package.
    targets=""
    [ -d "$wt/apps/macOS/build" ] && targets="$wt/apps/macOS/build"
    for scratch in "$wt"/apps/macOS/Packages/*/.build; do
      [ -d "$scratch" ] && targets="$targets $scratch"
    done
    [ -n "$targets" ] || continue

    # A build in flight writes into its scratch path constantly, so an artifact touched
    # inside the quiet window is one somebody is still producing. This is the ONLY check,
    # and it is deliberately the conservative one: deleting under a live `swift build`
    # fails it with an error that reads like a compiler bug.
    live=0
    for target in $targets; do
      [ -n "$(find "$target" -maxdepth 0 -newermt "-$QUIET_MINUTES minutes" 2>/dev/null)" ] &&
        live=1
    done
    if [ "$live" = 1 ]; then
      echo "  hold $name — built within the last $QUIET_MINUTES min"
      held=$((held + 1))
      continue
    fi

    kb=0
    for target in $targets; do
      kb=$((kb + $(disk_kb "$target")))
    done

    if [ "$DRY_RUN" = 1 ]; then
      echo "  sweep $name — $((kb / 1024)) MB of build output (dry run)"
    else
      for target in $targets; do
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

  if [ "$prune_refs" = 1 ]; then
    git -C "$repo_root" ls-remote origin 'refs/pr-screenshots/*' 2>/dev/null \
    | while IFS='	' read -r _sha ref; do
        [ -n "$ref" ] || continue
        slug=${ref#refs/pr-screenshots/}
        printf '%s\n' "$open_slugs" | grep -qxF "$slug" && continue
        if [ "$DRY_RUN" = 1 ]; then
          echo "  reap ref $ref — no open PR (dry run)"
        elif git -C "$repo_root" push --quiet origin --delete "$ref" 2>/dev/null; then
          echo "  reaped ref $ref"
        fi
      done
    git -C "$repo_root" ls-remote origin 'refs/visual-baselines/*' 2>/dev/null \
    | while IFS='	' read -r _sha ref; do
        [ -n "$ref" ] || continue
        n=${ref##*/pr-}
        printf '%s\n' "$open_numbers" | grep -qxF "$n" && continue
        if [ "$DRY_RUN" = 1 ]; then
          echo "  reap ref $ref — PR #$n not open (dry run)"
        elif git -C "$repo_root" push --quiet origin --delete "$ref" 2>/dev/null; then
          echo "  reaped ref $ref"
        fi
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

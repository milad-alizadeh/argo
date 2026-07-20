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
# Usage: sh scripts/worktree-gc.sh [--dry-run]
set -u

QUIET_MINUTES=30
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

git_common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || {
  echo "worktree-gc: not a git repository" >&2
  exit 1
}
repo_root=$(dirname "$git_common")
here=$(git rev-parse --show-toplevel)

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

git -C "$repo_root" worktree prune

if [ "$reaped" = 0 ] && [ "$kept" = 0 ]; then
  echo "worktree-gc: nothing to do"
else
  echo "worktree-gc: $reaped reaped, $kept kept"
fi
exit 0

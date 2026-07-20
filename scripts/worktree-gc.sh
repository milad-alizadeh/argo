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

# Prune stale visual-review refs on the remote. visual-verify publishes screenshots to
# refs/pr-screenshots/<slug> (slug = head branch with / → -), and the CI baselines job to
# refs/visual-baselines/pr-N. Both are ephemeral: once the PR is gone, so is their purpose.
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

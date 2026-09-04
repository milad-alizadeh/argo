#!/bin/sh
# Which packages a change reaches. Reads changed paths on stdin, one per line, and prints
# either the word ALL or the affected package names, one per line.
#
# `swift-gate.sh` was all-Swift-or-nothing: any change under the Swift pathspec ran every
# suite in all four test packages, each in its OWN scratch path, each recompiling its whole
# subgraph. Most commits touch one package — 60 of the 60 commits on main the day #1377 was
# written landed under `ArgoUI` alone — so most of that work answered a question nobody asked.
#
# It reads the graph rather than holding a copy of it. Every edge is a `.package(path: "../X")`
# line in a `Package.swift`, so a package added, removed or re-pointed is picked up by the next
# run and there is no second place to edit. A hard-coded list is how a scope gate goes stale
# without anybody's build failing.
#
# It answers ALL, never a guess, whenever it cannot see the whole picture:
#
#   - a changed path outside `apps/macOS/Packages/` — the app target's own sources, the lint
#     and format configs, `scripts/swift-*.sh`, `package.json`, `turbo.json`. Any of those can
#     change what every package compiles to or what every gate checks.
#   - no changed paths at all on stdin, which is the caller not knowing rather than the caller
#     knowing there is nothing.
#
# Usage:  printf '%s\n' "$CHANGED" | sh scripts/swift-scope.sh [packages-dir]
set -eu

PACKAGES_DIR=${1:-apps/macOS/Packages}

changed=$(cat)
if [ -z "$changed" ]; then
  echo ALL
  exit 0
fi

# The direct hits: one package per changed path, and ALL the moment a path is not inside one.
direct=$(printf '%s\n' "$changed" | awk -v dir="$PACKAGES_DIR/" '
  $0 == "" { next }
  index($0, dir) != 1 { print "ALL"; exit }
  {
    rest = substr($0, length(dir) + 1)
    slash = index(rest, "/")
    # A file sitting directly in the packages directory belongs to no package.
    if (slash == 0) { print "ALL"; exit }
    print substr(rest, 1, slash - 1)
  }
' | sort -u)

case "$direct" in
  *ALL*)
    echo ALL
    exit 0
    ;;
esac

# The graph, as "<dependency> <dependent>" pairs. A dependent is affected by a change to
# anything it depends on, so this is the direction the closure below walks.
edges=$(
  for manifest in "$PACKAGES_DIR"/*/Package.swift; do
    [ -f "$manifest" ] || continue
    dependent=$(dirname "$manifest")
    dependent=${dependent##*/}
    # Local path dependencies only. A remote `.package(url:)` is not a package of ours and
    # cannot be changed by a commit in this repo.
    sed -n 's/.*\.package(path: *"\.\.\/\([A-Za-z0-9_]*\)").*/\1/p' "$manifest" |
      while IFS= read -r dependency; do
        [ -n "$dependency" ] && echo "$dependency $dependent"
      done
  done
)

# Transitive closure over the dependents. The graph is five nodes deep at most, so a fixed
# point loop is both the clearest way to write it and fast enough to be free.
affected=$direct
while :; do
  grown=$(
    {
      printf '%s\n' "$affected"
      # The seed set goes through the environment, not `-v`: an assignment there is scanned
      # for escapes, and a newline inside one is a warning on every awk that accepts it at all.
      printf '%s\n' "$edges" | AFFECTED="$affected" awk '
        BEGIN {
          n = split(ENVIRON["AFFECTED"], list, "\n")
          for (i = 1; i <= n; i++) seen[list[i]] = 1
        }
        seen[$1] { print $2 }
      '
    } | sort -u
  )
  [ "$grown" = "$affected" ] && break
  affected=$grown
done

printf '%s\n' "$affected"

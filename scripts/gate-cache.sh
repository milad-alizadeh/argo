#!/bin/sh
# What the gate already knows. Sourced, never executed.
#
# The push gate is keyed to the PUSH, and `ship` rebases before every push. `main` took 91
# commits on the day #1377 was written, so with eight lanes open each merge invalidated seven
# other bases and each of those rebases ran the whole gate again — over a tree whose Swift
# content, most of the time, nobody had touched. Worse, a rebase rewrites the mtime of every
# file it replays and llbuild invalidates on mtime, so the rerun is a COLD one.
#
# So the verdict is keyed to CONTENT instead. A pass records a hash of everything the gate
# reads; a later run over the same hash has nothing left to learn and says so.
#
# What goes in the key, and why each is in it:
#
#   - the tree of `apps/macOS` — every Swift source, and the SwiftFormat and SwiftLint configs;
#   - the tree of `scripts` — the three gate scripts, the boundary rules and the token allow-list;
#   - `package.json` and `turbo.json` — what the gate's own commands resolve to;
#   - the toolchain version — a new Xcode compiles the same source differently, and a verdict
#     from the old one says nothing about it;
#   - the package SCOPE the run covered. Content alone would be unsound: the same tree gated
#     under a narrow scope must not certify a run that ought to be wider.
#
# Two ways it declines to answer, both of which fall back to running the gate in full:
#
#   - a DIRTY tree. HEAD's hash describes what is committed, and the gate at a push runs over
#     exactly that, but by hand it may not — and a key that described the wrong bytes is the
#     one bug a cache of a gate must never have.
#   - anything missing: no git, no `shasum`, no cache directory.
#
# Turn it off for a run with ARGO_GATE_CACHE=off.

# The one place either cache root is spelled. `swift-test.sh` and `build.sh` read
# ARGO_SWIFT_CACHE_DIR from here rather than repeating the expression, so the two cannot drift.
ARGO_CACHE_ROOT=${ARGO_CACHE_ROOT:-${XDG_CACHE_HOME:-$HOME/Library/Caches}}
GATE_CACHE_DIR=${ARGO_GATE_CACHE_DIR:-$ARGO_CACHE_ROOT/argo-gate}
ARGO_SWIFT_CACHE_DIR=${ARGO_SWIFT_CACHE_DIR:-$ARGO_CACHE_ROOT/argo-swift}

# --- one step, keyed by content -------------------------------------------------------------
#
# The gate is not the only thing that runs these commands. An agent finishing a ticket runs the
# suites itself, and then `git push` runs the pre-push gate, which ran them again — the same
# suites over the same bytes, twice, and the second time is the one the person is waiting on.
# So the memory is per STEP as well as per gate: whoever gets there first records the verdict,
# and the other one reads it.
#
# `step_key <name> <path>…` is the whole mechanism. The key covers the step's name, the content
# of each path at HEAD, and the toolchain. It is EMPTY — meaning "no cache this run" — whenever
# the answer could not be honest: the cache is off, any named path is dirty, or `shasum` is
# missing. Empty is never a hit and never recorded, so every one of those falls back to running
# the step.
step_key() {
  [ "${ARGO_GATE_CACHE:-on}" = off ] && return 0
  command -v shasum >/dev/null 2>&1 || return 0

  name=$1
  shift

  # Every path is read from the REPOSITORY ROOT, whatever directory the caller is standing in.
  # `swift-test.sh` runs from `apps/macOS`, where a bare `apps/macOS` pathspec would match
  # nothing at all — and a `git status` that matches nothing reports a clean tree, which is the
  # answer that lets a dirty one be cached. `:(top)` is what anchors it; `HEAD:<path>` is
  # already root-relative.
  #
  # Dirty is judged over the named paths only. A dirty README is no reason to refuse.
  #
  # A tree hash that cannot be read gives up on the key rather than standing a constant in for
  # it: a constant is stable, and a stable key is one a previous broken run could have recorded
  # a pass against.
  hashes=""
  for path in "$@"; do
    dirty=$(git status --porcelain -- ":(top)$path" 2>/dev/null) || return 0
    [ -n "$dirty" ] && return 0
    hash=$(git rev-parse "HEAD:$path" 2>/dev/null) || return 0
    [ -n "$hash" ] || return 0
    hashes="$hashes$hash "
  done

  {
    echo "step:$name"
    echo "$hashes"
    swift --version 2>/dev/null || echo no-swift
  } | shasum -a 256 | cut -d' ' -f1
}

# 0 when this key has already passed. A key of "" is never a hit.
step_cached() {
  [ -n "$1" ] || return 1
  [ -f "$GATE_CACHE_DIR/$1" ]
}

# When it passed, for the message a hit prints.
step_recorded_at() {
  cut -f1 "$GATE_CACHE_DIR/$1" 2>/dev/null || echo unknown
}

# Record a pass for key $1, labelled $2, over the paths $3… — the same paths the key was taken
# over. Failure to write is not failure to gate, so nothing here is fatal.
step_record() {
  key=$1
  label=$2
  shift 2
  [ -n "$key" ] || return 0

  # The key is recomputed and compared, because a step tests the WORKING TREE while the key
  # describes HEAD. Those agree when a step starts — `step_key` refuses a dirty tree — and a
  # run long enough to build Xcode is long enough for somebody to save a file inside it.
  # Recording then would certify a tree nothing gated, which is the one thing a cache in front
  # of a gate must never do.
  [ "$(step_key "$label" "$@")" = "$key" ] || {
    echo "gate-cache: the tree moved while $label ran — recording nothing" >&2
    return 0
  }

  mkdir -p "$GATE_CACHE_DIR" 2>/dev/null || return 0
  printf '%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$label" > "$GATE_CACHE_DIR/$key" 2>/dev/null ||
    return 0
  # Entries are tiny and a stale one is only ever a miss, but a directory nothing sweeps is
  # a directory that grows for the life of the machine.
  find "$GATE_CACHE_DIR" -type f -mtime +30 -delete 2>/dev/null || true
  return 0
}

# --- the whole gate, which is one step with a scope ------------------------------------------

GATE_PATHS='apps/macOS scripts package.json turbo.json'

# Print the key for the current tree under the scope in $1, or nothing when the tree cannot be
# keyed honestly.
gate_cache_key() {
  # shellcheck disable=SC2086 # GATE_PATHS is a list of paths, not one path.
  step_key "gate:$1" $GATE_PATHS
}

gate_cache_hit() {
  step_cached "$1"
}

gate_cache_record() {
  # shellcheck disable=SC2086 # GATE_PATHS is a list of paths, not one path.
  step_record "$1" "gate:$2" $GATE_PATHS
}

gate_cache_read() {
  step_recorded_at "$1"
}

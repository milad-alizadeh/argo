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

GATE_CACHE_DIR=${ARGO_GATE_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/Library/Caches}/argo-gate}

# Print the key for the current tree under the scope in $1, or nothing at all when the tree
# cannot be keyed honestly. Callers treat the empty string as "no cache this run".
gate_cache_key() {
  [ "${ARGO_GATE_CACHE:-on}" = off ] && return 0

  # Only the paths the key covers. A dirty README is no reason to refuse.
  dirty=$(git status --porcelain -- apps/macOS scripts package.json turbo.json 2>/dev/null) ||
    return 0
  [ -n "$dirty" ] && return 0

  command -v shasum >/dev/null 2>&1 || return 0

  {
    git rev-parse 'HEAD:apps/macOS' 2>/dev/null || echo missing-app-tree
    git rev-parse 'HEAD:scripts' 2>/dev/null || echo missing-scripts-tree
    git rev-parse 'HEAD:package.json' 2>/dev/null || echo missing-package-json
    git rev-parse 'HEAD:turbo.json' 2>/dev/null || echo missing-turbo-json
    swift --version 2>/dev/null || echo no-swift
    echo "scope:$1"
  } | shasum -a 256 | cut -d' ' -f1
}

# 0 when this key has already passed the gate. A key of "" is never a hit.
gate_cache_hit() {
  [ -n "$1" ] || return 1
  [ -f "$GATE_CACHE_DIR/$1" ]
}

# Record a pass for key $1, earned under scope $2. Failure to write is not failure to gate, so
# nothing here is fatal.
gate_cache_record() {
  [ -n "$1" ] || return 0

  # The key is recomputed and compared, because the gate tests the WORKING TREE and the key
  # describes HEAD. Those agree at the start of a run — `gate_cache_key` refuses a dirty tree —
  # and a run long enough to build Xcode is long enough for somebody to save a file inside it.
  # Recording then would certify a tree that was never gated, which is the one thing a cache in
  # front of a gate must not do.
  [ "$(gate_cache_key "$2")" = "$1" ] || {
    echo "gate-cache: the tree moved while the gate ran — recording nothing" >&2
    return 0
  }

  mkdir -p "$GATE_CACHE_DIR" 2>/dev/null || return 0
  printf '%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${2:-}" > "$GATE_CACHE_DIR/$1" 2>/dev/null ||
    return 0
  # Entries are tiny and a stale one is only ever a miss, but a directory nothing sweeps is
  # a directory that grows for the life of the machine.
  find "$GATE_CACHE_DIR" -type f -mtime +30 -delete 2>/dev/null || true
  return 0
}

# What a recorded pass says, for the message a hit prints.
gate_cache_read() {
  cut -f1 "$GATE_CACHE_DIR/$1" 2>/dev/null || echo unknown
}

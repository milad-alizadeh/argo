#!/bin/sh
# Module boundaries for apps/macOS — the Swift counterpart of dependency-cruiser, which
# cannot see Swift. Scans the whole tree and ignores any arguments, so lint-staged may
# append staged paths without changing what is checked: a boundary is a property of the
# tree, not of the file you happened to touch.
#
# The edges are ADR-0022's layering, and each is checkable by looking at imports,
# declarations and size alone — which is the whole reason they are gates rather than review notes.
set -eu

APP_DIR="apps/macOS"
UI_SOURCES="$APP_DIR/Packages/ArgoUI/Sources"
ENGINE_SOURCES="$APP_DIR/Packages/ArgoEngine/Sources/ArgoEngine"
APP_TARGET="$APP_DIR/Argo"
# The one file in ArgoUI allowed to read live Hub state: the Hub → cockpit projection.
PROJECTION_FILE="CockpitPresentation+Hub.swift"
PROJECTION="$UI_SOURCES/ArgoUI/Shell/$PROJECTION_FILE"
HUB_SESSION="$ENGINE_SOURCES/Hub/HubSession.swift"

if [ ! -d "$APP_DIR" ]; then
  echo "swift-boundaries: $APP_DIR not found — run from the repo root" >&2
  exit 1
fi

failed=0

report() {
  failed=1
  echo "" >&2
  echo "swift-boundaries: $1" >&2
  shift
  printf '%s\n' "$@" >&2
}

# 1. No view reaches the Hub. ArgoUI may NAME the engine's value types — the presentation
#    IS them, and a second copy of `Head`/`HubConnection` would be two vocabularies for one
#    fact kept in step by hand (#441). What stays banned is live state: the projection that
#    reads a Hub is one file, and a view importing it would be a view taking a store.
# Comment lines are skipped: prose may say what the seam IS, and only code can cross it.
hits=$(grep -rn '\bHub\b' "$UI_SOURCES" --include='*.swift' 2>/dev/null \
  | grep -v "/$PROJECTION_FILE:" \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
if [ -n "$hits" ]; then
  report "a view names the Hub — only $PROJECTION_FILE may read live state (ADR-0005)" "$hits"
fi

# 2. ArgoEngine ⊥ UI frameworks. The engine stays testable from the command line, which it
#    only is while nothing in it needs a window server.
hits=$(grep -rnE '^ *import  *(SwiftUI|AppKit|Cocoa|ArgoUI)' "$ENGINE_SOURCES" 2>/dev/null || true)
if [ -n "$hits" ]; then
  report "ArgoEngine imports a UI framework — it must run under \`swift test\`, with no window (ADR-0022)" "$hits"
fi

# 3. The Xcode target holds the scene and nothing else. Everything with logic in it belongs
#    in a package, where it is testable; a `View` declared here is a view no test can reach.
hits=$(grep -rnE '(struct|class|enum) +[A-Za-z0-9_]+ *: *[^{]*\bView\b' "$APP_TARGET" \
  --include='*.swift' 2>/dev/null || true)
if [ -n "$hits" ]; then
  report "the app target declares a View — views belong in ArgoUI, the target owns only the @main scene (ADR-0022)" "$hits"
fi

# 4. And it stays the scene — the half of edge 3's sentence, "everything with logic in it belongs
#    in a package", that a grep for `View` does not check (#638). Blank and comment lines are not
#    counted, so prose that explains a seam is free.
APP_TARGET_MAX_LINES=600
lines=$(find "$APP_TARGET" -name '*.swift' -exec cat {} + 2>/dev/null \
  | grep -cvE '^[[:space:]]*(//.*)?$' || true)
if [ "$lines" -gt "$APP_TARGET_MAX_LINES" ]; then
  report "the app target is $lines code lines, over its $APP_TARGET_MAX_LINES cap (ADR-0022)" \
    "It holds the @main scene, the coordinators' observable boxes, and the AppKit panels that" \
    "cannot leave it. Everything else is a derivation, and a derivation here is one no test can" \
    "reach: the e2e suite launches onto --specimen, which never builds CockpitView at all." \
    "Move the newest derivation into ArgoEngine or ArgoUI with a test, rather than raising this."
fi

# 5. The projection is TOTAL. The cockpit's `Session` restates `HubSession` rather than holding
#    one (ADR-0027), so every public engine fact must either land in the mapping as
#    `session.<name>` or be listed on a `not-projected:` line beside it. Without this, a new
#    engine fact reaches no surface and nothing says so — the failure mode #572 and #573 each
#    walked into by hand.
hub_facts() {
  grep -hE '^    public ([a-z]+\(set\) )?(var|let) [A-Za-z]' "$HUB_SESSION" \
    | sed -E 's/^.*[[:space:]](var|let)[[:space:]]+([A-Za-z0-9_]+).*/\2/'
  # A member of a `public extension` is public with no keyword of its own to match on.
  grep -hE '^    var [A-Za-z]' "$ENGINE_SOURCES"/Hub/HubSession+*.swift \
    | sed -E 's/^.*[[:space:]]var[[:space:]]+([A-Za-z0-9_]+).*/\1/'
}
not_projected() {
  sed -nE 's/^.*not-projected://p' "$PROJECTION" | tr ' ' '\n' | grep -v '^$' | sort -u
}

facts=$(hub_facts | sort -u)
landed=$({ grep -oE 'session\.[A-Za-z0-9_]+' "$PROJECTION" | cut -d. -f2; not_projected; } | sort -u)
hits=$(printf '%s\n' "$facts" | grep -vxF "$landed" || true)
if [ -n "$hits" ]; then
  report "these HubSession facts reach no cockpit surface and are not listed \`not-projected:\` in $PROJECTION_FILE (ADR-0027)" \
    "$hits" \
    "Map each one in \`init(observed:annotations:)\`, or add it to the \`not-projected:\` list" \
    "above it with the reason it is not rendered."
fi

# The same list, the other way round: an entry naming a fact that no longer exists makes the
# check above pass for a reason that stopped being true.
hits=$(not_projected | grep -vxF "$facts" || true)
if [ -n "$hits" ]; then
  report "\`not-projected:\` in $PROJECTION_FILE names facts HubSession no longer has" "$hits"
fi

if [ "$failed" -eq 1 ]; then
  echo "" >&2
  echo "Move the declaration into the package that may own it, or land the fact where the edge" >&2
  echo "above says it belongs. Never loosen a check here: the layering is what keeps the engine" >&2
  echo "runnable without a window, and the projection honest about what it drops." >&2
  exit 1
fi

echo "swift-boundaries: ok"

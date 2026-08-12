#!/bin/sh
# Module boundaries for apps/macOS — the Swift counterpart of dependency-cruiser, which
# cannot see Swift. Scans the whole tree and ignores any arguments, so lint-staged may
# append staged paths without changing what is checked: a boundary is a property of the
# tree, not of the file you happened to touch.
#
# Edges 1-4 are ADR-0022's layering; edge 5 is ADR-0027, on the projection between two of its
# layers. Each is checkable by looking at imports, declarations and size alone — which is the whole
# reason they are gates rather than review notes.
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
#    `session.<name>` or carry a `not-projected: <name> — <why>` line beside it. Without this, a
#    new engine fact reaches no surface and nothing says so — the failure mode #572 and #573 each
#    walked into by hand. `swift-boundaries.test.mjs` is the proof it stays loud.
# A member of a `public extension` is public whether or not it repeats the keyword, so the two
# contexts are matched by different rules and awk tracks which one it is in.
hub_facts() {
  awk '
    function emit(  i, name) {
      for (i = 1; i <= NF; i++)
        if ($i == "var" || $i == "let") {
          name = $(i + 1); sub(/[^A-Za-z0-9_].*/, "", name); print name; return
        }
    }
    /^public extension HubSession/ { ext = 1; next }
    /^}/ { ext = 0; next }
    ext && /^    (public )?(var|let) [A-Za-z]/ { emit(); next }
    /^    public ([a-z]+\(set\) )?(var|let) [A-Za-z]/ { emit() }
  ' "$ENGINE_SOURCES"/Hub/HubSession*.swift | sort -u
}
# The first name on a marker line; whatever follows it is the reason, which is prose.
not_projected() {
  sed -nE 's/^.*not-projected:[[:space:]]*([A-Za-z0-9_]+).*/\1/p' "$PROJECTION" | sort -u
}
# Comment lines are excluded: prose may NAME a fact, and only the mapping can land one.
mapped() {
  grep -vE '^[[:space:]]*//' "$PROJECTION" | grep -oE 'session\.[A-Za-z0-9_]+' \
    | cut -d. -f2 | sort -u
}

if [ ! -f "$HUB_SESSION" ] || [ ! -f "$PROJECTION" ]; then
  report "edge 5 cannot see its own subjects — HubSession.swift or $PROJECTION_FILE has moved" \
    "Point HUB_SESSION and PROJECTION at their new homes. An edge whose input is missing checks" \
    "nothing, and nothing else in this repo would notice."
else
  facts=$(hub_facts)
  dropped=$(not_projected)
  landed=$(mapped)
  accounted=$(printf '%s\n%s\n' "$landed" "$dropped" | grep -v '^$' | sort -u)

  if [ -z "$facts" ]; then
    report "edge 5 read no public facts off HubSession — the declarations it matches have changed" \
      "Fix \`hub_facts\` in this script. An edge that matches nothing passes everything."
  fi

  hits=$(printf '%s\n' "$facts" | grep -vxF "$accounted" || true)
  if [ -n "$hits" ]; then
    report "these HubSession facts reach no cockpit surface and are not accounted for in $PROJECTION_FILE (ADR-0027)" \
      "$hits" \
      "Map each one in \`init(observed:annotations:)\`, or add a \`not-projected: <name> — <why>\`" \
      "line above it saying why the cockpit does not render it."
  fi

  # The list the other way round: an entry naming a fact that no longer exists makes the check
  # above pass for a reason that stopped being true.
  hits=$(printf '%s\n' "$dropped" | grep -vxF "$facts" || true)
  if [ -n "$hits" ]; then
    report "\`not-projected:\` in $PROJECTION_FILE names facts HubSession no longer has" "$hits"
  fi

  # And a fact cannot be both. Left unchecked, a stale entry would go on covering a fact that has
  # since been landed, and the entry's reason would read as current.
  hits=$(printf '%s\n' "$landed" | grep -xF "$dropped" || true)
  if [ -n "$hits" ]; then
    report "these facts are mapped in $PROJECTION_FILE AND listed \`not-projected:\`" "$hits" \
      "Drop the \`not-projected:\` line: the fact is rendered, so its reason is out of date."
  fi
fi

if [ "$failed" -eq 1 ]; then
  echo "" >&2
  echo "Move the declaration into the package that may own it, or land the fact where the edge" >&2
  echo "above says it belongs. Never loosen a check here: the layering is what keeps the engine" >&2
  echo "runnable without a window, and the projection honest about what it drops." >&2
  exit 1
fi

echo "swift-boundaries: ok"

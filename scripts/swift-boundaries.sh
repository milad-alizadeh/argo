#!/bin/sh
# Module boundaries for apps/macOS — the Swift counterpart of dependency-cruiser, which
# cannot see Swift. Scans the whole tree and ignores any arguments, so lint-staged may
# append staged paths without changing what is checked: a boundary is a property of the
# tree, not of the file you happened to touch.
#
# The three edges are ADR-0022's layering, and each is checkable by looking at imports and
# declarations alone — which is the whole reason they are gates rather than review notes.
set -eu

APP_DIR="apps/macOS"
UI_SOURCES="$APP_DIR/Packages/ArgoUI/Sources"
ENGINE_SOURCES="$APP_DIR/Packages/ArgoEngine/Sources/ArgoEngine"
APP_TARGET="$APP_DIR/Argo"

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

# 1. ArgoUI ⊥ ArgoEngine. Views take the data they render as arguments (Package.swift says
#    so, but SwiftPM only enforces it for targets that DECLARE the dependency — nothing
#    stops a future `import ArgoEngine` from being added alongside a Package.swift edit).
hits=$(grep -rn '^ *import  *ArgoEngine' "$UI_SOURCES" 2>/dev/null || true)
if [ -n "$hits" ]; then
  report "ArgoUI imports ArgoEngine — views take the data they render as arguments (ADR-0022)" "$hits"
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

if [ "$failed" -eq 1 ]; then
  echo "" >&2
  echo "Fix the import, or move the file into the package that may own it. Never loosen this" >&2
  echo "check: the layering is what keeps the engine runnable without a window." >&2
  exit 1
fi

echo "swift-boundaries: ok"

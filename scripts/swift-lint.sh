#!/bin/sh
# SwiftLint over apps/macOS, run from the repo root — by lint-staged on the staged .swift
# files, and with no arguments by `bun run quality:swift` over the whole tree.
#
# It exists because of one SwiftLint behaviour: passing --config turns OFF nested config
# discovery, and the test target's config IS nested (apps/macOS/Packages/ArgoEngine/Tests/
# .swiftlint.yml relaxes two rules for sentence-shaped test names). So the only way to get
# both configs is to run from apps/macOS with paths relative to it, which is what this does.
set -eu

APP_DIR="apps/macOS"

if [ ! -d "$APP_DIR" ]; then
  echo "swift-lint: $APP_DIR not found — run from the repo root" >&2
  exit 1
fi

# shellcheck source=scripts/swift-tool-guard.sh
. "$(dirname "$0")/swift-tool-guard.sh"

if ! command -v swiftlint >/dev/null 2>&1; then
  swift_unavailable "swiftlint not installed" "brew install swiftlint"
fi

# Paths arrive relative to the repo root; SwiftLint must see them relative to APP_DIR.
rel_paths=""
for path in "$@"; do
  case "$path" in
    "$APP_DIR"/*) rel_paths="$rel_paths ${path#"$APP_DIR"/}" ;;
    /*) rel_paths="$rel_paths ${path#"$PWD"/"$APP_DIR"/}" ;;
    *) rel_paths="$rel_paths $path" ;;
  esac
done

cd "$APP_DIR"
# --strict makes every warning an error. The config declares errors already; this catches
# the rules whose severity is not configurable.
# shellcheck disable=SC2086 # word splitting is how the path list is passed
exec swiftlint lint --strict --quiet $rel_paths

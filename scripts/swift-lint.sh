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

# Not every checkout builds the macOS app (CI is Linux, and a TypeScript-only contributor
# has no Swift toolchain). Absent tooling is a skip with a pointer, not a failure —
# except under ARGO_REQUIRE_SWIFT_TOOLS, set by the macOS CI job, where a skip would be a
# green check over an unlinted tree.
if ! command -v swiftlint >/dev/null 2>&1; then
  if [ -n "${ARGO_REQUIRE_SWIFT_TOOLS:-}" ]; then
    echo "swift-lint: swiftlint not installed, and ARGO_REQUIRE_SWIFT_TOOLS is set" >&2
    exit 1
  fi
  echo "swift-lint: swiftlint not installed — skipping (brew install swiftlint)" >&2
  exit 0
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

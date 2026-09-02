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

# SwiftLint with no config to discover lints against its OWN defaults and passes, so a missing
# file would take every cap in it with it and say nothing.
if [ ! -f "$APP_DIR/.swiftlint.yml" ]; then
  echo "swift-lint: no $APP_DIR/.swiftlint.yml — SwiftLint would lint against its defaults" >&2
  echo "and report success having checked none of the house caps." >&2
  exit 1
fi

# `lint` reads `analyzer_rules` and then ignores it: those rules fire under `swiftlint analyze`
# alone. So a rule listed there while nothing in the repo runs `analyze` is a gate that has never
# run on a single file, reading as coverage in the config and enforcing nothing (#1043) — the same
# green-because-nothing-looked shape as a filtered build (#925). Checked before the tool guard, so
# a machine without SwiftLint still fails on it rather than skipping past.
declared=$(find "$APP_DIR" -name '.swiftlint.yml' ! -path '*/.build/*' -exec \
  grep -lE '^[[:space:]]*analyzer_rules:' {} + || true)
if [ -n "$declared" ]; then
  # An INVOCATION lifts the refusal, not a mention: the pattern refuses a line whose first `#` comes
  # before the command, so the comment that would say why nobody runs it cannot stand in for running
  # it. This file is excluded because the message below names the command, and a guard its own
  # wording satisfies is no guard. Every other file under `scripts/` counts whatever its extension,
  # and so does the workflow — all three of the ticket's placements can wire it (#1043).
  runners=$(find scripts .github/workflows -type f ! -name "$(basename "$0")" 2>/dev/null || true)
  # shellcheck disable=SC2086 # the file list is passed by word splitting, and holds no spaces
  if ! grep -qE '^[^#]*swiftlint[[:space:]]+analyze' package.json $runners; then
    echo "swift-lint: analyzer_rules is declared in $declared, and nothing in package.json," >&2
    echo "scripts/ or .github/workflows/ runs 'swiftlint analyze' — 'lint' ignores the key, so" >&2
    echo "those rules enforce nothing on any file. Remove it, or add a gate that runs" >&2
    echo "'swiftlint analyze' (docs/agents/quality-gates.md)." >&2
    exit 1
  fi
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

#!/bin/sh
# Build, launch and screenshot the real Argo window — the render method the visual-verify
# skill resolves to for this app (see AGENTS.md, "Visual verification").
#
# Usage, from apps/macOS:
#   sh scripts/screenshot.sh out/cockpit.png [transcript.jsonl]
#   ARGO_SPECIMEN=feedEveryEventClass sh scripts/screenshot.sh out/feed.png
#   ARGO_KEEP_RUNNING=1 sh scripts/screenshot.sh …  # leave the app up to drive it by hand
#   ARGO_WINDOW_SIZE=680x600 sh scripts/screenshot.sh out/narrow.png
#
# `ARGO_SPECIMEN` names a `Specimen` case and renders that state instead of the cockpit — the
# per-state harness AGENTS.md records as the gap. `sh scripts/specimens.sh <dir>` renders them all.
#
# `ARGO_WINDOW_SIZE` is `<width>x<height>` in points. A layout claim is usually a claim about what
# happens at a particular width, and the default window is only ever one of them — without this,
# the narrow case can be reached only by dragging the window by hand, which is not a render anyone
# can repeat. It resizes through System Events, so it needs Accessibility permission the same way
# the capture below needs Screen Recording.
#
# It captures the WINDOW, not the screen: a full-screen grab carries the desktop and whatever
# else is open into the evidence, and a judge asked whether the pixels match a spec should not
# have to work out which pixels are the app.
#
# macOS asks for Screen Recording permission the first time a terminal runs `screencapture`
# against another process's window. Nothing here can grant it — if the PNG comes out blank or
# shows the desktop, that permission is why.
set -eu

OUT=${1:-out/argo.png}
TRANSCRIPT=${2:-${ARGO_TRANSCRIPT_PATH:-}}
APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
APP="$APP_DIR/build/Build/Products/Debug/Argo.app"
PROJECT_ROOT=$(git -C "$APP_DIR" rev-parse --show-toplevel)

# `open --args` hands the app its own working directory, not this shell's, so a relative transcript
# path resolves somewhere else and the deck renders "Transcript unavailable" with no hint why.
if [ -n "$TRANSCRIPT" ]; then
  case $TRANSCRIPT in
    /*) ;;
    *) TRANSCRIPT=$(cd "$(dirname "$TRANSCRIPT")" && pwd)/$(basename "$TRANSCRIPT") ;;
  esac
fi

cd "$APP_DIR"

# Always build this worktree before launching it. A valid app bundle can be stale, and opening that
# bundle produces a plausible screenshot of yesterday's source with no indication it is stale.
xcodebuild -project Argo.xcodeproj -scheme Argo -configuration Debug \
  -derivedDataPath build build >/dev/null

mkdir -p "$(dirname "$OUT")"

# A running Argo must go first, and this is not housekeeping. `open` on an app whose bundle
# id is already running ACTIVATES that instance instead of launching this build — so with a
# copy left up by another worktree, the capture is of somebody else's tree and looks
# entirely plausible. That is the one failure a screenshot cannot self-report.
if pgrep -x Argo >/dev/null 2>&1; then
  echo "screenshot: an Argo is already running — quitting it so this build is what gets captured"
  osascript -e 'tell application "Argo" to quit' >/dev/null 2>&1 || true
  attempt=0
  while pgrep -x Argo >/dev/null 2>&1 && [ "$attempt" -lt 20 ]; do
    attempt=$((attempt + 1))
    sleep 0.25
  done
fi

set -- --project "$PROJECT_ROOT"
[ -n "$TRANSCRIPT" ] && set -- "$@" --transcript "$TRANSCRIPT"
[ -n "${ARGO_SPECIMEN:-}" ] && set -- "$@" --specimen "$ARGO_SPECIMEN"
open "$APP" --args "$@"

# The window is not on screen the instant `open` returns, and the first frame it does put up
# is unpainted. Poll for the id, then let one more beat pass so the capture is of a settled
# window rather than of a layout mid-flight.
window_id=""
attempt=0
while [ "$attempt" -lt 40 ]; do
  window_id=$(swift scripts/WindowID.swift Argo 2>/dev/null || true)
  [ -n "$window_id" ] && break
  attempt=$((attempt + 1))
  sleep 0.25
done

if [ -z "$window_id" ]; then
  echo "screenshot: Argo put up no window within 10s" >&2
  exit 1
fi

# After the id, so the window exists to be resized; before the settle beat, so what is captured is
# the laid-out result rather than the resize mid-flight.
if [ -n "${ARGO_WINDOW_SIZE:-}" ]; then
  case $ARGO_WINDOW_SIZE in
    *x*) ;;
    *) echo "screenshot: ARGO_WINDOW_SIZE must read <width>x<height>, got $ARGO_WINDOW_SIZE" >&2; exit 1 ;;
  esac
  width=${ARGO_WINDOW_SIZE%x*}
  height=${ARGO_WINDOW_SIZE#*x}
  osascript -e "tell application \"System Events\" to tell process \"Argo\" \
    to set size of front window to {$width, $height}"
fi

sleep 0.5
screencapture -o -x -l"$window_id" "$OUT"

if [ -z "${ARGO_KEEP_RUNNING:-}" ]; then
  osascript -e 'tell application "Argo" to quit' >/dev/null 2>&1 || true
fi

echo "screenshot: $OUT"

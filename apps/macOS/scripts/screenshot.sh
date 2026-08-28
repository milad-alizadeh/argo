#!/bin/sh
# Build, launch and screenshot the real Argo window — the render method the pixel-review
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
# Everything it does is scoped to the pid it launched, so a dev build or another worktree's copy
# can be up at the same time: neither is captured, resized or closed by a render here.
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

# A relative transcript path is resolved here rather than left to the app, so that what the deck
# is asked for does not depend on which directory it happens to be launched from.
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

set -- --project "$PROJECT_ROOT"
[ -n "$TRANSCRIPT" ] && set -- "$@" --transcript "$TRANSCRIPT"
[ -n "${ARGO_SPECIMEN:-}" ] && set -- "$@" --specimen "$ARGO_SPECIMEN"

# The binary, not `open` on the bundle: `open` on a bundle id that is already running ACTIVATES
# that instance instead of launching this build, so it could only be made honest by quitting
# every other Argo first — including the dev build somebody is looking at. A direct launch
# starts this one regardless, and its pid is what everything below addresses, so a copy left
# up by another worktree can neither be captured by mistake nor be closed.
#
# Its output goes to /dev/null, which `open` did too: as a child of this shell it would otherwise
# inherit the caller's stdout, and under ARGO_KEEP_RUNNING an app left up on purpose would hold
# that pipe open — the render finishes and the terminal hangs anyway.
"$APP/Contents/MacOS/Argo" "$@" >/dev/null 2>&1 &
app_pid=$!

# The window is not on screen the instant the process starts, and the first frame it does put
# up is unpainted. Poll for the id, then let one more beat pass so the capture is of a settled
# window rather than of a layout mid-flight.
window_id=""
attempt=0
while [ "$attempt" -lt 40 ]; do
  window_id=$(swift scripts/WindowID.swift "$app_pid" 2>/dev/null || true)
  [ -n "$window_id" ] && break
  attempt=$((attempt + 1))
  sleep 0.25
done

if [ -z "$window_id" ]; then
  echo "screenshot: Argo put up no window within 10s" >&2
  kill "$app_pid" 2>/dev/null || true
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
  # By unix id, not by name: `process "Argo"` would resize whichever copy System Events found.
  osascript -e "tell application \"System Events\" \
    to tell (first process whose unix id is $app_pid) \
    to set size of front window to {$width, $height}"
fi

sleep 0.5
screencapture -o -x -l"$window_id" "$OUT"

if [ -z "${ARGO_KEEP_RUNNING:-}" ]; then
  kill "$app_pid" 2>/dev/null || true
fi

echo "screenshot: $OUT"

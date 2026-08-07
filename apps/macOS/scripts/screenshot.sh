#!/bin/sh
# Build, launch and screenshot the real Argo window — the render method the visual-verify
# skill resolves to for this app (see AGENTS.md, "Visual verification").
#
# Usage, from apps/macOS:
#   sh scripts/screenshot.sh out/cockpit.png        # build if needed, launch, capture, quit
#   ARGO_KEEP_RUNNING=1 sh scripts/screenshot.sh …  # leave the app up to drive it by hand
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
APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
APP="$APP_DIR/build/Build/Products/Debug/Argo.app"

cd "$APP_DIR"

if [ ! -d "$APP" ]; then
  echo "screenshot: no build at $APP — building"
  xcodebuild -project Argo.xcodeproj -scheme Argo -configuration Debug \
    -derivedDataPath build build >/dev/null
fi

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

open "$APP"

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

sleep 0.5
screencapture -o -x -l"$window_id" "$OUT"

if [ -z "${ARGO_KEEP_RUNNING:-}" ]; then
  osascript -e 'tell application "Argo" to quit' >/dev/null 2>&1 || true
fi

echo "screenshot: $OUT"

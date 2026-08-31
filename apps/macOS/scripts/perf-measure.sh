#!/bin/sh
# Runs one named performance scenario end to end and prints its figures.
#
#   sh scripts/perf-measure.sh scroll-long   [out-dir]
#   sh scripts/perf-measure.sh roster-switch [out-dir]
#   sh scripts/perf-measure.sh room-switch   [out-dir]
#
#   ARGO_PERF_APP=…/Argo.app   which bundle to measure (default: this worktree's Release build)
#   ARGO_PERF_TRANSCRIPTS=…    colon-separated real transcripts to stage (default: the three
#                              largest on this machine)
#
# It takes the pointer and the keyboard for its whole length: the driver posts CGEvents at the real
# HID tap, so whoever is at the machine loses it until the run ends. Say so before starting one.
#
# The transcripts are STAGED — copied into the project's session folder with a fresh mtime, so the
# roster opens on them rather than on whatever the machine happened to do today — and removed
# again on exit. Copies rather than links, because a `touch` on a link would restamp the original.
#
# Nothing here measures anything itself. The app does that, under ARGO_FRAME_PROBE=1, and writes a
# summary when this script interrupts it; `perf-report.mjs` joins that with the driver's log.
set -eu

SCENARIO=${1:-scroll-long}
APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
PROJECT_ROOT=$(git -C "$APP_DIR" rev-parse --show-toplevel)
OUT=${2:-$APP_DIR/out/perf/$SCENARIO}
APP=${ARGO_PERF_APP:-$APP_DIR/build/Build/Products/Release/Argo.app}

CLAUDE_SESSIONS=$HOME/.claude/projects/-Users-milad-Developer-argo
DEFAULT_TRANSCRIPTS="$CLAUDE_SESSIONS/e4713cef-c639-4e72-979d-e27709ad3890.jsonl:$CLAUDE_SESSIONS/db543b85-4495-411a-808d-30edd630f041.jsonl:$HOME/.claude/projects/-Users-milad-Developer-argo--claude-worktrees-ticket-421-tool-call-lines/7020cd6b-1b99-456f-93a7-fe5743f0e439.jsonl"
TRANSCRIPTS=${ARGO_PERF_TRANSCRIPTS:-$DEFAULT_TRANSCRIPTS}

mkdir -p "$OUT"
# A previous run's summary would be read as this one's: the wait below is for a file to EXIST.
rm -f "$OUT/frames.json"
# A run killed before its trap fired leaves its copies behind, and every one of them is another
# huge Session in the roster of the next run.
[ -f "$OUT/staged.list" ] && xargs rm -f <"$OUT/staged.list"
STAGE=$CLAUDE_SESSIONS
staged=""

# `|| true` on the kill, because a failure here under `set -e` would abort the function before the
# staged copies were removed — which is how tens of megabytes of them accumulated once already.
cleanup() {
  [ -n "${app_pid:-}" ] && { kill "$app_pid" 2>/dev/null || true; }
  for file in $staged; do rm -f "$file"; done
  rm -f "$OUT/staged.list"
  return 0
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Staged newest-first in the order given, so `rows` index 0 is the first transcript named. The
# roster is ordered by when a Session was last ACTIVE, which is a fact inside the transcript — a
# file mtime moves nothing, which is why this shifts the timestamps rather than touching the file.
index=0
for source in $(echo "$TRANSCRIPTS" | tr ':' ' '); do
  [ -f "$source" ] || { echo "perf-measure: no transcript at $source" >&2; exit 1; }
  target=$(node "$APP_DIR/scripts/perf-stage.mjs" "$source" "$STAGE" "$index")
  staged="$staged $target"
  echo "$target" >>"$OUT/staged.list"
  echo "perf-measure: staged $(basename "$source") as $(basename "$target")"
  index=$((index + 1))
done

ARGO_FRAME_PROBE=1 ARGO_FRAME_PROBE_OUT="$OUT/frames.json" \
  "$APP/Contents/MacOS/Argo" --project "$PROJECT_ROOT" >"$OUT/app.log" 2>&1 &
app_pid=$!

window_id=""
attempt=0
while [ "$attempt" -lt 60 ]; do
  window_id=$(swift "$APP_DIR/scripts/WindowID.swift" "$app_pid" 2>/dev/null || true)
  [ -n "$window_id" ] && break
  attempt=$((attempt + 1))
  sleep 0.25
done
[ -n "$window_id" ] || { echo "perf-measure: Argo put up no window within 15s" >&2; exit 1; }

# The roster is read off disk and the first reading is projected after the window exists. Frames
# from that are the app starting up, not the interaction, and would land in every scenario's tail.
# A staged transcript of tens of megabytes takes most of this; the driver polls for its row anyway.
sleep 20

# The roster as it stood, so a run's numbers can be read against the rows they were taken on.
sh "$APP_DIR/scripts/perf-drive.sh" rows >"$OUT/rows.log"

sh "$APP_DIR/scripts/perf-drive.sh" scenario "$SCENARIO" | tee "$OUT/drive.log"

# SIGINT rather than a quit: the probe answers it by writing the summary and exiting, so the file
# is complete before this script reads it.
kill -INT "$app_pid"
attempt=0
while [ "$attempt" -lt 40 ] && [ ! -s "$OUT/frames.json" ]; do
  attempt=$((attempt + 1))
  sleep 0.25
done
[ -s "$OUT/frames.json" ] || { echo "perf-measure: the probe wrote nothing — was ARGO_FRAME_PROBE honoured?" >&2; exit 1; }

echo ""
echo "scenario $SCENARIO · $(basename "$APP") · $(basename "$(dirname "$APP")")"
node "$APP_DIR/scripts/perf-report.mjs" "$OUT/frames.json" "$OUT/drive.log"

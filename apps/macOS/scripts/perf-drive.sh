#!/bin/sh
# Compiles and runs the driver. It is three Swift files, because the house file ceiling applies to
# these scripts as well and a `swift` shebang cannot see a sibling file.
#
#   sh scripts/perf-drive.sh rows
#   sh scripts/perf-drive.sh scenario scroll-long
set -eu

DIR=$(cd "$(dirname "$0")" && pwd)
BIN=${TMPDIR:-/tmp}/argo-perf-drive

# Rebuilt when either source is newer, so an edit is never run as yesterday's binary.
SOURCES="$DIR/PerfDriveCockpit.swift $DIR/PerfDriveInput.swift $DIR/perf-drive.swift"
stale=0
for source in $SOURCES; do
  [ "$source" -nt "$BIN" ] && stale=1
done
if [ ! -x "$BIN" ] || [ "$stale" -eq 1 ]; then
  # shellcheck disable=SC2086 — the list is ours and holds no spaces.
  swiftc -O -o "$BIN" $SOURCES
fi

exec "$BIN" "$@"

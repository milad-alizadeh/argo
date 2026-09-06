#!/bin/sh
# Build the cockpit with the optimiser on and open THAT build.
#
#   bun run app:release                  # from the monorepo root
#   bun run app:release -- --probe       # with ARGO_FRAME_PROBE=1 on the launched app
#
# Debug is `-Onone` and SwiftUI's debug paths cost many times what the shipped ones do, so a
# hitch measured on a debug build measures code nobody runs (`docs/agents/build-configurations.md`,
# #998). This is the build to reproduce a hang against.
#
# The product lands in `apps/macOS/build/`, which is gitignored, so nothing here can be committed
# by accident.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
PRODUCT=$APP_DIR/build/Build/Products/Release/Argo.app
BINARY=$PRODUCT/Contents/MacOS/Argo

probe=0
for argument in "$@"; do
  case $argument in
    --probe) probe=1 ;;
    *)
      echo "run-release: unknown argument '$argument'; --probe is the only one" >&2
      exit 1
      ;;
  esac
done

# The one build command this repo has, with the configuration it already takes. A second
# `xcodebuild` line here would be a second answer to how the app is built.
ARGO_BUILD_CONFIGURATION=release sh "$APP_DIR/scripts/build.sh"

if [ ! -x "$BINARY" ]; then
  echo "run-release: the build reported success but $PRODUCT is not there" >&2
  exit 1
fi

# `open` on a bundle that is ALREADY running just activates the running copy — so without this
# the script would report success and leave you looking at the build you were replacing. Only a
# copy of this very bundle is ended: an Argo installed somewhere else is somebody's session, and
# this script does not get to close it.
#
# `pgrep -x Argo` answers nothing on this machine while Argo is running (#1568), so the copies are
# read out of `ps`, which reports the pid and the executable path in one command. A process on its
# way out reads `(Argo)` there and is dropped, because that is not the name.
argo_processes() {
  ps -Ao pid=,comm= | awk -v app=Argo '{
    pid = $1
    sub(/^ *[0-9]+ +/, "")
    name = $0
    sub(/^.*\//, "", name)
    if (name == app) printf "%s\t%s\n", pid, $0
  }'
}

argo_processes | while IFS="$(printf '\t')" read -r pid path; do
  case $path in
    "$BINARY")
      echo "run-release: ending the previous run of this build (pid $pid)"
      kill "$pid" 2>/dev/null || true
      ;;
    *)
      echo "run-release: another Argo is running from $path — leaving it alone" >&2
      echo "run-release: quit it yourself if the window that opens is the wrong one" >&2
      ;;
  esac
done

# Give a killed copy the moment it needs to let go of its window before the new one claims one.
# Only copies of this build are waited on: an Argo left alone above is never going to go, and
# waiting for it would spend the whole two seconds every time.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  argo_processes | cut -f2 | grep -qxF "$BINARY" || break
  sleep 0.2
done

if [ "$probe" -eq 1 ]; then
  echo "run-release: opening with ARGO_FRAME_PROBE=1"
  open --env ARGO_FRAME_PROBE=1 -n "$PRODUCT"
else
  open -n "$PRODUCT"
fi

echo "run-release: opened $PRODUCT"
echo "run-release: sample it with \`sh scripts/hang-sample.sh\` from the monorepo root"

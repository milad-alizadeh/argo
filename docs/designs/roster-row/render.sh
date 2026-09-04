#!/bin/sh
# Renders one PNG per state of `cockpit-roster-row.html` into this directory.
#
# The design is HTML, so its renders come from a browser rather than from the app's specimen
# harness — `renders/` is for what the app actually drew, and this is the target it has not been
# built to yet.
#
#   sh docs/designs/roster-row/render.sh
#
# Serves the design over http because a file:// page cannot be screenshotted headless with the
# fonts it asks for.
set -e

here=$(cd "$(dirname "$0")" && pwd)
designs=$(dirname "$here")
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
port=8879

python3 -m http.server "$port" --directory "$designs" >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
sleep 1

# One row per state, and the whole set last. `all` needs the height for ten rows.
for state in running ceiling merged spent ready unknown attention fold empty; do
  "$chrome" --headless --disable-gpu --hide-scrollbars \
    --window-size=352,120 \
    --screenshot="$here/$state.png" \
    "http://localhost:$port/cockpit-roster-row.html?state=$state&bare=1" >/dev/null 2>&1
  echo "$state.png"
done

"$chrome" --headless --disable-gpu --hide-scrollbars \
  --window-size=352,600 \
  --screenshot="$here/all.png" \
  "http://localhost:$port/cockpit-roster-row.html?state=all&bare=1" >/dev/null 2>&1
echo "all.png"

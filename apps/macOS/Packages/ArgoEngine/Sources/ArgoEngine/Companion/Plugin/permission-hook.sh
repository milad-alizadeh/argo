#!/bin/sh
# stdin is the PreToolUse payload; stdout must be Argo's decision. The socket frames on
# newlines, so the payload is collapsed to one line first, and `head` exits on the one
# reply line so the relay is not left waiting for a second that never comes.
#
# nc is fed through a fifo rather than a plain pipe, because nc half-closes the socket
# the moment its stdin ends — and Argo reads a close as this hook dying with a cancelled
# turn (#543). The writer below holds the fifo open for as long as this script lives and
# polls its way out when the script is killed, so the socket closes when the HOOK goes,
# not when the payload does.
#
# Every failure to reach Argo DENIES, and that branch is the point of this script rather
# than a courtesy: the pipeline's status is `head`'s, so a `nc` that cannot dial exits 0
# with empty output, and the CLI reads a hook that said nothing as a hook with no opinion —
# it runs the call. A gate that fails open is worse than no gate, because the cockpit is
# still showing one.
payload=$(tr '\n' ' ')
hold=$(mktemp -d) || exit 1
trap 'kill "$holder" 2>/dev/null; wait "$holder" 2>/dev/null; rm -rf "$hold"' EXIT
mkfifo "$hold/line" || exit 1
{
  printf '%s\n' "$payload"
  while kill -0 $$ 2>/dev/null; do sleep 1; done
} > "$hold/line" &
holder=$!
decision=$(/usr/bin/nc -U "__ARGO_PERMISSION_SOCKET__" < "$hold/line" | head -n 1)

if [ -z "$decision" ]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Argo could not be reached to ask"}}'
else
  printf '%s\n' "$decision"
fi

#!/bin/sh
# stdin is the PreToolUse payload; stdout must be Argo's decision. The socket frames on
# newlines, so the payload is collapsed to one line first, and `head` exits on the one
# reply line so the relay is not left waiting for a second that never comes.
#
# Every failure to reach Argo DENIES, and that branch is the point of this script rather
# than a courtesy: the pipeline's status is `head`'s, so a `nc` that cannot dial exits 0
# with empty output, and the CLI reads a hook that said nothing as a hook with no opinion —
# it runs the call. A gate that fails open is worse than no gate, because the cockpit is
# still showing one.
decision=$({ tr '\n' ' '; echo; } | /usr/bin/nc -U "__ARGO_PERMISSION_SOCKET__" | head -n 1)

if [ -z "$decision" ]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Argo could not be reached to ask"}}'
else
  printf '%s\n' "$decision"
fi

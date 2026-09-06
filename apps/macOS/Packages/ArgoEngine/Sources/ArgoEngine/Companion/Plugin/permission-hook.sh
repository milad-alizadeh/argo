#!/bin/sh
# stdin is the PreToolUse payload; stdout must be Argo's decision. The socket frames on
# newlines, so the payload is collapsed to one line first.
#
# Argo answers in at most two lines. A call it decides on the spot — the top rung, a standing
# allow, a payload it could not read — is answered in ONE, and that line is the decision. A call
# that becomes a prompt somebody has to answer is acknowledged first, in a line that says the
# gate is HOLDING it, and the decision follows whenever a person gives one (#1553).
#
# That acknowledgement is what bounds the wait. Before it, this hook blocked on `nc` with no
# clock of its own, so a request lost between the dial and the gate's own pile left the Session
# waiting on a decision nobody could see — for hours, and with nothing on screen to answer. Now
# the wait a person owns only begins once Argo has said it has the question; until then this hook
# waits __ARGO_GATE_ACK_SECONDS__ seconds and then denies.
#
# nc is fed through a fifo rather than a plain pipe, because nc half-closes the socket
# the moment its stdin ends — and Argo reads a close as this hook dying with a cancelled
# turn (#543). The writer below holds the fifo open for as long as this script lives and
# polls its way out when the script is killed, so the socket closes when the HOOK goes,
# not when the payload does.
#
# EVERY way out of this script prints one whole JSON object, and that is the point rather than a
# courtesy: the CLI reads a hook that said nothing — or said something it cannot parse — as a hook
# with no opinion, and it runs the call. A gate that fails open is worse than no gate, because the
# cockpit is still showing one. So nothing here is printed unless it arrived as a COMPLETE line,
# every failure to reach Argo denies, and so does every failure of this script's own plumbing.

# The one thing this script says when Argo did not say it. Its own function because there are four
# ways to reach it, and a `printf` pasted four times is four chances to paste a broken object.
deny() {
  printf '%s\n' "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"$1\"}}"
}

payload=$(tr '\n' ' ')
hold=$(mktemp -d) || {
  deny "Argo's permission hook could not open a place to work"
  exit 1
}
trap 'kill "$holder" "$dialler" 2>/dev/null; rm -rf "$hold"' EXIT
mkfifo "$hold/line" || {
  deny "Argo's permission hook could not open its relay"
  exit 1
}
: > "$hold/said"
{
  printf '%s\n' "$payload"
  while kill -0 $$ 2>/dev/null; do sleep 1; done
} > "$hold/line" &
holder=$!
/usr/bin/nc -U "__ARGO_PERMISSION_SOCKET__" < "$hold/line" > "$hold/said" &
dialler=$!

# What Argo has said so far, counted in NEWLINES rather than in records: a line still arriving is
# not a line yet. Nothing below reads a line this has not counted — `sed` prints a final line that
# has no newline, and half a decision handed to the CLI is JSON it cannot read, which it takes as
# a hook with no opinion and runs the call on.
lines() {
  tr -cd '\n' < "$hold/said" | wc -c | tr -d ' '
}

# Five looks a second rather than one. The fast paths are answered in microseconds, and a whole
# second of sleep before the first look would put that second on every gated call an agent makes.
ack_polls=$((__ARGO_GATE_ACK_SECONDS__ * 5))

# The bounded half. It ends on the first whole thing Argo says, on the dial being refused, or on
# the clock — and the clock ending it is a denial, because a gate that has said nothing in this
# long is one no person is being shown the question by.
waited=0
while [ "$(lines)" -lt 1 ]; do
  kill -0 "$dialler" 2>/dev/null || break
  [ "$waited" -ge "$ack_polls" ] && break
  sleep 0.2
  waited=$((waited + 1))
done

decision=
if [ "$(lines)" -lt 1 ]; then
  # Argo said nothing whole. Which of the two that was is told from the clock rather than from the
  # socket: a dial nothing answered and a dial answered by a gate that then said nothing are
  # different facts about Argo, and the CLI's own record of the refused call is where somebody
  # reads which one it was.
  if [ "$waited" -ge "$ack_polls" ]; then
    reason="Argo was reached but never took this request to ask"
  else
    reason="Argo could not be reached to ask"
  fi
elif [ "$(sed -n '1p' "$hold/said")" = "__ARGO_GATE_HELD__" ]; then
  # The unbounded half, and the only wait in this script with no clock of its own: Argo is holding
  # the request, so how long a person takes to answer is their business. `hooks.json` sets the
  # outer `timeout` that ends even this one.
  while [ "$(lines)" -lt 2 ]; do
    kill -0 "$dialler" 2>/dev/null || break
    sleep 1
  done
  if [ "$(lines)" -ge 2 ]; then
    decision=$(sed -n '2p' "$hold/said")
  fi
  reason="Argo was holding this request but never answered it"
else
  # One whole line that is not the acknowledgement: a call the gate decided on the spot.
  decision=$(sed -n '1p' "$hold/said")
  reason="Argo could not be reached to ask"
fi

if [ -z "$decision" ]; then
  deny "$reason"
else
  printf '%s\n' "$decision"
fi

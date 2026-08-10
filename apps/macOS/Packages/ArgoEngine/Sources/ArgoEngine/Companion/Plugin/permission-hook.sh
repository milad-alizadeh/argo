#!/bin/sh
# stdin is the PreToolUse payload; stdout must be Argo's decision. The socket frames on
# newlines, so the payload is collapsed to one line first, and `head` exits on the one
# reply line so the relay is not left waiting for a second that never comes.
{ tr '\n' ' '; echo; } | /usr/bin/nc -U "__ARGO_PERMISSION_SOCKET__" | head -n 1

# Sourced by the three Swift entrypoints, never run. One definition of the one decision they
# share: what to do when Swift cannot run here.
#
# Absent tooling is a skip, because the Linux CI jobs and a TypeScript-only contributor both
# hit it legitimately. ARGO_REQUIRE_SWIFT_TOOLS reverses that for the macOS CI job, where the
# whole point is to run these and a skip would report Success having checked nothing.

# swift_unavailable <what is missing> <how to get it>
swift_unavailable() {
  # Parameter expansion, not `basename`: a caller may be running on a PATH deliberately
  # stripped of the tool it is testing for, and that PATH has no coreutils either.
  _swift_tool_name=${0##*/}
  _swift_tool_name=${_swift_tool_name%.sh}
  if [ -n "${ARGO_REQUIRE_SWIFT_TOOLS:-}" ]; then
    echo "$_swift_tool_name: $1, and ARGO_REQUIRE_SWIFT_TOOLS is set" >&2
    exit 1
  fi
  echo "$_swift_tool_name: $1 — skipping ($2)" >&2
  exit 0
}

# Sourced by the Swift entrypoints, never run. One definition of the decisions they share: what
# to do when Swift cannot run here, and which packages "all of them" means.

# The packages with a test target, in dependency order — ArgoDesign first because the other four
# build against it, ArgoUI last because it builds against all of them. `swift-test.sh` runs the
# four that HAVE tests; `warm-build.sh` warms all five, since warming a dependency is most of the
# cost of warming its dependents. Held here rather than in each script: the two lists were written
# a day apart and had already drifted into two different orders.
ARGO_TEST_PACKAGES='ArgoEngine ArgoUI ArgoMermaid ArgoAtlas'
ARGO_BUILD_PACKAGES='ArgoDesign ArgoEngine ArgoMermaid ArgoAtlas ArgoUI'
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

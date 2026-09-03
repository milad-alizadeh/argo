# The gate in every context that runs it

A gate that passes in one context and fails in another teaches the team to bypass it. Run the
wired command in the local shell, the pre-commit hook and CI, and reconcile every difference
before finishing. Each item below is a way the three have disagreed.

- **CI pins a toolchain from a file.** A `go-version-file: go.mod` run gets what `go.mod`
  declares; a command using a flag introduced later dies with a usage error before one file
  is linted. Make the pin and the minimum version of every wired flag agree explicitly.
- **Hosted CI unreachable from the install session?** Run the workflow's steps in order on the
  toolchain the pin resolves, and report it as emulation, never as a CI run.
- **A hook running from the repo root does not load per-workspace state.** Piping staged paths
  to a root-level linter skips each workspace's baseline, so the hook rejects exactly the
  debt `quality` and CI accept. Run the linter per workspace.
- **A workspace with no config of its own falls through to the root config**, whose patterns
  anchor at the root, so a block scoped `files: ["src/**"]` matches nothing there. Enumerate
  coverage per workspace.
- **A vendored tool bootstrapped by file existence runs whatever binary is there.** Have the
  gate execute `<tool> --version` against the pinned constant and re-fetch on mismatch, and
  prove it with a deliberately wrong binary. This is a staleness guard, not an integrity
  guard; a stub that echoes the pinned version still passes.
- **Enumerate on a built tree.** Generated output exists in CI because the build runs right
  before the gate; build first, run the gate, then ignore the generated trees by path.
- **The exit code must reflect every configured rule.** A shareable base config brings its
  own severities; without `--max-warnings 0` or its equivalent, every `warn` can never fail
  the run. Print the effective config, count the warns, raise them or pass the flag.
- **Capture the exit code at the command**, under `pipefail` where a pipe is unavoidable; a
  wrapper's or a pipe's status proves the wrapper.
- **Call the linter directly at `.` with ignores**, not through a framework wrapper with its
  own default inputs and not on a path list that goes dark the day a directory is added.
  Where a tool forces an enumerated scope, name that scope in the project doc's note.
- **Then check coverage by enumeration**: have the gate list the files it read, per
  workspace, and diff against what `rules/` claims. Conditional-compilation variants
  (`.web.tsx`, `GOOS` suffixes), nested workspaces and a pre-existing include list are the
  usual gaps; narrow the claim to match what the gate reaches.

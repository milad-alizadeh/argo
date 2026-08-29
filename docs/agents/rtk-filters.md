# RTK filters

`rtk` filters command output before it reaches agent context. This repo's own filters live in
`.rtk/filters.toml`; `AGENTS.md` "Tooling (RTK)" carries the one rule a session needs, and the
mechanics are here.

## The file is read from the working directory only

rtk looks for `./.rtk/filters.toml`. It does not walk up — not to a parent, not to the git root.
So a command run from `apps/macOS/Packages/ArgoUI` sees nothing at the repo root, and rtk falls
back to its own generic proxy, which prints the head of the output and truncates the rest to a
tee file. That is how #925 happened: a cold build reaches the file that broke long after the
head, so the compiler diagnostics were exactly the part thrown away.

`apps/macOS` and both `Packages/*` therefore carry a `.rtk` symlink back to the root file.
**Add one wherever a new run location appears.** Trust keys on the resolved path, so a symlink
inherits the root file's trust while a copy would need its own.

## Trust, and why it is silent

The filters are inert until trusted: **run `rtk trust --yes` at the repo root once per checkout,
and again after any edit** — trust keys on the file's hash. An untrusted directory prints no
warning of any kind, so a stale trust looks exactly like a working one. This repo creates a
worktree per ticket and each is a distinct path, so `docs/agents/worktrees.md` makes the trust
step part of entering one.

`~/.config/rtk/filters.toml` is a *user-global* file that applies in every directory, and on at
least one machine it holds an older divergent copy of these same filters. A run from an
untrusted or unsymlinked directory is therefore not unfiltered — it is filtered by that stale
copy, which is worse. Keep the two in step or delete the global one.

## No filter here truncates from the head

`max_lines` cuts from the head. A cold ArgoUI build emits 450 compiler diagnostic lines, so any
cap small enough to be worth having is small enough to cut a trailing `error:` off the end —
which is #925 again, one layer up. Every filter here uses **`tail_lines = 500`** instead. The
tail is where a build puts its verdict: the driver's own `error: … command failed` line is always
last. Over the cap, rtk prepends `... (N lines omitted)`, so nothing is dropped silently.

500 is above the 451 diagnostic lines a cold ArgoUI build really emits, so an honest run loses
nothing; it bounds the cascade a conflict marker in a Swift file produces, which is 3,600 lines.
Raise it if the tree's own diagnostic count ever approaches it — and prefer clearing the warnings,
because the 450 lines are only four distinct warnings repeated, and rtk's TOML filters cannot
deduplicate.

`on_empty` for the same reason never says "ok": a failing run whose every line was stripped would
otherwise be reported as a success.

Each filter that can see a build carries an inline fixture longer than any cap it could meet, with
the diagnostic last, and `rtk verify` runs them. Those fixtures are long and repetitive on
purpose: a fixture that fits inside a cap cannot prove anything about a cap, which is why the
small ones the file used to carry passed throughout #925.

## Upstream

Both faults behind #925 are rtk's, not ours, and are worth reporting: the working-directory-only
lookup, and a generic proxy that truncates a build log from the head so the failure is the part
discarded.

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
which is #925 again, one layer up. Every filter here uses **`tail_lines = 500`** instead: rtk
strips first, then keeps the last 500 of what survives, and prepends `... (N lines omitted)`, so
nothing is dropped silently. The end is the right half to keep because that is where a build's
diagnostics land — the failing target is compiled last, and the driver's `error: … command
failed` line comes after everything.

`on_empty` for the same reason never says "ok": a failing run whose every line was stripped would
otherwise be reported as a success. It names the tee log instead.

### What tail-truncation gets wrong

It inverts when the root cause comes **first** and a long cascade follows: one real error, six
hundred consequences, driver line last — the tail holds the cascade and the root cause is in the
omitted part. Two things make this much weaker than the bug it replaces. SwiftPM stops after the
failing target, so a cascade cannot spread across modules; and in the real conflict-marker build
the root error repeats 356 times inside the kept tail. It is also recoverable: the marker says
how many lines went, and the tee log path is printed under them. Head-truncation offered neither.

### The cap and the warning debt are coupled

500 is above the 451 diagnostic lines a cold ArgoUI build really emits, so an honest run loses
nothing — but the margin is **49 lines**. The volume is bounded, not dissolved: those 451 lines
are four distinct warnings repeated, and rtk's TOML filters have no dedupe primitive, so nothing
at this layer can collapse them. **#933** tracks clearing that debt. Until it lands, a batch of
new warnings pushes an honest build over the cap, and the fix is #933 rather than a bigger number
here.

### Fixtures

Each filter that can see a build carries an inline fixture longer than the cap, with the
diagnostic last, asserting both the omission marker and the kept tail. `rtk verify` runs them.
They are long and repetitive on purpose: a fixture that fits inside a cap cannot prove anything
about a cap, which is why the small ones the file used to carry passed throughout #925.

A duplicate key is worth knowing about too — two `on_empty` lines in one filter made rtk drop
that filter's whole test block with no error, and `rtk verify` still reported a pass. Check the
test count moved when you add cases.

## Upstream

Both faults behind #925 are rtk's, not ours, and are worth reporting: the working-directory-only
lookup, and a generic proxy that truncates a build log from the head so the failure is the part
discarded.

# 0025 · Mode is a four-rung boundary ladder

Status: accepted · 2026-08-11

Supersedes the `Ask | Plan | Code` triplet in the Autonomy cluster (`docs/domain/autonomy-cluster.md`)
and its rationale entry. Binding on #545 and on `ComposerMode`.

## Context

Mode was `Ask | Plan | Code` — Ask gates every action, Plan reads and proposes, Code acts within
permissions. That is one dial laid across two independent axes. `Ask` and `Code` are the endpoints
of *how often you are asked*; `Plan` is a point on *what may be touched*. Nothing sits between
gating everything and acting freely, which is where most real sessions run.

Checked against what the CLIs actually ship, six surfaces separate at least two of three axes —
capability (what tools exist at all), approval policy (how often it stops), and sandbox (how far a
non-asking action reaches):

- **Claude Code** — `default` (labelled Manual) · `acceptEdits` · `plan` · `auto` · `dontAsk` ·
  `bypassPermissions`, one enum on `--permission-mode`, with `allow`/`ask`/`deny` rules layered on
  top and applying in every mode.
- **Codex** — `approval_policy` (`untrusted` · `on-request` · `never` · granular) crossed with
  `sandbox_mode` (`read-only` · `workspace-write` · `danger-full-access`), sold as three presets.
- **Gemini CLI** — `--approval-mode` = `default` · `auto_edit` · `plan` · `yolo`.
- **Cursor** — chat modes (Ask · Plan · Agent) and Run Modes (Auto-review · Allowlist · Run
  Everything) are separate controls, with sandboxing a third layer.
- **Zed** — profiles (Write · Ask · Minimal) are tool allowlists; Tool Permissions is the separate
  allow/deny/confirm setting.
- **VS Code Copilot** — Default Approvals · Assisted Permissions · Bypass Approvals · Autopilot,
  with per-tool approval scopes beside them.

**Codex decides the shape.** Its `Read Only` and `Auto` presets carry the *same* `approval_policy`
(`on-request`); only `sandbox_mode` differs. So a Codex rung says how far a non-asking action
reaches, and asking is simply what happens at the edge of it. Claude cuts the same space the other
way, splitting `default` from `acceptEdits` at one boundary by prompt count.

Argo does not only set Mode — it renders Mode for Sessions it observes, at DIRECT for managed. A
three-value enum cannot project a six-value one, so a `claude` sitting in `acceptEdits` had no true
value at all. That is a lossy projection in exactly the place the honesty tiers exist to protect.

Separately, `Ask` named the wrong thing. In Cursor, Zed and Copilot `Ask` *is* the read-only chat
mode — Argo's `Plan`, not Argo's `Ask`. Claude Code hit the same collision and renamed `default` to
**Manual** across every UI surface while keeping `default` as the config value.

## Decision

**Mode is a four-rung ladder, and each rung is a boundary rather than a prompt frequency.** Inside
a rung the agent acts; at its edge Permission fires.

| Rung | Boundary | `claude` | `codex` |
|---|---|---|---|
| **Read Only** | no writes are possible | `plan` | `read-only` |
| **Plan** | Read Only, plus a plan to hand off | `plan` + `ExitPlanMode` | `/plan` |
| **Code** | writes and runs inside the Workspace, asks to leave it | `acceptEdits` | Auto preset |
| **Auto** | no boundary, asks nothing | `auto` | Full Access |

The `claude` column was read from
[the permission-modes reference](https://code.claude.com/docs/en/permission-modes) and then
exercised against a live CLI — see **Verification** below, which corrected two things the
reference alone did not give. The `codex` column is read from
[Codex's approvals doc](https://learn.chatgpt.com/docs/agent-approvals-security) and stays paper
only, for the reason #535 already gives.

The boundary reading is taken because it is the one **both** CLIs can express. A frequency ladder
has rungs Codex cannot reach: it substitutes a sandbox for asking, where Claude substitutes asking
for a sandbox.

**Read Only and Plan share a boundary and differ by intent.** Plan carries a deliverable and a
hand-off gesture, which is what both CLIs implement — `ExitPlanMode` and `/plan` each end by
handing an approved plan to an execution phase. This is the ladder's one shared-boundary pair and
it is deliberate, not the superseded conflation returning.

**Setting Plan and observing it are different.** Argo can *set* Plan, because it issued the mode
and knows the intent. It cannot *read* Plan back: `claude` reports `plan` either way, so an
observed `plan` renders **`Read Only`**, which is the part of it that is true. Plan appears on an
observed Session only where Argo set it.

**A CLI value with no exact rung renders as the nearest rung marked `≈`**, with the CLI's own value
stated verbatim on hover. **Nearest is judged by what the Session can do without further user
input**, because Mode is a *standing* stance — what it does while nobody is answering prompts:

- `claude` `default` → **`Read Only ≈`**. Unattended it reads and nothing else; the writes it can
  reach need a human to approve each one, so they are not part of its standing stance.
- `claude` `bypassPermissions` → `Auto ≈`.
- `claude` `dontAsk` → **`unknown`**, not a rung. Its boundary is a pre-approved allowlist Argo
  cannot see, and everything outside that list fails rather than asking. Two sessions in `dontAsk`
  can sit at opposite ends of the ladder, so any rung would be a guess.

The mark is approximation, not a tier. The tier stays **DIRECT**, because Argo knows the fact
exactly and only its vocabulary is coarser. Degrading a knowable value to `unknown` would discard
something plainly observed, which is the opposite failure from the one degrade-down prevents —
`dontAsk` is `unknown` for the ordinary reason instead, that the fact itself is not established.

`unknown` also survives for its own case: a stance Argo cannot establish at all.

## Verification

Verified against `claude` 2.1.227 on 2026-08-11, by driving a real TUI in a PTY and reading both
its footer and the transcripts it wrote. Codex is not verified and #535's finding stands: no Codex
approval round trip could be observed at all, so its column must not be cited as evidence the
adapter works.

- **`--permission-mode` accepts `acceptEdits · auto · bypassPermissions · manual · dontAsk ·
  plan`.** The flag spells the manual rung **`manual`**; the transcript still writes **`default`**.
  Both have to read as the same rung, because a reader sees the transcript and a writer sees the
  flag.
- **`shift+tab` cycles a four-value ring**, `auto → manual → acceptEdits → plan → auto`. It is the
  TUI's `chat:cycleMode`, and no command sets a named rung. `bypassPermissions` and `dontAsk` are
  not on the ring, so a Session already in one of them cannot be moved by cycling and Argo refuses
  rather than guessing a distance.
- **The stance reads back off `{"type":"permission-mode","permissionMode":…}`**, written at every
  Turn boundary and after a change. Latest wins. Writes coalesce at boundaries, so an intermediate
  cycle can be missing from the record.
- **`{"type":"mode","mode":"normal"}` sits beside it and is a different axis.** Never read it as
  the stance.
- **`--permission-mode acceptEdits` was honoured end to end**: the footer read `accept edits` and
  the transcript wrote `acceptEdits`. It was the only rung driven the whole way at the time; the
  section below drives the rest.
- **Nothing is written until the first prompt**, so a fresh spawn's rung is DIRECT from Argo's own
  record alone.

## Verification · all four rungs, 2.1.228, 2026-08-12 (#629)

Every rung is now driven by a **test** rather than by hand — `LiveModeTests`, on the live fixture
the permission suite already uses: a real PTY, a real Hub, a temp Project, folder trust handled.
Each claim is made against the CLI's own record or against the filesystem, never against the
argument Argo sent, because an adapter that agrees with itself proves nothing.

| Rung | Flag | What the live run established |
|---|---|---|
| **Auto** | `auto` | Spawned on it, the transcript reports `auto`; a gated `Bash` call runs, the file appears, and **no Permission is ever raised**. This is #629's reported bug and the test that closes it. |
| **Code** | `acceptEdits` | Spawned on it, a gated `Bash` call still raises a Permission — the rung accepts edits, not commands. Unchanged from 2.1.227. |
| **Read Only** | `plan` | Spawned on it, the agent does not write and the file it was asked for is never created. |
| **Plan** | `plan` | The same value and the same observed behaviour as Read Only. Its intent is unobservable by construction, which is what this ADR already says. |

So the `≈` rules stand against values the CLI still accepts: `manual` and `default` both read as
`Read Only ≈`, `bypassPermissions` as `Auto ≈`, and `dontAsk` as `unknown`. Nothing in the
2.1.227 → 2.1.228 step moved any of them.

**`--permission-mode` is honoured for every rung. `shift+tab` no longer moves a running Session.**
Driven twice on 2.1.228, a Session set from `Code` to `Auto` while idle stayed on `acceptEdits`:
the next gated call raised a Permission and the file was never written. The keystroke Argo sends
is unchanged and 2.1.227 accepted it, so this is a change in the CLI rather than in Argo.

**Argo degrades rather than pretends, and the mechanism is #653's to find.** The rung is still
asked for — it costs nothing and it worked one version ago. When the record contradicts it the
reading snaps back to the rung the CLI reports and the composer says which rung did not take. The
live test asserts that degrade and marks the change itself a known issue, so the day a
mid-Session change lands again the suite says so rather than quietly starting to pass.

**A set outranks the record until a record is written AFTER it — counted, not compared.** The
earlier rule compared the CLI value seen when the rung was set, which cannot tell a record that
has not caught up from one that has spoken and repeated the old value. That is precisely the case
a CLI ignoring the change produces, so Argo went on drawing a rung nobody was standing on. Counting
the Session's stance records makes silence and disagreement two different facts, which is what
lets the snap-back exist at all.

**A rung cannot be changed while a Turn is in flight.** The ring is walked, not written, so a
change passes through rungs nobody asked for — `Auto` among them. Idle, that transit is nothing.
Mid-Turn it is a widened boundary while a tool call is running, so the port refuses instead
(`SessionDriveError.modeBusy`). It is a rule this ADR did not have and the build needed, and it is
the ladder's own rule read at the one moment the transit is observable.

**A rung Argo set outranks the record until the record moves.** `claude` writes its stance at Turn
boundaries, so the last record can predate the last change. A set is Argo's own act and therefore
DIRECT; it is kept with how many stance records the Session had written when it was made, and the
moment one is written after that the record is what is true. Without it a second change would count
its distance from a stale rung and walk too far — landing the Session somewhere nobody asked for,
which is the same failure `modeBusy` prevents.

*(Amended by #629: the set was originally kept with the record's VALUE. See the 2.1.228
verification above for why counting is the only version of this rule that can notice a change the
CLI ignored.)*

## Consequences

- **The middle rung is now a value the user picks and reads.** #545's acceptance criterion "a
  baseline stance exists so ungated tools do not pay a Permission round trip" was `acceptEdits`
  arriving as a hidden implementation detail. It is the `Code` rung, by name.
- **`bypassPermissions` gets no rung of its own.** It renders as `Auto ≈` and Argo does not offer
  it as a choice. A cockpit that can hand out unrestricted filesystem access in one segment of a
  segmented picker is a foot-gun; a user who wants it can still start the CLI that way, and Argo
  will read it back honestly.
- **`ModePicker` stops being a segmented control.** Four rungs of segments were rendered at 760pt
  and pushed the run facts off the footer, which decision 2 of the composer design does not allow.
  It is a `.menu` picker now. That also ends the ink rule and rules out per-row captions: macOS
  draws a menu picker through `NSPopUpButton`, which ignores `.tint` and `.foregroundStyle`, and
  whose rows take a title and nothing else. All three were tried against the real control. So a
  rung is a word on the footer and its boundary is on hover. Giving `Auto` its loudness back needs
  a bespoke label and is deferred, not faked.
- **Codex's mapping is on paper only.** Its presets line up with the ladder rung for rung in the
  documentation, but #535 records that no Codex approval round trip could be observed at all and
  says the adapter "should not be assumed". Nothing here changes that: the Codex column is a
  reading of its docs, and the ladder must not be cited as evidence the adapter works.
- **`Mode` is still not `Permission`.** The ladder is where the boundary sits; a Permission is the
  prompt raised when something reaches for it. Nothing here merges them, and the criterion that
  they never share a shape in the cockpit stands.

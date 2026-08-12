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
| **Auto** | no boundary, asks nothing — **Argo's own gate allows without raising a Permission** (read from `claude` 2.1.228, #663) | `auto` | Full Access |

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

*(Corrected under #653. The fixture never pointed its Hub at the Project, and discovery starts in
`Hub.connect` and nowhere else — so no transcript was read and every record-based claim below was
waiting on a sweep that had not begun. The rows are what the tests establish now that it does.)*

| Rung | Flag | What the live run established |
|---|---|---|
| **Auto** | `auto` | Spawned on it, the transcript reports `auto`. The gated call ran unasked once the gate learned the ladder — see the `Auto` section below (#663). |
| **Code** | `acceptEdits` | Spawned on it, a gated `Bash` call still raises a Permission — the rung accepts edits, not commands. Unchanged from 2.1.227. |
| **Read Only** | `plan` | Spawned on it, the agent does not write and the file it was asked for is never created. |
| **Plan** | `plan` | The same value and the same observed behaviour as Read Only. Its intent is unobservable by construction, which is what this ADR already says. |

So the `≈` rules stand against values the CLI still accepts: `manual` and `default` both read as
`Read Only ≈`, `bypassPermissions` as `Auto ≈`, and `dontAsk` as `unknown`. Nothing in the
2.1.227 → 2.1.228 step moved any of them.

**`--permission-mode` is honoured for every rung.** The mid-Session half is the section below.

## Verification · the mid-Session walk, 2.1.228, 2026-08-12 (#653)

#629 read a failed `Code → Auto` change on a running Session as the CLI having withdrawn
`shift+tab`. **It had not.** The 2.1.227 and 2.1.228 binaries were compared at the three places
that decide this — the `Chat` keybinding table, the `ESC [ Z` decoder, and the `chat:cycleMode`
handler — and they are identical. The bug was Argo's, and the multi-step walk had never worked.

**The mechanism is `shift+tab`, one keystroke per WRITE.** Driven against 2.1.228 by writing
back-tabs at a real PTY and reading the rung off the TUI's own footer:

| What Argo wrote | Where the Session landed, from `acceptEdits` |
|---|---|
| `ESC [ Z` × 1 per write, six writes | `plan → auto → manual → acceptEdits → plan → auto` — the ring, one rung per keystroke |
| `ESC [ Z ESC [ Z` in one write | `plan`. One rung, not two |
| `ESC [ Z ESC [ Z ESC [ Z` in one write | one rung, not three |

**Every back-tab arriving in a single read is one mode change to the TUI.** So a walk has to reach
the CLI as separate reads, which means separate writes with a gap behind each. Two writes issued in
the same run-loop turn collapse exactly as one string does; a gap of **15 ms** already walks a
three-step change correctly, as do 60 ms and 120 ms. Argo waits **50 ms** — that floor with room
for a machine under load — so the longest walk on a four-value ring costs 150 ms.

This is why `SessionDriver.setMode` is the one act on the port that is `async`. It is not one
keystroke but a walk, and it answers when the walk is done so the caller's refusal covers all of
it.

**The ring is unchanged**: `auto → manual → acceptEdits → plan → auto`, confirmed rung by rung from
the footer. `bypassPermissions` and `dontAsk` are still not on it.

`LiveModeTests` proves it against the CLI's own record: a Session raises a Permission on a gated
`Bash` call while standing on `Code` — which is what makes it a *running* Session rather than a
freshly spawned one — is moved to `Auto` while idle, and the next Turn's stance record reads
`auto`. Reverting the fix to a single batched write turns the same test red with the record
reading `plan`: one rung short, which is precisely the collapse.

**A gated call cannot be the evidence for a rung, because Argo's own gate defeats it.**
`PermissionChannel.asked` never reads the Session's mode, so the `PreToolUse` hook Argo installs
asks on **every** tool call at every rung. `Auto` cannot mean "asks nothing" while that is true,
and `LiveModeTests`' `Auto runs a gated call and never asks` fails on 2.1.228 for that reason —
Argo's, not the CLI's. The rung itself reaches the CLI either way, which both record-based tests
show. **This is #629's remaining half**: the flag is honoured and the walk lands, but the gate has
to learn the ladder before `Auto` behaves like the top of it.

*(Closed by #663 — the section below. The gate reads the rung now, so a gated call IS evidence
again at every rung but the top, where it is evidence of the opposite.)*

**A set outranks the record until a record is written AFTER it — counted, not compared.** The
earlier rule compared the CLI value seen when the rung was set, which cannot tell a record that
has not caught up from one that has spoken and repeated the old value. That is precisely what a
change which did not land produces, so Argo went on drawing a rung nobody was standing on. Counting
the Session's stance records makes silence and disagreement two different facts, which is what
lets the snap-back exist at all. The walk lands now (#653), so the snap-back is the exception
rather than the rule — but it is what stands between Argo and a rung it merely asked for, and the
next CLI change is exactly what it is for.

**A rung cannot be changed while a WALK is in flight either** (`SessionDriveError.modeWalking`).
The walk takes time now, so a second pick can arrive in the middle of one — and it would count its
distance from a stance the first walk has already left, then interleave its keystrokes with it.
That lands the Session on a rung nobody picked, which is the same failure the rule below prevents
mid-Turn, arriving by a different door.

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

## Verification · what the gate does at `Auto`, 2.1.228, 2026-08-12 (#663)

`Auto` still asked, because the boundary the rung names was Argo's to keep and Argo was not keeping
it. The rung reached the CLI (both sections above), and then Argo's own `PreToolUse` hook asked
anyway — so the CLI stopped asking on `Auto` and Argo started.

**The gate hook runs at `auto`, can dial Argo, and the CLI honours the answer.** Read by rebuilding
the companion plugin's own hook — the fifo-held `nc -U` of `Companion/Plugin/permission-hook.sh` —
against a stand-in listener on a Unix socket outside the Workspace, then asking a headless 2.1.228
for one gated `Bash` call while standing on `auto`:

| What was read | At `auto` |
|---|---|
| The `PreToolUse` hook runs at all | yes — its payload carries `"permission_mode":"auto"` |
| It can dial a socket outside the Workspace | yes, though `auto` sandboxes the Bash call itself |
| The `allow` it carries back is honoured | yes — the call ran and the file appeared |

The listener was a stand-in and not `PermissionChannel`, so what this establishes is the **path**:
nothing about `auto` stops the hook reaching a socket Argo could be listening on, which is the only
version of the sandbox worry that bears on the gate. The rung was what was missing, and the gate
reads it now.

**The 180 s stall #663 reported does not survive the fix.** It was seen through the TUI path — a
real PTY, folder trust, the live fixture — where a gated call on `auto` produced no assistant turn
at all. With the gate reading the rung, that same test runs the call and finishes in **12 seconds**,
and all four of `LiveModeTests` pass against 2.1.228 on 2026-08-12.

So the stall was the gate rather than the rung: the hook blocks until Argo answers, and a Permission
nobody was shown is one nobody could answer, so the Turn stood still until the hook's own clock ran
out. The one part of that report this does not account for is the Permission being absent from the
roster as well; nothing here reproduces it, and the tests that would catch it now pass.

**"Asks nothing" is answered, not left ungated.** The other shape — install no gate for a Session
spawned on `Auto` — is simpler and was rejected, because a rung is *walked* mid-Session (#653): a
Session moved down from `Auto` to `Code` would find no gate to ask through, and the rung it stands
on would be a boundary nothing enforces. The gate is installed at every rung and allows at the top.

**The rung is read at the call, never held from the spawn**, for the same reason. `PermissionChannel`
takes a closure over the roster and asks it per call, so the reading the gate honours is the one the
composer draws and a walk counts its distance from. A copy taken at the grant would gate for a
boundary the Session had already left.

**The rung is filed under the CLAIM at spawn**, because that is the only key that survives the
re-key to the id the CLI picks — and between the re-key and the first stance record, nothing else
knows the rung at all. A resume counts its `recordsWhenSet` from the chain it continues rather than
from zero: from zero the chain's own next record reads as the CLI overruling a flag it honoured,
which would both misdraw the composer and put the gate on the wrong rung.

**Nothing is published for a call allowed this way.** No Permission is raised, so the cockpit shows
what it shows for any ungated tool: the Tool Call itself, off the transcript. That is the honest
reading — Argo asked nobody, so there is nothing DIRECT to report about a decision it never made.

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
- **Codex's mapping is code now, and one rung of it is exercised.** The column is spelled by
  `CodexStance`, which the adapter puts on `thread/start` and on every `turn/start` (#548) — so a
  Codex rung is a property of the Turn rather than a walk along a ring. `Code` is the rung the live
  suite runs at: under `on-request` with a `workspace-write` sandbox a write inside the Workspace
  raised no approval, which is that rung's boundary. The other three remain a reading of Codex's
  docs. What is verified is the surface, not every rung on it.
- **`Mode` is still not `Permission`.** The ladder is where the boundary sits; a Permission is the
  prompt raised when something reaches for it. Nothing here merges them, and the criterion that
  they never share a shape in the cockpit stands.

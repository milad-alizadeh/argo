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
| **Read Only** | no writes | `plan` | `read-only` |
| **Plan** | no writes, produces a plan | `plan` + `ExitPlanMode` | `/plan` |
| **Code** | writes and runs inside the Workspace, asks to leave it | `acceptEdits` | Auto preset |
| **Auto** | no boundary, asks nothing | `auto` | Full Access |

The boundary reading is taken because it is the one **both** CLIs can express. A frequency ladder
has rungs Codex cannot reach: it substitutes a sandbox for asking, where Claude substitutes asking
for a sandbox.

**Read Only and Plan share a boundary and differ by intent.** Plan carries a deliverable and a
hand-off gesture, which is what both CLIs implement — `ExitPlanMode` and `/plan` each end by
handing an approved plan to an execution phase. This is the ladder's one shared-boundary pair and
it is deliberate, not the superseded conflation returning.

**A CLI value with no exact rung renders as the nearest rung marked `≈`**, with the CLI's own value
stated verbatim on hover:

- `claude` `default` → `Code ≈`
- `claude` `dontAsk` → `Code ≈`
- `claude` `bypassPermissions` → `Auto ≈`

The mark is approximation, not a tier. The tier stays **DIRECT**, because Argo knows the fact
exactly and only its vocabulary is coarser. Degrading it to `unknown` would discard something
plainly observed, which is the opposite failure from the one degrade-down prevents.

`unknown` survives for its own case: a stance Argo genuinely cannot establish.

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
  It is a `.menu` picker now. That also ends the ink rule: macOS draws a menu picker through
  `NSPopUpButton`, which ignores `.tint` and `.foregroundStyle`, so `Auto` reads no louder than
  `Code` and a rung is read from its word. Giving `Auto` its loudness back needs a bespoke label
  and is deferred, not faked.
- **The Codex adapter can express every rung; the Claude adapter cannot express one it observes.**
  That asymmetry is why `≈` exists at all, and it is stated rather than smoothed over.
- **`Mode` is still not `Permission`.** The ladder is where the boundary sits; a Permission is the
  prompt raised when something reaches for it. Nothing here merges them, and the criterion that
  they never share a shape in the cockpit stands.

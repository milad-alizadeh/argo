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

The `claude` column is read from
[the permission-modes reference](https://code.claude.com/docs/en/permission-modes) as of
2026-08-11; the `codex` column from
[Codex's approvals doc](https://learn.chatgpt.com/docs/agent-approvals-security). Neither was
exercised against a live CLI here — #535's "Verified on 2026-08-10 against `claude` 2.1.226" is
the standard this table has **not** yet met, and #545 is where it must.

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

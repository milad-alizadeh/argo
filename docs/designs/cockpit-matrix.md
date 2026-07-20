# Ship ribbon — testable state matrix

Spec for `cockpit.html`. Every rule and row here is written to become a
unit test when the ribbon is componentized: given the session facts, the render is
fully determined.

## Session facts (the model)

```
dirty: n            uncommitted files in the session's tree
unpushed: n         local commits not on origin
head_sha            tip of the session branch
pr: null | { num, state: open|merged|closed, base: main }
ci: null | { status: running|passed|failed, sha, runs[] }      GitHub Actions, keyed to a sha
                    runs[] = one row per check { name, status, duration, note? };
                    the aggregate line ("1 running · 2 passed") derives from it —
                    the CI node's sub-label is its first segment (S4, S5)
review: rounds[] of { by, verdict: running|approved|changes, sha, findings }
agent: working|idle
policy: { create_pr: ask|auto, merge: ask|auto, push_after_pr: manual|auto }
```

## Node vocabulary

`◌` not yet · `●` in progress (agent/CI owns it — never a button) · `✓` done & fresh
· `⍚` stale (true of an older sha — dimmed, not red) · `✗` failed / changes requested
· `◆` waiting on a gate.

Nodes are **artifacts, not verbs**: `Commits · PR · CI · Review · Merge`. Push is not
a node — it is the sync affordance on Commits.

## Rules (each is one test)

- **R1 · head** = leftmost node that is not `✓`-fresh. The ribbon renders the head's
  action; everything right of head is `◌`/`⍚`.
- **R2 · one control** — at most one primary button on the whole screen, rendered in
  the head node. Zero buttons while the head is `●` (an agent/CI owns the stage).
- **R3 · staleness** — `ci.sha ≠ head_sha → CI ⍚`; latest approval `sha ≠ head_sha →
  Review ⍚`; Merge is locked unless CI and Review are both `✓` **and fresh**.
  Stale is never red: nothing failed.
- **R4 · pre-PR there is no push** — no push affordance exists before a PR;
  `Create PR = git push + gh pr create` in one gate.
- **R5 · post-PR sync** — `unpushed > 0 → Commits ● ↑n` with `[↑ Push n]` when
  `policy.push_after_pr = manual` (default); `auto` pushes on commit and the state
  is transient.
- **R6 · delegated gates narrate** — a gate with policy `auto` renders no button:
  it narrates like an observed step and carries a standing-order badge `⚙ auto`
  (click = revoke). You can always tell *why* something shipped without you.
- **R7 · ribbon existence** — no ribbon until the tree differs from base
  (`dirty = 0 ∧ commits = 0` → pane shows tabs only). Investigation sessions never
  grow one.
- **R8 · terminal states** — merged/closed replace the ribbon with a terminal
  card; the rail flips to `Landed` (`--tone-landed`, ≠ CI-pass green) or `Closed`.
- **R9 · single home per fact** — branch string typed exactly once (header
  WorkspaceIdentity chip). Allowed echoes: rail-row `⎇ branch · tree` line,
  `→ main` on PR surfaces (only once a PR exists), and the rail row's
  `PR #n · CI` word (R16 row 11) — triage needs it. PR number's home is the
  ribbon strip anchor.
- **R10 · motion budget** — one animation: the head node, only when `◆`/`✗`
  (stalled on a human). Otherwise the single top amber attention dot in the rail.
- **R16 · rail vocabulary** — the rail row carries exactly ONE status word, and a
  ship state's word **replaces** the lifecycle word rather than appending a detail
  to it. The lifecycle word (`Running` · `Needs input` · `Done` · `Failed` ·
  `Queued` · `Orphaned`) is the *fallback*, rendered only when no ship state has a
  claim on the row. Claims resolve against the ribbon's node states, first match
  wins:

  | # | claim | word |
  |---|---|---|
  | 1 | terminal merged / closed (R8) | `Landed` · `Closed` |
  | 2 | CI node `✗` — failed **and fresh** (a stale fail is `⍚`, R3) | `CI failing` |
  | 3 | Review node `✗` — verdict `changes` | `Changes requested` |
  | 4 | Merge gate open | `Ready to merge` |
  | 5 | Merge gate delegated (R6) | `Auto-merge armed` |
  | 6 | Commits `◆` — `dirty > 0`, agent idle | `Commit ready` |
  | 7 | Commits `● ↑n` — clean tree, `unpushed > 0` post-PR (R5) | `↑n unpushed` |
  | 8 | PR gate open (R4) | `Create PR ready` |
  | 9 | PR gate delegated (R6) | `Opening PR · auto` |
  | 10 | Review round running | `In review` |
  | 11 | a PR exists, no stage claims the row | `PR #n · CI` |
  | 12 | — | the lifecycle word |

  Rows 6 and 7 are ordered but never both true: dirty wins, so a dirty tree with
  unpushed commits reads `Commit ready`.

  The word is a pointer into the head node, never a value: `Commit 3 files` and
  `Push 1` are the ribbon's control labels; beside them the rail says `Commit
  ready` / `↑1 unpushed`.

## Executor split

| Kind | Examples | Who runs it |
|---|---|---|
| Observed | agent commits, CI runs, @sam reviews | nobody clicks — ribbon advances |
| Authorized gate | Create PR, Merge (confirm step) | human, or agent under `⚙ auto` |
| Repair | Commit n files (drafted msg), Push n, Re-run CI | app, direct git/gh — no LLM |
| Dispatch | Fix CI, Address findings | spawns/instructs the agent |

Agents never run `git push` themselves (guardrail stays); Argo the supervisor is
the only pusher, and only through a gate or R5 sync.

## State table

Columns: ribbon (C=Commits, P=PR, I=CI, R=Review, M=Merge) · head · primary
control (executor) · rail row state. The Rail column is the single word R16
resolves to — never the control's label, never a lifecycle word plus a detail.

| ID | Given | C | P | I | R | M | Head | Control | Rail |
|----|-------|---|---|---|---|---|------|---------|------|
| S0 | clean tree, no commits | — no ribbon — | | | | | — | — | Running |
| S1 | dirty 3 · agent working | ● 3 dirty | ◌ | ◌ | ◌ | ◌ | C | none (R2) | Running |
| S2 | dirty 3 · agent idle | ◆ | ◌ | ◌ | ◌ | ◌ | C | `[⎇ Commit 3 files]` (app) | Commit ready |
| S3 | commits ✓ · no PR | ✓ | ◆ | ◌ | ◌ | ◌ | P | `[⇄ Create PR → main]` (YOU) | Create PR ready |
| S3b | S3 · `create_pr: auto` | ✓ | ● creating… ⚙ | ◌ | ◌ | ◌ | P | none (R6) | Opening PR · auto |
| S4 | PR #42 · CI `1 running · 2 passed` | ✓ | ✓ | ● 1 running | ◌ | ◌ | I | none | PR #42 · CI |
| S5 | CI `1 failed · 2 passed` | ✓ | ✓ | ✗ 1 failed | ◌ | ◌ | I | `[Fix CI]` (agent) · `[↻ Re-run]` (app) | CI failing |
| S6 | CI ✓ · review round n running | ✓ | ✓ | ✓ | ● | ◌ | R | none | In review |
| S7 | changes requested · 2 open | ✓ | ✓ | ✓ | ✗ | ◌ | R | `[Address 2]` (agent) | Changes requested |
| S8 | approved · all fresh | ✓ | ✓ | ✓ | ✓ | ◆ | M | `[⇄ Merge #42]` → confirm (YOU) | Ready to merge |
| S8b | S8 · `merge: auto` | ✓ | ✓ | ✓ | ✓ | ● auto ⚙ | M | none (R6) | Auto-merge armed |
| S9 | +1 commit while PR open | ● ↑1 | ✓ | ⍚ | ⍚ | locked | C | `[↑ Push 1]` (app, R5) | ↑1 unpushed |
| S10 | merged | — terminal card: squash sha · by · when — | | | | | — | `[▸ Next ticket from main]` | Landed |
| S11 | closed w/o merge | — terminal card: closed · reason — | | | | | — | `[▸ New session from main]` | Closed |

Review rounds: S7→fixes land as commits→S9→push→CI re-runs→round n+1 opens under
the Review node with round n archived (`✓ round 1 · 3 findings · all fixed @sha`).
Same R3 mechanism, no extra states.

## Routing (each is one test)

Panes own a **data nature**, never a widget. Every object in a session is one of
four natures, and a click opens in the surface that owns its nature:

| Nature | Examples | Destination |
|---|---|---|
| Time-keyed narrative | timeline steps, outcome rows, now-line | expands in place in the story pane (prose only) |
| Time-keyed raw I/O | tool feeds, bg-agent streams, session PTY | a console channel in the terminal strip |
| Sha-keyed product | diffs, commits, artifacts, review findings | scopes the work pane |
| Remote | PR, Actions runs, human review, merge | drawer under its ribbon node, or deep link |

- **R11 · no hijack** — the work pane never renders time-keyed content; the story
  pane never renders a diff. The only cross-pane effect a story click may have is
  *scoping* the work pane to sha-keyed product (outcome → its files).
- **R12 · prose tree** — the timeline tree expands to more prose/one-line rows
  only; raw monospace output never nests inside it.
- **R13 · console channels** — the console is `session · live` plus **at most
  one capture slot**: clicking a tool/agent row REPLACES the slot with that feed
  (no tab accumulation, nothing to close one by one; ✕ clears the slot). The
  live channel alone carries the caret/tail; captures are timestamped,
  carétless; Esc (or the live tab) returns. Dispatched agents land as a
  timeline prose row + a roster entry whose stream fills the slot on click.
- **R14 · two reviews, two homes** — agent `/code-review` lives in the work
  pane's `Review · argo` tab (verdict + findings; findings also inline in the
  diff). The GitHub human review renders only in the ribbon Review node drawer
  (`@sam`). Never one shared "Review" surface. The Address dispatch carries
  observable per-finding state (Open → Addressing → Fixed chips); its button is
  a secondary control — R2 reserves the primary for the head node.
- **R15 · Actor roster** — the session's Agents and Runs (CONTEXT.md: Agent =
  in-session unit, "subagent" banned from UI copy; Run = batch | pipeline with
  named Phases) render once, in the story pane's **Background Tasks** section:
  AgentRow = name · goal · status word · duration; RunRow = name · shape word
  (`batch` | `dynamic workflow` — never "pipeline" in UI copy) · progress
  summary (`Survey ✓4 → Deep-read ●2/3 → Synthesize ◌` for a workflow, `n/m
  done` for a batch) shown **only while collapsed** — expanded, the rails and
  member rows carry the same information (single home). A batch's members list
  flat; a dynamic workflow's members group under **PhaseGroup** headers whose
  **left vertical rail is the state indicator** (timeline-spine idiom: working
  tint = running, green = done — pass semantics, same family as check-pass —
  faint = queued); the phase status (`done 4/4` · `running 1/3` · `queued`,
  lowercase) sits **inline after the phase name**, tinted the SAME hue as the
  rail — the card's right edge is a single faint tabular column of durations.
  Done phases collapse to their header, the active phase opens, future phases
  are header-only. Card colour system: 3 text roles (name / muted descriptor /
  faint trailing meta) + at most ONE state hue per row, always on a word. Status word + duration live there
  alone (word only where informative: running/failed always; done/queued only
  where it differs from the enclosing phase's rollup — lone rows always word);
  state word + duration render as one trailing meta unit. The timeline carries
  dispatch events as prose mentions; each Agent's stream is its console
  channel (R13).

## Pane anatomy (the Q1–Q4 decisions + Story|Work split)

- **No pane titles.** Both panes drop their name rows ("Activity", "Session
  changes"); names live in `aria-label`.
- **Pane 1 — the story** (time-ordered, prose): now-line → **Background Tasks**
  (the Actor roster, R15) → outcomes → timeline. **No tabs.** Timeline steps
  carry their transcript clock time (DIRECT tier — plain text, right-aligned).
  Section headers are the name alone — no right-side counts or status rollups;
  state lives in the rows. Local check *output* is not here (it's sha-keyed →
  Commits node drawer).
- **Pane 2 — the work** (sha-keyed + its fate): ribbon strip is the pane header
  (no "Ship" label anywhere; anchor `PR #42 → main · GitHub ↗` right-aligned) →
  selected node's detail as a collapsible drawer → tabs
  `Changes · 12 | Review · 2 | Artifacts · 4` → content.
- **Changes tab:** default **All files** = cumulative diff `merge-base(main)..head
  + dirty` (net effect, not per-commit concatenation), dirty files marked; toggle
  **By commit** for the grouped view. Outcome clicks scope this pane and get an
  `← All changes` return.
- **Review tab:** the agent review's home — verdict hero + findings list; a
  finding row jumps to its inline card in Changes (R14).
- **Artifacts tab:** every artifact of the session, each row tagged with its
  producing outcome; `gone` state preserved.
- **Terminal strip = the console** — channel tabs per R13; the existing hsplit
  keeps it resizable.
- **Identity:** WorkspaceIdentity chip sits in the header row right after the
  breadcrumb — `argo › Auth refactor ⎇ feat/auth-rotation · worktree` — one name
  (branch names the worktree); `worktree <directory>` only when an adopted
  worktree's directory differs;
  `shared · n ⚠` when 2+ sessions resolve to one tree. Live checkout, not a
  creation-time snapshot.

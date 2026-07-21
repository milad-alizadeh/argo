---
name: review-componentization
description: Blind rules-judge for a design→code conversion — audit the componentization judgment no linter catches: over/under-extraction, component naming and altitude (tier/domain), snap-vs-promote, and a parent screen re-telling a child region's state matrix. A fresh agent sees artifacts only, never the author's reasoning; pixel parity belongs to visual-verify and diff-level standards to code-review, not here. Use when the user wants to review or check a componentization or a design→code handoff before the PR, or when componentize-design reaches its verify step.
---

# Review Componentization

`code-review` reads the diff; `visual-verify` reads the pixels; this reads the **conversion
judgment** — the class of error where the screen renders correctly and every gate is green, but
the componentization is wrong: a block extracted with no evidence, a component named for an
internal id, a screen re-telling states its regions already own. That judgment only survives
review in a **fresh context that never saw the conversion being made** — the agent that just
settled and extracted knows what each choice *meant*, which is exactly the knowledge that hides
the defect.

## Gate

Applies when a design study has just been componentized (a settled screen, an inventory,
extracted components) or the user asks to review one. Assumes the mechanical gates are already
green — lint, type-check, module boundaries, the design-token check, story tests. If they are
not, run those first: this review spends its attention only on what tooling cannot decide, so a
finding a tool already catches is out of scope here.

## 1. Assemble the judge's inputs — artifacts only

Gather the artifacts, and only the artifacts, deriving every path at run time (repo root via
`git rev-parse --show-toplevel`; the study directory and rule files from what the repo
documents):

- the settled **study** HTML and, if the project has one, the foundations specimen;
- the **inventory** and the snap/promote table, handed over **as claims to audit**, not as
  ground truth — the judge's job is to test whether each row is right;
- the **built code** — the assembled screen View, every extracted component, its stories;
- the repo's **UI rules** — the component-tier/story rules and the design-system/token rules the
  repo loads for UI work, so every finding cites a written rule.

Withhold the conversation and your reasoning for any choice. If the inventory or the
snap/promote table is missing, the conversion is incomplete — return to `componentize-design`
rather than review a partial handoff.

## 2. Judge with fresh eyes — the calls a linter cannot make

Hand the judging to a **fresh context** that saw none of the conversion (Claude Code: spawn a
separate agent with the `Agent` tool; other harnesses: open a new session seeded with only the
inputs above and paste its verdict back). Give it the inputs from step 1 and this rubric — it
has no other access to it. It does **not** re-judge pixels; that is `visual-verify`'s lane. It
judges four things:

- **Extract-by-evidence** — a component earns its existence from repetition (a shape rendered
  twice), a known cross-screen unit, or an unexercised state needing its own coverage. Flag
  **over-extraction** (a single-use single-state trivial block pulled into its own file),
  **speculative** components (built for reuse or a state the screen never exercises), and
  **repeated-but-inline** (a shape that recurs yet was left inlined).
- **Altitude & naming** — a name reads as what a human sees, at the right level. Flag an internal
  id or study anchor surfacing as a component name, a tier that misreads the block (an organism
  named as an atom), and a wrong domain placement (a cross-region unit filed under one region, or
  a region-local one hoisted to the shared folder).
- **Snap-vs-promote** — every raw study value snapped to an existing token or was promoted to a
  new role-named one. Flag a promotion that should have snapped (a token a hair off an existing
  one, carrying exploration jitter into the contract), a snap that flattened a real distinction,
  and any token named by value rather than role.
- **No second telling upstairs** — a region owns its own state matrix. Flag a parent or screen
  that re-enumerates a child region's states (threading flattened props or branching on the
  child's internal cases), or re-stories a prop it forwards untouched — that coverage belongs to
  the child.

The judge returns a structured verdict: pass/fail plus findings, each naming the file, the call
it disputes, and the rule (or study line) it cites.

**If you cannot reach any fresh context, stop and say so** — judging your own conversion is the
failure this skill exists to prevent, not a weaker form of it. One Claude Code case: an agent
running inside a `Workflow` has no `Agent` tool, so the orchestrator runs the judge as its own
stage (other harnesses: any context that reaches an independent fresh session) rather than
nesting it here.

## 3. Resolve — advisory-with-teeth

The verdict advises; it does not command. For **each** finding do exactly one of two things:

- **Fix** it in the code or inventory, then re-render the affected state and re-judge; or
- **Reject** it with a one-line rationale that cites the rule making the finding wrong (a finding
  can contradict a documented rule — a valid rejection, recorded, not silent).

The teeth are that both silent-ignore (dropping a finding with no rationale) and blind-apply
(making a change you cannot justify because the judge said so) are themselves failures — the
cited-rule rebuttal is what keeps each honest. **Max two judge rounds**, as in `visual-verify`.
Anything still open after that ships, but the unresolved findings and their rebuttals go in the
PR body so the human sees what was weighed, not a silent pass.

The review is done when every finding is fixed-and-re-judged or rejected with a cited rule, and
the verdict plus any unresolved findings are recorded in the PR.

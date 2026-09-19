---
name: improve-codebase-architecture
description: Find deep module opportunities, show the evidence in a visual report, and grill the selected change.
disable-model-invocation: true
---

# Improve Codebase Architecture

Find architectural friction and propose changes that make modules deeper. A deep module hides substantial complexity behind a small interface. The result must help a person decide what to change, not only describe code organization.

## Establish the review contract

Write down the user request before exploration. Record the named scope, the questions to answer, the requested deliverable, the authorized actions, and any requested exclusions. If the user names a branch or worktree, inspect that exact checkout.

Create a completion checklist before exploration. Include one item for each question, deliverable, exclusion, required investigation, evidence check, and report section. Keep the checklist visible in the parent task. The review is not complete until each item is done, marked unknown with evidence, or ruled out by the recorded scope.

Architecture review is read-only work. During the review, restrict writes to the operating system temporary directory. A request for review is not authorization to edit the repository, the worktree, or Git history. If the user explicitly requests a persistent research note, record that authorization and the target path before writing it.

Read the `codebase-design` skill for the architecture vocabulary. Read the applicable domain glossary and ADRs before you name or move a concept. Use the project terms in the report.

If the user gives no scope, inspect recent commit history and select the paths that change often. Explain the selected scope in one sentence. A broad repository scan is not a substitute for a clear scope.

The review is complete only when every part of the request has evidence or is marked unknown.

## Build an evidence map

Decide the required investigations before dispatch. When the harness supports agent dispatch, run at least two independent investigators. When it does not, run the same investigations as separate local passes. Give each investigation an identifier and a different lens:

1. Trace the data and control flow from adapters through shared modules to every consumer.
2. Trace the same area from tests and user-visible behavior back to the source modules.

If agent dispatch is unavailable, keep the two local investigations separate. Do not merge them into one pass.

Give every investigator the same return contract:

- List each file that was opened.
- Describe the current flow with file and symbol evidence.
- Name the observed friction.
- Apply the deletion test.
- Identify the current interface and its test surface.
- Report applicable domain terms and ADRs.
- Separate verified facts, inferences, and unknowns.
- Return negative findings when a suspected problem does not survive inspection.

Keep each dispatch prompt visible in the parent task. Ask investigators to report evidence, not a recommendation alone. Do not remove a required investigation after work starts only because it is slow, inconclusive, or inconvenient.

Continue useful local inspection while investigators run. Do not draft the report yet. Wait for every required result, then read each result in full. If an investigator fails, rerun it or mark its checklist item unknown with the failure evidence.

Create an evidence map that connects the original request to the inspected paths. Reopen the decisive source files yourself. Tie each decisive claim to a path and line when the source is local. An investigator summary is a lead, not source evidence.

For each important flow, account for:

- The external input and its adapter.
- The canonical shared shape.
- Every projection or transformation.
- Every active consumer.
- The tests that observe the behavior.

Search for counterexamples before you call a rule shared. A candidate that only fits one harness, one renderer, or one call path must say so.

## Select candidates

Use the deletion test on every candidate. Ask whether deleting the proposed module would concentrate complexity or only move it. Keep a candidate only when the deeper module improves locality and reduces the interface that callers must understand.

Each candidate must include:

- The files and symbols involved.
- The current flow.
- The observed friction.
- The proposed responsibility of the deeper module.
- The behavior that stays outside the module.
- The interface and test surface after the change.
- The deletion-test result.
- The domain and ADR effect.
- The evidence limits and open questions.
- A strength of `Strong`, `Worth exploring`, or `Speculative`.

Reject a candidate when its evidence depends only on generated summaries, naming preference, folder symmetry, or a future feature with no present caller.

Do not propose concrete interfaces before the user selects a candidate.

## Render the report

Write one self-contained HTML report in the operating system temporary directory. Use a unique name such as `architecture-review-<timestamp>.html`. Keep generated files out of the repository.

Use a clear visual hierarchy. Each candidate needs:

- A short outcome statement.
- An evidence list with file paths.
- A current-flow diagram.
- A proposed-flow diagram.
- The deletion-test result.
- The test-surface change.
- The recommendation strength.
- Any ADR conflict or evidence limit.

Use Mermaid for dependency, flow, or sequence relationships. Use small HTML or SVG diagrams for module depth and responsibility. A decorative diagram does not count.

End with a top recommendation that compares the candidates against the original request. Explain why it has the best locality and leverage.

## Completion barrier

Before opening the report, make sure that:

- The completion checklist covers the recorded request and has no open item.
- Every required investigation finished and its result was read.
- The evidence map covers every part of the user request.
- The result matches the requested deliverable and authorized actions.
- The decisive claims were checked against source files.
- The report distinguishes facts, inferences, and unknowns.
- Every candidate passes the deletion test or is rejected.
- No active investigator can still change the conclusion.
- No repository file or Git history changed during the review unless the review contract authorized that exact write.

If one condition fails, continue the review. Do not present an intermediate report as complete.

Open the report and give the user its absolute path. Ask which candidate they want to explore.

## Explore the selected candidate

Use the `grilling` skill after the user selects a candidate. Work through constraints, ownership, the new interface, migration order, and tests. Continue to keep the source tree unchanged until the user explicitly asks for implementation.

Use the `domain-modeling` skill when the decision adds or changes a domain term. If the user rejects a candidate for a durable reason, offer to record an ADR so later reviews do not repeat it.

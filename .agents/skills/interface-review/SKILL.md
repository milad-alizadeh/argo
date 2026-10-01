---
name: interface-review
description: Interface review of live UI changes for accessibility, interaction, and visual consistency, plus visual matching when the user requests it.
---

# Interface Review

This review covers the live interface and reports findings without changing production code.
The user chooses the visual direction during live refinement. Taste is not a review verdict.

## 1. Identify the result to review

Read the requested scope, acceptance criteria, selected decisions, and the project's design stack document when present.
For a change review, read the complete diff. For an existing interface, identify the screens or components under review.
Locate the token sources, component library, and preview commands in the reviewed checkout.
If design documentation is absent, inspect the source and manifests for these resources and record any missing baseline.
Name its worktree, revision, and any uncommitted changes.
Derive affected states from the requirements and implementation, including required themes, viewport sizes, and content extremes.
For web interfaces, including Electron renderers, read [WEB.md](WEB.md) for the Vercel and WAI-ARIA review sources.

If nothing renderable changed, report not applicable and stop.
If the user requests visual matching, identify the designated reference and the states or regions that must match.
The reference can be an attached screenshot, a linked Figma frame, or a specific approved render.
Record its attachment or file identifier, URL, or revision so another reviewer can resolve the same reference.
Treat inspiration images and exploratory variants as context unless the user explicitly designates them for matching.
Without a matching request, perform the objective review below. No reference image is required.

Done when every affected state has a reproducer or an explicit reason that it cannot be inspected.

## 2. Inspect the live implementation independently

Run in a fresh review context that did not implement the change.
If already dispatched as that reviewer, perform the review here.
Otherwise dispatch one fresh reviewer with this skill folder, the raw requirements, checkout location, and state map.
If a fresh context is unavailable, report unavailable rather than self-certify.

Treat the supplied state map as a lead. Derive coverage independently and obtain your own evidence.
Use the reviewed checkout's live app or stories and the project's render commands.
Resolve the required runtime and dependency setup from the project manifest, lockfile, and run instructions.
Install dependencies as the project directs, then start the smallest preview or rendering build that exposes the reviewed surface.
If no preview exists, use a temporary harness around the actual components with representative data.
If the real surface cannot run, report the affected coverage unavailable. A recreated mockup cannot prove the implementation.
Inspect keyboard behavior in the live result, since a screenshot cannot prove it.
If an e2e command owns the real keyboard or mouse, follow the project's notice and permission procedure first.

Review each applicable area:

| Area | Look for |
| --- | --- |
| Tokens and components | Unresolved names, accidental raw values, duplicated primitives, or unexplained drift from shared consumers. Honor intentional named local decisions. |
| Hierarchy and spacing | Unclear primary actions, inconsistent grouping, misalignment, or spacing that obscures relationships. |
| Typography and content | Broken type roles, unreadable text, inconsistent action names, or missing guidance in errors and empty states. |
| Responsive behavior | Clipping, collisions, inaccessible controls, or incorrect scrolling with narrow widths and long content. |
| States | Missing or broken loading, empty, error, disabled, selected, and interaction states required by the task. |
| Keyboard and focus | Unreachable controls, incorrect focus order, trapped or lost focus, obscured focus, and missing accessible names. |
| Forms and navigation | Broken validation, lost input, missing progress feedback, or links and history that fail expected navigation. |
| Touch and performance | Gesture-only actions, inadequate hit targets, layout shifts, and lag during typing or scrolling. |
| Contrast and motion | Insufficient contrast under the project's accessibility target, distracting motion, or ignored reduced-motion preferences. |

Support findings with an observed defect and its user impact or violated rule.
Separate measured accessibility results from visual estimates.

For requested visual matching, compare only the designated states and regions at matching viewport, theme, content, and scale.
Identify both sources and describe material differences. Continue objective review for states outside that target.
If the reference or its comparison conditions cannot be resolved, report that comparison unavailable while preserving the objective findings.

Done when every affected state is inspected or explicitly listed as unavailable with its reason.

## 3. Return evidence and findings

Return fail when defects remain, unavailable when coverage is incomplete without known defects, or pass when coverage is complete without defects.
Each finding names severity, state, source location, observed behavior, and the violated requirement or interface rule.
Report unavailable coverage alongside findings, even when the verdict is fail.
Include reproducible commands or links, viewport and theme details, and the reviewed revision.
A hosted site built from the default branch does not prove an unmerged change.

Keep captures in a temporary directory. Delete them after inspection and return the commands and observations as evidence.
Return the report to the user or calling workflow. After fixes, review the affected states against the updated revision.

Done when the caller has the verdict, reproducible coverage, and every unresolved finding or unavailable check.

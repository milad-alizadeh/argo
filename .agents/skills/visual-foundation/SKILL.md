---
name: visual-foundation
description: Turn an approved direction into a tested UI foundation.
disable-model-invocation: true
---

# Visual foundation

A visual foundation turns an approved direction into real assets, semantic tokens, and reusable components.

## 1. Read the direction and project

Read the visual-direction record and inspect its approved moodboard.
Make sure that the approval names the visible revision. If either input or approval is missing, report it and stop.

Inspect the framework, styling, assets, tokens, components, dependencies, and render commands before changing them.
Identify what already expresses the direction and what conflicts with it.
Preserve fixed brand, product, and accessibility constraints from the direction record.

Done when the approved revision and every relevant existing source are accounted for.

## 2. Map the direction into a system

Use the current component base when one exists.
Otherwise, choose a maintained base that fits the stack.
For React and Tailwind, prefer shadcn/ui unless project constraints favor another base.

Translate each selected moodboard quality into exact candidates for:

- Font assets, families, roles, scale, weight, line height, and tracking.
- Semantic color roles, themes, and state relationships.
- Spacing, shape, elevation, motion, and focus treatment.
- Photography, illustration, icons, texture, and pattern rules.
- The smallest reusable component set needed to prove the language.

Use durable, permitted asset sources and the project's naming conventions.
Reconstruct generated type, labels, and color suggestions as real production assets and values.
Reuse a role that expresses the same purpose. Add a shared role when several consumers need it.
Keep fixed constraints separate from exploratory choices that still need approval.

Done when every selected quality maps to an asset, token, component rule, or explicit unresolved decision.

## 3. Build and prove the foundation

Configure the base and implement the assets, tokens, and components.
Preserve the base library's accessible behavior while applying the approved language.
Build one representative product composition and a second case with meaningfully different content or structure.
Both cases must reuse the same system without local styling exceptions.

Render relevant narrow and wide widths, supported themes, short and long content, and applicable interaction states.
Include empty, loading, error, disabled, focus, hover, and selected states where the components support them.
Inspect the actual renders against the approved board, including image loading, font loading, clipping, and hierarchy.

Prove accessibility with measured results and observed behavior:

- Measure foreground/background contrast for text and essential controls across themes and states against applicable WCAG AA thresholds.
- Exercise keyboard navigation, visible focus, focus order, and escape or dismissal behavior where applicable.
- Check accessible names, roles, state announcements, and errors with accessibility tools and manual inspection.
- Test text enlargement, reflow, and long content for lost controls or unreadable text.
- Emulate reduced motion and inspect the result. Meaning and controls must remain available without animation.

Record the tools, cases, measurements, results, and limits of each check.
An automated scan alone does not prove accessibility. Mark unavailable checks as unverified, never passed.
Run focused checks for changed wiring and resolve failures or mismatches within the approved constraints.

Done when both cases render and the relevant checks pass with recorded evidence.
If a required check is unavailable, report the gap and stop before claiming a complete foundation.

## 4. Show, approve, and record

Show both rendered product cases directly through inline images or an open harness or external browser preview.
For HTML, serve the preview and open its URL before requesting a decision.
A source file, file path, or terminal command does not present the result.
Show every visual revision and relevant comparison, with its tested conditions and remaining limits.
If generation, rendering, inspection, or display fails, report the exact failure and stop the visual decision.

Explain how the assets, tokens, and components express the approved direction.
Ask for explicit approval of the visible foundation. Silence is not approval.
Refine material decisions, rerun affected checks, and show the revised result before requesting approval again.

After approval, write `docs/visual-foundation.md`, or update the project's existing foundation record.
Record the direction, approved revision, asset and token locations, component rules, both proof cases, and render commands.
Include accessibility evidence, accepted limits, approver, and approval date.

Done when the person approves the rendered foundation and another agent can reuse it without inventing visual rules.

# Better visual exploration

Research date: September 13, 2026. This report combines official OpenAI guidance with Anthropic and Impeccable sources. Recommendations are proposals, not measured improvements to our skill.

## Conclusion

We need to change how the agent develops a direction, rather than add more required specimens. Our latest output used common layouts, palette substitutions, text symbols, and empty graphic containers. Those implementation choices explain much of the visible failure without assuming a model capability gap.

The user still needs four visual worlds, not four production screens. A convincing product composition can establish each world before supporting studies explain its typography, graphics, surfaces, and imagery. This preserves mood exploration while replacing empty style claims with visible evidence.

## What OpenAI offers

OpenAI publishes a dedicated frontend prompt, currently labeled for GPT-5.5. It distinguishes work software from promotional websites and games. Work interfaces prioritize useful information, navigation, and repeated tasks instead of oversized slogans and decorative cards. It calls for real icon libraries, appropriate controls, deliberate text sizing, and visible assets where the subject needs them. [Frontend prompt instructions](https://developers.openai.com/api/docs/guides/frontend-prompt).

Some instructions are narrow defaults, including radius limits, zero letter spacing, and particular hero treatments. Importing those literally into a general exploration skill risks another uniform aesthetic. The transferable principle is to fit the composition and controls to the task. This interpretation is ours, not a separate OpenAI requirement.

Codex supports image generation for illustrations, backgrounds, and UI assets. Its documentation describes reference-guided editing and targeted revisions that preserve other image details. It also warns that dense text needs close review and sometimes finishing in a design tool. We already have an image-generation tool available in this task. [Image generation](https://learn.chatgpt.com/docs/image-generation).

The official responsive-frontend workflow combines screenshots or design briefs with browser inspection and iteration. It explains that unspecified design choices tend toward common patterns. This workflow is particularly useful for translating a known visual target, rather than discovering an entirely new identity. [Responsive frontend workflow](https://learn.chatgpt.com/use-cases/frontend-designs).

OpenAI's newer skills guidance warns against accumulated recipes, conflicting instructions, and excessive mandatory reading. It recommends small entry documents with supporting material loaded only when relevant. This supports testing a simpler skill, but does not prove that prompt length caused our regression. The guidance is model-dependent. [Rethinking skills and prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

These are documented capabilities and guidance, not a verified one-click moodboard skill. This research did not establish that an OpenAI bundle will automatically solve our exploration task.

## What Anthropic and Impeccable contribute

Anthropic's frontend-design skill asks for deliberate visual planning, subject-specific composition, and critique. Its current examples of common defaults closely resemble our recent directions: warm editorial cream, dark acid accents, and repeated card layouts. It does not require a reference board or a fixed sheet inventory. [Official frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md).

Claude Design combines an HTML canvas, design context, alternative layouts, and direct visual editing. Anthropic's designer describes it as an HTML playground and explicitly distinguishes it from image generation. The practical lesson is to explore and refine the actual composition, not to expect a special raster model to solve the interface. [Designer account](https://claude.com/blog/how-the-product-designer-who-built-claude-design-uses-it-to-explore-ideas-before-building-them), [product capabilities](https://claude.com/product/design).

Impeccable offers both mockup-first and direct-code paths. Its exploration changes structure and hierarchy, not just color. Its research reports useful signals for references, but explicitly does not isolate their effect. More mandatory artifacts therefore remain a hypothesis, not an evidence-based quality guarantee. [Build paths](https://impeccable.style/docs/new-work/), [research](https://impeccable.style/research/).

Anthropic also reports experiments with a separate evaluator that inspects rendered applications. Examples calibrate its taste judgments, and concrete feedback drives revisions. The author sometimes preferred intermediate versions, and some criteria caused aesthetic convergence. More review rounds alone are not a quality guarantee. [Visual evaluation experiment](https://www.anthropic.com/engineering/harness-design-long-running-apps).

The companion report contains source details and distinctions between requirements, capabilities, and reported evidence: [Anthropic and Impeccable research](/Users/milad/Developer/argo/.claude/worktrees/ticket-1960-visual-skills/docs/research/2026-09-13-design-generation-anthropic-and-impeccable.md).

## Proposed next experiment

This proposal keeps the requested four directions and thumbnail viewer. It changes the creative process, not the purpose of the skill:

1. Use the interview to establish audience, purpose, real sample tasks, and fixed constraints.
2. Develop each direction independently, with its own composition and visual idea rather than a shared specimen template.
3. Establish each world through a substantial product or website composition with realistic content.
4. Develop supporting mood studies from that composition, including typography, graphics, icons, surfaces, and relevant imagery.
5. Use external references or original generated assets when they help resolve a specific visual question.
6. Keep precision-critical text and controls in editable markup or vectors, even when an image concept guides composition.
7. Preserve the first version before revision so we can compare rather than assume the newest result is better.

A mood study can remain experimental. It does not need a complete application, exhaustive state coverage, or identical quantities of every asset. The required evidence is a coherent visual world and a plausible application of it.

References remain optional inputs, not a closed catalog of permitted looks. A reference can contribute composition, icon construction, material treatment, or finish without dictating the whole design. When source images appear in a presentation, distinguish inspiration from original output.

## Make review useful

Separate objective defects from design judgment. Missing assets, blank graphics, clipped text, contrast problems, and broken navigation require specific evidence. Creativity, coherence, and appeal require comparative judgment and an explanation of what succeeds or fails.

Give a fresh reviewer the brief, rendered outputs, and criteria without the generator's explanation or preferred direction. Record coverage so a repeated screenshot cannot stand in for several files. A reviewer verdict remains advisory until its findings match the visible evidence.

Use earlier examples the user liked to calibrate finish and richness, not to prescribe their colors or layouts. Ask which directions are structurally closest and whether each succeeds on its own. Reject an attractive palette if the actual interface remains weak.

The smallest useful comparison is two fresh runs with the same brief, interview answers, model, and effort budget. One uses the current skill, and one uses the smaller proposed workflow. Compare unlabeled outputs for legibility, appeal, distinctness, visual richness, and task fit before accepting another rewrite.

No skill edits, generation tests, or viewer fixes were performed as part of this research.

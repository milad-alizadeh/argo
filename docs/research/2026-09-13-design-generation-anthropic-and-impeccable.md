# Visual generation: Anthropic and Impeccable

Research date: September 13, 2026. Sources are Anthropic publications, official repositories, and Impeccable's own documentation. Repository links refer to mutable `main` snapshots opened on this date.

Capability facts describe documented tools and access. Prompt advice describes instructions that steer generation. Evidence describes reported observations, with their limits. Practical recommendations below are inference, not measured results.

## Anthropic: guidance and evidence

The current official frontend-design skill requires a short plan before code, followed by a review against the brief. Its plan covers four to six named colors, type roles, layout ideas with ASCII wireframes, alignment, and distinguishing principles. It grounds choices in the subject and real content. It accepts one or two font families and treats hierarchy, measure, weight, and spacing as design decisions. Structure must communicate information. Motion must serve attention or explain a change. It calls for mobile responsiveness, keyboard focus, reduced-motion support, accessibility, and critique during implementation. Screenshots are conditional on tool support. The brief overrides its warnings about common visual defaults.

These are skill instructions, not product prerequisites or experimental proof. It requires neither a reference moodboard nor a fixed inventory of sheets. It does not mandate image generation or an external image search. Its opening can use text, imagery, animation, a demonstration, or interaction. [Official skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), also published in the [official plugin repository](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md).

Anthropic's November 12, 2025 article reports improvements from targeted aesthetic prompts. Its mechanism is concrete guidance that maps to code: typography, themes, motion, and backgrounds. A roughly 400-token prompt packages that guidance for loading when needed. The article shows before-and-after examples, rather than a controlled study of reference boards or artifact counts. Its example font bans and theme choices are prompt advice. They are not timeless requirements for every interface. The current skill above also differs from this older prompt. [Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills).

The accompanying cookbook demonstrates generation with and without aesthetic guidance. Its references include cultural aesthetics and editor color themes, expressed in words. It also demonstrates prompting for one design dimension at a time. Thus, its use of inspiration does not establish an image-board prerequisite. [Frontend aesthetics cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb).

Current Sonnet 5 documentation offers two ways to increase variety: specify a concrete alternative or propose directions before building. Its example asks for four directions with palette, typeface, and rationale, then user selection. This is model-specific prompt advice, not evidence that four is optimal or that four sheets are necessary. [Design and frontend defaults](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5#design-and-frontend-defaults).

Anthropic's March 24, 2026 engineering article provides stronger mechanism evidence for visual iteration. A generator and separate evaluator share criteria for design quality, originality, craft, and functionality. The evaluator uses Playwright to navigate the live page, inspect screenshots, and return concrete criticism. Scored examples calibrate its judgments to the author's preferences. The generator then refines or changes direction.

The experiment used five to fifteen iterations, with runs up to four hours. Reported scores improved and then leveled off. The author sometimes preferred an intermediate version. A museum example changed from a conventional page to a spatial gallery, which demonstrates structural exploration rather than recoloring. Criteria wording also caused unwanted aesthetic convergence. These observations support explicit criteria, rendered inspection, and permission to change structure. They do not establish an optimal iteration count or a universal taste scale. [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps).

## Claude Design: documented product and workflow

Claude Design is an actual Anthropic product. The April 17, 2026 announcement introduced it as a research preview. The current product page and August 6 help article describe a beta for Pro, Max, Team, and Enterprise subscribers. Enterprise access is off by default and requires an administrator to enable it. These are official availability statements, not evidence of access for a particular account. [Launch announcement](https://www.anthropic.com/news/claude-design-anthropic-labs), [current product page](https://claude.com/product/design), [getting started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design).

Documented mechanisms include importing design systems from repositories and files, reusing actual components, and correcting output against that system. A web capture can supply existing website material. Canvas controls support comments, text edits, spacing and color adjustments, dragging, resizing, and alignment. Claude Code integration supports design-system sync and design handoff. The page's claim that users can generate a dozen directions describes capacity, not a required workflow count. [Product capabilities](https://claude.com/product/design).

The help guide presents relevant screenshots, images, existing assets, and repositories as context users can attach. It recommends two or three alternative layouts when direction is uncertain. Broad structural changes belong in chat, while comments target particular elements. Users can preserve a version before exploring another direction. Its default workflow assumes an imported design system, but does not prescribe collecting competitor references or assembling a moodboard. [Workflow and prompting advice, August 6, 2026](https://support.claude.com/en/articles/14604416-get-started-with-claude-design).

Anthropic designer Nate Parrott's July 24, 2026 article explains the implementation medium: an HTML playground beside chat, with brand knowledge supplied through prompts. It explicitly says Claude Design has no image model and is not built for image generation. It recommends bringing existing logos and assets. His workflow explores variants and gathers feedback before production work in Claude Code. This supports visual code generation and asset import, not a claim of native photographic image generation. [Designer account and product limits](https://claude.com/blog/how-the-product-designer-who-built-claude-design-uses-it-to-explore-ideas-before-building-them).

## What Impeccable adds

The repository describes one skill, 23 commands, live browser iteration, and 61 deterministic design rules. Deterministic rules produce the same result from the same input without a model judgment. Commands cover typography, layout, accessibility, copy, performance, and refinement. Optional hooks bring detector findings into edits. A clean detector result does not prove visual quality. The README credits Anthropic's frontend-design as its starting point. [Current repository](https://github.com/pbakaus/impeccable).

The inspected skill declares version 4.3.1. It separates durable product facts, recorded visual decisions, and page-specific strategy. Four visitor modes distinguish persuasion, task operation, reading, and exploration. It preserves established identity for refinements and permits replacement for redesigns. It requires an initial batched visual inspection, a batch of fixes, and at most one confirmation round in the build context. Its command table marks `craft` as a deprecated alias, despite broader README wording. [Current skill source](https://github.com/pbakaus/impeccable/blob/main/.vibe/skills/impeccable/SKILL.md).

Creative exploration is more prescribed than Anthropic's short skill. For open pages within an existing identity, Impeccable derives five to seven structures and uses a script to select three. New identities use seven grounded candidates plus catalog alternatives. Selection varies through a recorded random seed. Local additions and precisely specified narrow requests skip this process.

For applicable directions, the workflow requires opening the chosen catalog board and example page to calibrate finish. It says catalog references carry a usable visual system, not merely a mood. They can inform layout, controls, states, and responsive behavior. Typography also depends on purpose: system fonts remain acceptable for task interfaces and reading. [New-work source](https://github.com/pbakaus/impeccable/blob/main/.vibe/skills/impeccable/reference/new-work.md).

A comp is a detailed visual mockup. Impeccable offers a mockup-first path and a direct-code path. With image generation available and no preference saved, mockup-first is the default. Users can change it. The documentation acknowledges that translating mockups into code loses detail and needs review. These are workflow descriptions and author claims, not a controlled quality comparison. [Build paths](https://impeccable.style/docs/new-work/).

Within the mockup-first path, three compositions and recorded selection are explicit requirements, with an earlier equivalent round accepted. They vary hierarchy, density, sequence, layout, or interaction framing while retaining the selected identity. Existing-product screenshots supply visual references. Prompts must identify what transfers and what does not. The approved image becomes a measured spatial target. Image regions become actual assets, while text and controls remain semantic interface elements. Asset records retain generation prompts or source origins. A new palette sheet is explicitly excluded from this composition round. [Visualization and asset source](https://github.com/pbakaus/impeccable/blob/main/.vibe/skills/impeccable/reference/visualize.md).

Image generation comes from an available tool or a configured external API fallback. It can produce mockups and finished illustrations. Reading screenshots alone does not supply image generation. The direct-code path remains available. [Image-generation documentation](https://impeccable.style/docs/image-generation/).

Live mode generates alternatives for selected elements in a local running page. Users preview, accept, or discard them. It requires a local checkout and development server or static HTML. [Live-mode source](https://github.com/pbakaus/impeccable/blob/main/.vibe/skills/impeccable/reference/live.md). The separate critique command requires both design assessment and detector/browser evidence. It isolates these assessments when delegation tools exist and reports degraded operation otherwise. These are Impeccable's review rules, not Anthropic product requirements. [Critique source](https://github.com/pbakaus/impeccable/blob/main/.vibe/skills/impeccable/reference/critique.md).

## Evidence for mandatory references and sheet counts

A moodboard collects visual inspiration. A design-system board describes reusable visual rules. A page comp proposes actual composition. Evidence for one does not automatically support the others.

Impeccable's July 2026 field report describes about 30 skill iterations and 200 sampled concepts. It reports repeated selection of the first idea despite varied creative prompts. Random assignment among grounded choices and review against declared intent addressed that failure. Evaluation combined its design director's judgments with paired screenshot judgments from another model. Multiple workflow changes limit causal conclusions.

For reference cards specifically, two builds that saw cards were strongest in their group, while one without cards was weakest. The authors explicitly say this signal does not isolate the cards' effect. They also report that requiring a written structural self-assessment added work and reduced quality. These are useful observations about process costs and selection, not proof that more required artifacts improve results. [Impeccable research, July 2026 experiments](https://impeccable.style/research/).

No inspected source isolates a quality benefit from forcing every task through a reference moodboard or a fixed multi-sheet inventory. Anthropic supplies examples of optional inspiration and variable exploration counts. Impeccable enforces particular counts within selected workflows, but that establishes its procedure, not the optimal count. The evidence supports investigating references and alternatives. It does not justify a universal artifact quota.

## Practical implications for a general exploration skill

The following recommendations are inference from the mechanisms and limits above:

- Require the product, audience, task, real content, constraints, and scope of visual change to be clear.
- Require deliberate type hierarchy and composition, with working states and readable content appropriate to the interface.
- For open design questions, compare alternatives that change structure, sequence, density, or interaction, and explain the tradeoffs.
- Choose the number and format of alternatives from the unresolved decision, budget, and user's request.
- Use references when they resolve uncertainty about identity, craft, imagery, or structure. State what each reference contributes.
- Offer image mockups when composition benefits from them and generation tools are available. Retain a direct-code path.
- Distinguish imported assets, generated illustrations, and factual product evidence. Plan assets that the chosen concept actually needs.
- Review the rendered result against the brief and selected direction. Inspect relevant viewport sizes and important states.
- Separate technical defects from subjective design judgments. Preserve useful earlier versions and stop when further iteration lacks a clear target.
- Record selected decisions and their reasons. Make moodboards and extra sheets conditional, unless the user requests those deliverables.

A future evaluation can compare a compact brief, optional references, and mandatory boards under the same tasks and time budget. Blind human judgments can measure task fit, structural variety, and visual quality alongside completion time. Until such evidence exists, a fixed inventory remains a workflow preference.


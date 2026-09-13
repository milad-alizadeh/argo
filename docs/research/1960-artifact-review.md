# Visual exploration artifact and review standards

Date: 2026-09-12

Question: How must a visual-exploration artifact present, annotate, compare, and evaluate directions so a stakeholder can choose one?

Method: This note uses first-party guidance from Miro, Figma, GitLab, Atlassian, IBM, IDEO.org, and Argo issue #1960. It focuses on artifact format, evidence density, annotations, tradeoffs, comparison, and feedback capture.

## Recommendation

Use one review board with five parts:

1. A short review brief.
2. Three equal direction frames.
3. One comparison frame.
4. One feedback frame.
5. One decision record.

The brief states the audience, decision, fixed constraints, flexible choices, and feedback deadline. GitLab asks a presenter to give the customer problem, constraints, design decisions, and exact critique areas before review. It also asks the presenter to state whether they need feedback, help, or approval. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

The three direction frames use the same size and the same content categories. This makes the visual systems comparable. GitLab uses two or three distinct designs for early comparative work and gives each participant the same tasks for each design. [GitLab Comparative Testing for Navigation](https://handbook.gitlab.com/handbook/upstream-studios/experience-research/comparative-testing-for-navigation/)

The comparison frame puts the three directions side by side against fixed review questions. The feedback frame keeps reactions and reasons near the visual evidence. The decision record names the selected direction, retained elements, rejected elements, unresolved risks, approver, and approval date. GitLab asks teams to capture critique points and show how critique changed later work. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

## Artifact format

A moodboard is a structured visual argument, not an image collection. Miro defines a moodboard as an organized set of images, colors, textures, and other visual elements. Miro says that it communicates a direction and aligns stakeholders around an aesthetic. [Miro Mood Board Templates](https://miro.com/templates/mood-board/)

Each direction frame needs one short theme statement. It also needs evidence for imagery, color behavior, typography, patterns, and interface elements. Miro names those five parts in its moodboard guidance. [Miro Mood Board Templates](https://miro.com/templates/mood-board/)

Argo needs more than the five Miro parts. Each direction must also show composition, image treatment, material, shape language, space, and small product fragments. The three directions must remain distinct when names and accent colors are removed. [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)

Use frames or sections to preserve the reading order. Miro presentation mode reuses framed board content as a presentation. FigJam can separate one file into sections and run a vote for each section. [Miro Workshops and Meetings](https://help.miro.com/hc/en-us/articles/360012753200-Miro-for-workshops-meetings) [Figma Voting Sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)

Keep the editable board as the review source. Export a PDF or image only as a viewing copy. Miro supports stakeholder sharing and PDF or image export, but object comments do not export. [Miro Mood Board Templates](https://miro.com/templates/mood-board/) [Miro Comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments)

## Evidence density

Every item must explain part of the direction. Do not add repeated examples that prove the same point. IDEO.org moves only the most compelling, common, and inspiring evidence to a new board, then groups it until useful themes appear. [IDEO.org Find Themes](https://www.designkit.org/methods/find-themes.html)

Give each visual channel enough evidence to show a pattern, not an isolated taste. The board needs to show how photography handles light, composition, and subjects. It needs to show color swatches with use ratios, a heading and body type relationship, and interface or pattern details. [Miro Mood Board Templates](https://miro.com/templates/mood-board/)

Increase fidelity only when it improves the decision. GitLab starts with the simplest artifact that communicates an idea and raises fidelity as confidence grows. IBM uses low-fidelity work for early feedback and mid-fidelity work when stakeholders need enough detail for a commitment. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/) [IBM Enterprise Design Thinking Framework](https://www.ibm.com/training/enterprise-design-thinking/framework)

Small product fragments are evidence of translation. They show how the references affect a real interface without turning the board into a complete screen proposal. GitLab defines discussion work as rough concepts that align a team before detailed production work. [GitLab Collaboration Model](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/collaboration-model/)

## Annotations

Put a short annotation beside each evidence cluster. The annotation states what to notice and how it supports the theme. GitLab asks presenters to explain their rationale and to frame the work around the customer problem instead of the interface alone. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

Use four annotation types:

- Intent: The response that the cluster seeks.
- Rule: The repeated visual behavior.
- Boundary: The fixed constraint that the direction respects.
- Risk: The likely failure or cost.

These types keep review comments tied to goals, constraints, decisions, and critique areas. GitLab asks reviewers to connect feedback to user needs and business goals instead of personal preference. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

Attach discussion comments to the exact object or region. Miro comments can attach to objects, move with them, form threads, notify named people, and enter a resolved state. [Miro Comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments)

Do not use comments as the final record. Miro does not include attached comments in exports. Copy the decision and important reasons into the decision record. [Miro Comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments)

## Tradeoffs

Give each direction a compact tradeoff block with four fields:

- Optimizes for.
- Gives up.
- Risks.
- Conflicts with.

A tradeoff means that the team gives up one benefit to gain another. Atlassian asks teams to state that exchange, rate flexibility, discuss differences in reasoning, and record the result. [Atlassian Project Trade-Off Analysis](https://wac-cdn-a.atlassian.com/team-playbook/plays/trade-offs)

Use the same tradeoff fields for all three directions. If every direction claims the same strengths, ask which one gives users the most benefit and which one best fits project values. Atlassian uses these questions when every tradeoff receives the same priority. [Atlassian Project Trade-Off Analysis](https://wac-cdn-a.atlassian.com/team-playbook/plays/trade-offs)

Do not hide the recommendation. If the agent recommends one direction, mark it only after the stakeholder reviews all three. Explain the reason for the recommendation. GitLab warns that unexplained alternatives can produce design by committee and requires clear reasoning when several solutions are shown. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

## Comparison layout

Show an overview of all three directions before the detailed walk-through. Let the stakeholder return to that overview before the final choice. GitLab lets comparative-test participants review all designs again before the final comparison. [GitLab Comparative Testing for Navigation](https://handbook.gitlab.com/handbook/upstream-studios/experience-research/comparative-testing-for-navigation/)

Use the same row order in each direction and in the comparison frame:

1. Theme and intended response.
2. Composition and space.
3. Typography.
4. Imagery and image treatment.
5. Color behavior.
6. Material, texture, and shape.
7. Product fragments.
8. Tradeoffs and risks.

This order combines Miro's moodboard parts with the visual dimensions in Argo issue #1960. [Miro Mood Board Templates](https://miro.com/templates/mood-board/) [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)

Keep the amount and type of product content constant across directions. This isolates the visual direction as the changed variable. GitLab gives participants the same tasks for every design and randomizes design order to reduce order effects. [GitLab Comparative Testing for Navigation](https://handbook.gitlab.com/handbook/upstream-studios/experience-research/comparative-testing-for-navigation/)

Do not combine the directions during the first review. A hybrid can follow after the stakeholder identifies exact attractive and repellent parts. Argo issue #1960 requires visible refinement of the selected language after this feedback. [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)

## Evaluation standard

Evaluate each direction with questions, not a single score:

1. Can the stakeholder state the direction in one sentence?
2. Do all visual channels support the same theme?
3. Does the direction fit the fixed boundaries?
4. Does it remain distinct without its name or accent color?
5. Do the product fragments prove that the direction can enter the product?
6. Are its costs and risks visible?
7. Can every important reaction point to exact visual evidence?

The first three questions follow Miro's theme, alignment, and organized visual-language guidance. The fourth and fifth come from Argo's acceptance criteria. The last two follow Atlassian's tradeoff method and GitLab's requirement for specific feedback tied to goals. [Miro Mood Board Templates](https://miro.com/templates/mood-board/) [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960) [Atlassian Project Trade-Off Analysis](https://wac-cdn-a.atlassian.com/team-playbook/plays/trade-offs) [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

Use the questions to expose disagreement. Do not average them into a winner. IBM says that a playback exists to reveal alignment or misalignment, and that disagreement starts another iteration. [IBM Enterprise Design Thinking Framework](https://www.ibm.com/training/enterprise-design-thinking/framework)

## Feedback capture

Ask for feedback in three passes:

1. For each direction, ask what attracts the stakeholder and what repels them.
2. Across all directions, ask which direction they choose and why.
3. On the refined direction, ask for explicit approval.

Argo issue #1960 requires attraction and repulsion feedback, visible refinement, and explicit approval. GitLab collects likes, dislikes, rating reasons, and final comparisons after participants review every design. [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960) [GitLab Comparative Testing for Navigation](https://handbook.gitlab.com/handbook/upstream-studios/experience-research/comparative-testing-for-navigation/)

Collect initial votes without showing other votes. FigJam hides collaborator votes and cursors until the session ends. This supports independent reactions before group discussion. [Figma Voting Sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)

Treat voting as a way to narrow the discussion, not as approval. Figma describes voting as a way to narrow a board and reveal preferences. Argo requires a separate explicit approval after refinement. [Figma Voting Sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam) [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)

Capture reasons in anchored comments or notes. Keep the vote result as evidence. FigJam can save past voting results, and Miro can preserve threaded comments with resolved states. [Figma Voting Sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam) [Miro Comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments)

End the review with a written summary of the choice, reasons, changes, open risks, and next step. GitLab asks the presenter to summarize takeaways, record critique points, and state how critique affected later decisions. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

## Acceptance contract for the visual-exploration skill

The artifact is ready for stakeholder review only when all statements are true:

- One board contains a brief, three directions, a comparison, feedback space, and a decision record. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/) [Figma Voting Sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)
- Each direction uses the same frame size, category order, and product content. [GitLab Comparative Testing for Navigation](https://handbook.gitlab.com/handbook/upstream-studios/experience-research/comparative-testing-for-navigation/)
- Each direction shows a theme, imagery, color behavior, typography, patterns, product fragments, composition, material, shape, and space. [Miro Mood Board Templates](https://miro.com/templates/mood-board/) [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)
- Every evidence cluster has an intent, rule, boundary, or risk annotation. [GitLab Product Designer Workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)
- Every direction states what it optimizes, gives up, risks, and conflicts with. [Atlassian Project Trade-Off Analysis](https://wac-cdn-a.atlassian.com/team-playbook/plays/trade-offs)
- Feedback can point to a specific object or region, and the final record does not depend on comments that disappear from an export. [Miro Comments](https://help.miro.com/hc/en-us/articles/360017730873-Comments)
- The stakeholder can review all directions before choosing, and the first vote is independent. [GitLab Comparative Testing for Navigation](https://handbook.gitlab.com/handbook/upstream-studios/experience-research/comparative-testing-for-navigation/) [Figma Voting Sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)
- The selected direction receives visible refinement and explicit approval. [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)

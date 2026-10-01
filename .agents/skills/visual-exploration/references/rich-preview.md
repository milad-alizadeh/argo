# Rich preview

Use this stage only after the person approves a visual direction.
The approved board is the visual constitution for a small, connected product experience.
The output is working HTML, not another set of generated screens.

## Define the product slice

Choose one representative user journey from the confirmed brief.
Build four to six connected HTML views or states that cover entry, active work, progress, completion, and one consequential edge state.
Include responsive desktop and mobile layouts in the same implementation.
Keep the product facts, labels, and task state consistent across every view.

Use the anchor screen and interface fragments from the board as direct visual references.
Carry their composition, proportions, type character, colour relationships, geometry, density, imagery, marks, and depth into the HTML.
Interpolate only the missing views needed to connect the journey.
Make those views feel like adjacent parts of the same product, not opportunities to introduce new visual ideas.

Done when every planned view belongs to one coherent journey and traces back to visible evidence on the approved board.

## Write the fidelity specification

Record the observable decisions before coding:

- Target viewport, content bounds, columns, alignment lines, and major proportions.
- Type family or approved substitute, roles, weights, sizes, line heights, tracking, and measures.
- Colour values and their visible proportions across backgrounds, surfaces, text, actions, and states.
- Spacing rhythm, corner geometry, borders, shadows, layers, textures, and translucency.
- Image and illustration crops, icon construction, graphic marks, and asset placement.
- Interaction transitions and responsive changes implied by the board.

Distinguish a measured value from an interpretation.
If an exact font or asset is unavailable, choose the closest legal substitute and show the difference before continuing.

Done when another designer can identify what must match without relying on mood adjectives.

## Build the mini prototype

Use one served HTML entry point with navigation between the connected views.
Use real text and controllable HTML, CSS, and SVG for interface content, typography, layout, icons, controls, and states.
Use image generation only for artwork that the approved board requires, such as an illustration, photograph, or complex texture.
Do not generate UI screens, component sheets, mobile mockups, or state images during this stage.
The HTML is the design artifact; screenshots made afterward are review evidence.

Recreate the board's accepted visual assets instead of replacing them with generic icons, stock decoration, standard component-library styling, or approximate gradients.
Implement the interactions needed to move through the journey and demonstrate its important states.
Make the preview responsive, keyboard operable, visibly focused, and respectful of reduced-motion preferences.
Keep experimental code and assets within the preview workspace so that this run does not create production architecture.

The reference board decides visual intent.
`frontend-design` guides implementation quality, but it does not authorize a new aesthetic direction after approval.

Done when a person can complete the representative journey and every promised state is directly inspectable in HTML.

## Run the fidelity loop

Serve the preview and capture every HTML view at its intended desktop and mobile viewport.
Compare each render with the approved board side by side, then use an overlay or image difference for the reconstructable anchor view when the tools support it.
Correct the largest differences first: composition, scale, typography, colour proportion, imagery, geometry, depth, and fine spacing.
Repeat the capture and correction loop until the anchor view reads as the same design at first glance and the interpolated views preserve its language under close inspection.
Do not replace an inconvenient reference choice with a familiar component pattern.
Record any deliberate or unavoidable difference with its reason.

Inspect navigation, keyboard focus, reduced motion, long content, loading, empty, and error states that the preview claims to support.
Apply the main skill's presentation gate to the working preview and its rendered evidence.
Show the person the live HTML first, followed by the board comparison and remaining differences.

Done when all views are inspected, no unexplained visual drift remains, and the person explicitly approves the preview.

# Curated, precisely composed style sets

Use this format for software products and websites of any kind.
A direction is a coordinated set of focused files, not independent attempts to invent its design.
These per-file limits govern composition wherever the workflow refers to a board or counts its specimens.
Use the first sets to discover original colour and mood preferences, not to specify finished screens.

## Establish each direction

Use the interview to establish the project purpose, audience, viewing context, fixed constraints, and open preferences.
Explore four directions unless the user requests another number.
Keep task and sample-content coverage comparable while varying visual language and composition.
Do not carry colours, motifs, features, audiences, or copy from a previous test into another project.

Curate a small, complementary set of inspected references for each direction.
Record their sources, observed qualities, and the proposed interpretation for this project.
Choose specific details in type, colour relationships, material, image treatment, and composition instead of relying on a familiar aesthetic label.
Use original image generation only for purposeful imagery or material studies that the available references do not supply.
Give each image request one asset purpose, a defined subject or material, crop, colour intent, and relevant inspected references.
Keep text, logos, swatches, controls, and interface layouts out of generated assets.
Generated imagery is exploratory artwork, not a real project photograph, testimonial, or research finding.

## One provisional style record

Before composing the files, define one reusable record for each direction with:

- Exact colour values, semantic roles, and intended proportions.
- Real, available font families, loaded font files, weights, and display, reading, and utility roles.
- Spacing relationships, geometry, borders, and surface treatments.
- One coherent vector icon family or deliberately drawn SVG set.
- Inspected image and material assets with provenance and intended use.

Derive every file from this record rather than restating the style in independent generation prompts.
Render exact colour values as actual fills, text with actual fonts, and icons as vectors.
Keep these choices provisional for comparison; they are not an approved production design system.
Use HTML/CSS, SVG, or a controllable design tool to compose the presentation.
Each direction needs its own deliberate composition, not the same card grid recoloured four times.
Express originality through the selected references, typography, colour relationships, and designed details rather than background clutter.

## File 1: Colour, typography, and reference qualities

Include a compact selection of the inspected references that establish the mood, a labelled palette with colour-role and pairing samples, one short display heading, one reading paragraph, and a small utility-type sample.
Use five palette roles as a starting inventory: background, text, main accent, secondary accent, and supporting colour; adapt this to an established brand when needed.
Show deliberate proportions rather than giving every colour equal visual weight.
Use actual fonts and exact fills instead of generated pictures of type or swatches.
Keep annotations short and tied to a visible reference quality.

## File 2: Graphics, icons, surfaces, and effects

Develop the direction beyond colour and type: show an authored graphic device, a small coherent family of relevant vector icons, and purposeful surface and effect studies.
Give these studies enough space to judge their character and construction; do not substitute a grid of ordinary component cards or descriptions of imaginary effects.
Explore background treatments, gradients, light and shadow, layering, translucency, texture, borders, or restrained motion where they serve the direction.
Choose a coherent subset, not every technique in every direction. Depth does not require imitating physical objects, and restraint does not mean leaving the visual language undeveloped.
Consider photography, illustration, or abstract artwork as part of the visual language. Show an actual inspected or generated asset with deliberate subject, crop, colour treatment, and product role when imagery adds meaning or character.
For image-led websites, imagery may carry much of the mood; for work software, use it selectively in relevant content or identity moments without crowding reading and task surfaces.
Do not reuse one generic image as decoration across all directions or add stock imagery only to fill space. Keep provenance clear and illustrative content distinct from real people, projects, or evidence.
Show icons at useful interface sizes with deliberate stroke, fill, optical weight, and geometry rather than unrelated stock symbols.
Apply the graphic and surface language to a content container, action, and selected or focused element so its product role is visible.
Demonstrate focus, selection, and error only on suitable controls, with clear differences between their meanings.
Write the exact specimen list and labels before composition; do not let an image model invent them.
Avoid filling a fixed quota of icons, surfaces, or states that contributes no useful distinction.
Keep this an expressive style study rather than an exhaustive component inventory.

## File 3: Two contextual fragments

Include exactly two focused fragments, not whole screens surrounded by smaller controls.
Select the contexts from the interview and write their exact sample content, actions, and state facts before composition.
For software, demonstrate the core task and one related task or meaningful state.
For a website, demonstrate its main message or content hierarchy and a second content, navigation, or conversion context appropriate to its purpose.
Use purposeful imagery inside image-led fragments with a specified subject, crop, and role.
Give reading and work tools that space for content hierarchy and functional details instead.
Demonstrate spacing, alignment, hierarchy, and colour without inventing extra features.
Build the fragments from real text, vector icons, and the same style record used in the other files.
Carry the direction's imagery, graphic devices, surfaces, and effects into these fragments with a useful role: content, orientation, hierarchy, selection, grouping, emphasis, or atmosphere around a quiet reading surface.
Let layout, navigation treatment, depth, and visual hierarchy differ across directions while preserving the task and sample facts.
Label sample content as exploratory and avoid fabricated citations, metrics, and endorsements.

## File 4: UI in use

Add one focused sheet showing how the visual language supports a small, meaningful interaction.
Choose the interaction from the current project's purpose rather than reusing a previous example's features.
Show navigation or orientation, a content-browsing or task surface, and the visible result of one action as two related fragments.
For software, this might be choosing an item and acting on its detail; for a website, browsing content and opening a relevant detail or enquiry context.
Use realistic short labels and content, a clear selected state, and an obvious way back or next action.
If an interactive HTML example helps the comparison, make only that small interaction work; this is not permission to implement the full product.
Keep the task and sample facts comparable across variations while using each direction's existing style record.
Give these examples their own readable file instead of packing more controls into the mood and typography sheets.

## Present, inspect, and refine

Keep the viewer chrome quiet and separate from the specimens under discussion.
The specimens may use expressive backgrounds, gradients, layering, texture, photography, and graphic gestures where the direction calls for them.
Keep reading and control surfaces legible; remove competing or arbitrary effects rather than flattening the whole design.
Exclude filler slogans, ornamental scenery, device mockups, tiny captions, and extra screens.
A short project-relevant type sample is not permission to turn the set into a marketing campaign.

Render all files and inspect them at presentation size for loaded fonts and assets, readability, alignment, spacing, clipping, icon consistency, and state accuracy.
Compare the files together: actual colours, type roles, geometry, and mood must agree with their shared record.
Judge beauty and originality separately from technical cleanliness, citing concrete strengths and weaknesses.
Correct a defective specimen in its source rather than regenerating the entire style set.
Disclose any unresolved artifacts or rendering limits.

Save each direction as four separately openable files in outputs and present them through the bundled viewer.html template, copied as index.html beside directions.json.
Use the viewer's visual sidebar: a cover thumbnail for each direction and a grid of actual specimen thumbnails within the selected direction, with short captions and a clear current selection.
Do not replace previews with a text-only list, generic icons, palette dots, or invented thumbnails. Preserve the specimens' actual compositions and proportions.
An optional thumbnail field on each manifest file may point to a captured preview image; otherwise image specimens preview themselves and HTML specimens use scaled, non-interactive frames.
Author HTML specimens as static markup and CSS so they render with scripts disabled in both the viewer and its thumbnails. CSS effects and reduced-motion-aware animation are allowed; use static states for script-dependent interactions.
Use a full-window presentation stage with directions grouped in a left sidebar, one large specimen at a time, and previous/next arrows plus keyboard navigation.
Keep the viewer neutral so its chrome does not become another visual direction; do not replace the presentation with a dashboard or a grid of text cards and links.
Populate directions.json with {"title":"Project visual exploration","directions":[{"name":"Direction name","summary":"Short visual thesis","files":[{"title":"Colour and typography","src":"direction-01.html","kind":"html","width":1440,"height":1000}]}]}.
Use actual filenames, names, and useful canvas dimensions; kind is html or image, and images retain their intrinsic proportions.
Retain fit-to-stage and actual-size viewing, direct file access, visible current position, and a compact mobile navigation drawer.
Navigation is exploration, not approval; the viewer must never select or approve a direction on the user's behalf.
Keep source records, asset provenance, and editable presentation source available for refinement.
Present the four directions with equal weight and a provisional recommendation, then ask which exact qualities attract or repel the user.
After feedback, hone the chosen colour relationships, typography, surfaces, and contextual fragments while preserving what the user liked.
Do not move into complete screen design or implementation without separate approval.

## Method references

[Style Tiles](https://styletil.es/) informs exploring fonts, colours, and interface qualities before screen layout.
[Element Collages](https://v3.danmall.com/articles/rif-element-collages/) informs contextual fragments that remain exploratory.
[Figma moodboard guidance](https://www.figma.com/resource-library/how-to-make-a-mood-board/) informs reference curation and visual coherence.
[OpenAI image-generation limitations](https://developers.openai.com/api/docs/guides/image-generation#limitations) inform keeping exact typography, geometry, and shared styles outside generated raster assets.

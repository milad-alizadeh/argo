# Distinct visual directions, not palette swaps

Date: 2026-09-12
For: [Argo issue #1960](https://github.com/milad-alizadeh/argo/issues/1960)
Status: Research synthesis from primary and first-party sources

## Finding

A visual direction is a coherent system that gives one design idea a visible form. It is not a set of new color values on an unchanged screen. Google describes brand distinction through typography, color, iconography, imagery, voice, motion, dimensionality, and graphic hierarchy. Its Material studies apply these variables together to make unique products inside one component framework. [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding) · [Material Studies](https://m2.material.io/design/material-studies)

Professional teams make the concepts different before they make the screens polished. Google calls this a menu of possible futures with “wildly different outcomes.” Its sprint process then turns selected ideas into prototypes and tests them with people. [Google, “Rehearsing the Future”](https://design.google/library/rehearse-the-future) · [Google, “Sprinting Ahead”](https://design.google/library/design-sprints)

The practical test is removal. If a reviewer removes the palette and still sees the same type hierarchy, image language, composition, shape grammar, controls, motion, and tone, the options are palette swaps. This test is an Argo recommendation based on the coordinated brand variables in Google and Atlassian guidance. [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding) · [Atlassian Foundations](https://atlassian.design/foundations)

## How teams produce real alternatives

### 1. Hold the problem constant

Each direction must answer the same brief, user, content, platform, and core task. Google starts a design review by agreeing on the problem. It then asks whether every design detail supports the solution to that problem. [Google, “Design Reviews: Going Beyond the Surface”](https://design.google/library/reviewing-the-design-review)

This control makes the comparison useful. A direction cannot appear stronger because it solves an easier task or displays better sample content. This control is an inference from Google’s problem-first review model. [Google, “Design Reviews: Going Beyond the Surface”](https://design.google/library/reviewing-the-design-review)

### 2. Give each direction a different thesis

Write one short thesis before drawing a screen. The thesis states the intended character, the visual metaphor, and the hierarchy strategy. Google’s speculative design teams depict different outcomes so that the organization can inspect real forks in the road. [Google, “Rehearsing the Future”](https://design.google/library/rehearse-the-future)

Use opposing, specific attributes instead of broad praise words. Examples include quiet versus energetic, editorial versus operational, or dense instrument versus spacious guide. Google’s Material team compares designs with emotional attributes such as playful, energetic, creative, friendly, and positive. [Google, “Expressive Design”](https://design.google/library/expressive-material-design-google-research)

### 3. Explore several variables as one system

Do not start with three palettes on one component tree. Material 3 Expressive identifies color, shape, size, motion, and containment as basic parts of expression. Google’s broader brand guidance adds typography, imagery, iconography, voice, dimensionality, and graphic hierarchy. [Google, “Expressive Design”](https://design.google/library/expressive-material-design-google-research) · [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding)

Style Tiles provide a compact early artifact for this work. Their creator defines them as combinations of fonts, colors, and interface elements that communicate a visual brand. She positions them between a moodboard and a full mockup. [Samantha Warren, Style Tiles](https://styletil.es/)

### 4. Use the same proof screens

Render each direction with the same small set of representative states. Include the main task, a dense state, an empty or error state, and one important transition. Google uses medium-to-high fidelity mocks, short videos, prototypes, and early builds for mid-stage review. [Google, “Design Reviews: Going Beyond the Surface”](https://design.google/library/reviewing-the-design-review)

Static screens cannot prove a motion direction. A Google field study found that participants misunderstood a static card interaction, while motion made the intended swipe clear. [Google, “Sketch, Scroll, or Swipe?”](https://design.google/library/sketch-scroll-or-swipe)

### 5. Compare perception and use

Ask reviewers to identify each direction’s character before they hear its title. Also ask them to find the main action and complete the same task. Google evaluates concepts with emotional ratings, eye tracking, preference work, and usability tests. [Google, “Expressive Design”](https://design.google/library/expressive-material-design-google-research)

Do not choose expression at the cost of recognition. Google found that an unstructured playlist looked modern, but people could not identify the familiar list. Apple also recommends familiar platform behavior where it helps people navigate. [Google, “Expressive Design”](https://design.google/library/expressive-material-design-google-research) · [Apple, “Communicate your brand identity on iOS”](https://developer.apple.com/videos/play/wwdc2026/251/)

## Observable differentiation criteria

The criteria below turn a subjective review into an observable comparison. They describe what a reviewer can see or hear in the same proof screens. Each row also names the palette-swap failure.

| Dimension | Record for each direction | Evidence of real difference | Palette-swap failure |
|---|---|---|---|
| Typography | Typeface class, family, width, weight range, case, scale, line height, measure, and role hierarchy. | The hierarchy and reading rhythm remain recognizably different in grayscale. Google shows Crane with a large display hierarchy and Fortnightly with separate headline and body faces. Apple states that type can express hierarchy, content, brand, and style. [Google](https://design.google/library/staying-true-to-your-identity-material-branding) · [Apple](https://developer.apple.com/design/human-interface-guidelines/typography) | Only text color changes. The same font, sizes, weights, line breaks, and density remain. |
| Color behavior | Surface strategy, semantic roles, contrast pattern, accent frequency, state colors, image-to-UI relationship, and light or dark behavior. | Color changes where attention goes and how surfaces relate. The Fortnightly takes color from content, Abisko places bright accents on dark gray, and Shrine uses two accents on white. [Google](https://design.google/library/staying-true-to-your-identity-material-branding) · [Apple](https://developer.apple.com/design/human-interface-guidelines/color) | Hue values change, but the same elements receive primary, secondary, surface, and state colors in the same proportions. |
| Imagery | Medium, subject, viewpoint, crop, depth, texture, treatment, repetition, purpose, and share of the canvas. | The image system creates a different world and has a different job. Abisko uses bold imagery with diagonal graphics. Shrine uses mostly orthographic product images on white and gives photography most of the grid. [Google](https://design.google/library/staying-true-to-your-identity-material-branding) · [Atlassian](https://atlassian.design/guidelines/brand/illustrations/) | The same images, crops, masks, placement, and visual weight remain under a new tint or filter. |
| Composition | Grid, alignment, density, whitespace, focal point, layering, asymmetry, content order, and image-to-text ratio. | A blurred or grayscale thumbnail still has a different silhouette and eye path. Google asks whether the grid guides the eye and whether hierarchy is clear. IBM defines its grid as the structure for columns, boxes, type, icons, and illustrations. [Google](https://design.google/library/reviewing-the-design-review) · [IBM Carbon](https://carbondesignsystem.com/elements/2x-grid/overview/) | Containers keep the same dimensions, positions, spacing, hierarchy, and responsive behavior. |
| Shape | Corner family, cut or round treatment, stroke, border, icon geometry, container silhouette, depth, and repetition rules. | The shape grammar repeats across controls, containers, and icons. Material states that shape can direct attention, identify components, communicate state, and express a brand. Atlassian coordinates icon curves with rounded UI elements. [Material Design](https://m2.material.io/guidelines/material-design/introduction.html) · [Atlassian](https://atlassian.design/foundations/iconography/) | Only background and border colors change. The same radii, outlines, shadows, icons, and silhouettes remain. |
| UI expression | Navigation model, component emphasis, control styling, surface model, information density, action placement, and use of standard or custom controls. | The directions express the same task through visibly different component and emphasis choices while they keep needed platform conventions. Apple shows Gentler Streak using custom content with native navigation and Slack using a custom toolbar that still behaves like iOS. [Apple](https://developer.apple.com/videos/play/wwdc2026/251/) | The same component tree, card treatment, navigation, actions, and state presentation remain. Only theme tokens change. |
| Motion | Purpose, trigger, duration, easing, path, choreography, continuity, gesture, and reduced-motion form. | A short recording has a different rhythm and spatial model. Google treats interaction patterns as brand identity. Atlassian defines motion through duration, easing, and property, and reserves characterful motion for key moments. [Google](https://design.google/library/staying-true-to-your-identity-material-branding) · [Atlassian](https://atlassian.design/foundations/motion) | The directions use the same transitions and timing, or they contain no motion proof. |
| Tone | Named character, vocabulary, sentence shape, labels, empty-state behavior, error behavior, humor, and emotional target. | A reader can distinguish the directions from unstyled copy and can map each one to its intended attributes. Google tests screens against emotional words. Atlassian defines voice as personality and tone as its situation-specific expression. [Google](https://design.google/library/expressive-material-design-google-research) · [Atlassian](https://atlassian.design/server/foundations/writing-style/) | Titles describe different moods, but the labels, messages, imagery mood, interaction feedback, and reviewer ratings remain the same. |

### Scoring rule for Argo

Score each pair of directions from 0 to 2 on every dimension:

| Score | Observable result |
|---|---|
| 0 | No material difference appears in the proof screens. |
| 1 | A difference appears, but it is local, decorative, or inconsistent. |
| 2 | A repeated system changes the hierarchy, character, or behavior across all proof states. |

Treat two directions as distinct only when they score 2 on at least five dimensions. Three of those dimensions must come from typography, imagery, composition, shape, UI expression, or motion. Color cannot qualify a pair by itself. This threshold is an Argo recommendation, not a published industry standard. The source guidance supports multi-variable systems and whole-product review, but it does not publish a numeric cutoff. [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding) · [Google, “Design Reviews: Going Beyond the Surface”](https://design.google/library/reviewing-the-design-review)

Add two removal tests after scoring. First, view all directions in grayscale. Second, replace branded copy with neutral labels. A pair fails when neither test leaves a clear structural distinction. These tests are Argo inferences from the source dimensions above. [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding) · [Atlassian Foundations](https://atlassian.design/foundations)

## Concrete first-party examples

### One framework, several identities

Google’s Material brand personas show that one design system can produce distinct products. Crane is a typography-led corporate travel product. Fortnightly uses a classic newspaper model. Abisko uses bold diagonal graphics for extreme sports. Shrine uses an airy, image-led retail model. Pinch makes gesture and motion central to its identity. [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding)

The later Material Studies make the same point with reusable components. Google describes the studies as fictional products with unique properties, product limits, users, flows, and brand expressions. The set spans retail, music, productivity, finance, services, and education. [Material Studies](https://m2.material.io/design/material-studies)

The component examples expose system-level differences instead of screenshots alone. Rally uses dark data-table surfaces, condensed type, and square corners. Shrine buttons use pink and brown, Rubik type, and cut corners. Reply uses Work Sans and strongly rounded chips. [Material data tables](https://m2.material.io/components/data-tables/web) · [Material buttons](https://m2.material.io/components/buttons) · [Material chips](https://m2.material.io/components/chips/android)

### Brand character inside platform conventions

Apple’s iOS examples separate the shared platform layer from the expressive content layer. Gentler Streak combines native navigation with playful illustration and detailed data graphics. Slack customizes a toolbar but preserves familiar placement and behavior. NYT Cooking uses sharp custom icons while it keeps platform-specific sharing conventions. [Apple, “Communicate your brand identity on iOS”](https://developer.apple.com/videos/play/wwdc2026/251/)

This shows that distinct directions do not need different usability rules. The strongest differences can live in content, hierarchy, typography, imagery, iconography, and selected components while core navigation stays familiar. [Apple, “Communicate your brand identity on iOS”](https://developer.apple.com/videos/play/wwdc2026/251/)

### A full identity built across media

Google’s SPAN 2017 identity coordinates monospace type, paired colors, overlapping shapes, frames, and elastic layered motion. The team applied the same system to screens, walls, room partitions, and machine-painted posters. [Google, “Designing SPAN 2017”](https://design.google/library/designing-span-2017)

Google’s 2015 identity sprint also began with an explicit brief. The brief covered a scalable mark, responsive motion, systematic product branding, and recognizable character. The team explored several directions, then shared them with engineering, research, product, and marketing for testing and feasibility review. [Google, “Evolving the Google Identity”](https://design.google/library/evolving-google-identity)

## Recommended deliverable for issue #1960

For each direction, produce one concept card and the same four proof states. The concept card contains the thesis, three target attributes, type system, color behavior, image rules, composition sketch, shape grammar, UI rules, motion sample, and copy sample. This format combines Style Tiles with the review artifacts that Google uses for product evaluation. [Samantha Warren, Style Tiles](https://styletil.es/) · [Google, “Design Reviews: Going Beyond the Surface”](https://design.google/library/reviewing-the-design-review)

Present directions side by side and hide their names during the first review. Ask reviewers to describe the perceived character, point to the main action, and explain the hierarchy. Then reveal the intended thesis and score the eight dimensions. This review method is an Argo synthesis of Google’s attribute ratings, eye-tracking questions, usability work, and problem-first critique. [Google, “Expressive Design”](https://design.google/library/expressive-material-design-google-research) · [Google, “Design Reviews: Going Beyond the Surface”](https://design.google/library/reviewing-the-design-review)

Reject a set when most differences disappear after grayscale, neutral copy, or thumbnail blur. Revise the weakest structural dimensions before adding polish. This rule prevents a direction title or palette from carrying an otherwise unchanged design. It is the operational conclusion of the cited multi-variable guidance. [Google, “Expressing Brand in Material”](https://design.google/library/staying-true-to-your-identity-material-branding) · [Material Studies](https://m2.material.io/design/material-studies)

## Primary and first-party sources

- [Google: Expressing Brand in Material](https://design.google/library/staying-true-to-your-identity-material-branding)
- [Google: Material Studies](https://m2.material.io/design/material-studies)
- [Google: Expressive Design research](https://design.google/library/expressive-material-design-google-research)
- [Google: Design Reviews](https://design.google/library/reviewing-the-design-review)
- [Google: Design Sprints](https://design.google/library/design-sprints)
- [Google: Rehearsing the Future](https://design.google/library/rehearse-the-future)
- [Google: Evolving the Google Identity](https://design.google/library/evolving-google-identity)
- [Google: Designing SPAN 2017](https://design.google/library/designing-span-2017)
- [Apple: Communicate your brand identity on iOS](https://developer.apple.com/videos/play/wwdc2026/251/)
- [Apple Human Interface Guidelines: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple Human Interface Guidelines: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Atlassian Design System: Foundations](https://atlassian.design/foundations)
- [Atlassian Design System: Illustrations](https://atlassian.design/guidelines/brand/illustrations/)
- [Atlassian Design System: Iconography](https://atlassian.design/foundations/iconography/)
- [Atlassian Design System: Motion](https://atlassian.design/foundations/motion)
- [Atlassian Design System: Voice and tone](https://atlassian.design/server/foundations/writing-style/)
- [IBM Carbon Design System: 2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/)
- [Samantha Warren: Style Tiles](https://styletil.es/)

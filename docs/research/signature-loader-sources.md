# Signature loader inspiration for Argo

**Date:** 2026-09-16 · **For:** choosing a distinctive running marker for the compact Session roster · **Status:** source review complete

## The short answer

Yes. The best places to browse are [Motion's live example library](https://motion.dev/examples?category=loading), [Rive's community and editor](https://rive.app/use-cases/websites), and [microinteractions.dev](https://microinteractions.dev/). They show motion as a designed system rather than a generic spinner. For Argo, the target should be a tiny, neutral-ink mark with one memorable gesture: a path being drawn, a shape handing off energy, or a compact signal resolving and repeating.

## Sites worth browsing

| Site | What it is uniquely good for | Practical caveat |
| --- | --- | --- |
| [Motion examples](https://motion.dev/examples?category=loading) | Excellent live React/JavaScript/Vue examples, including infinite loading, path drawing, ripple, pulse dots, and progress. Useful for studying timing, easing, and restraint. | Inspiration and code snippets, not a drop-in asset license. Rebuild the motion in our own CSS/SVG. |
| [Rive community and website examples](https://rive.app/use-cases/websites) | Best source for expressive, state-driven motion and “one object doing something” rather than a spinner. The page specifically exposes loaders, animated icons, logos, and micro-interactions as community categories. | Rive is a runtime and authoring workflow. Community files have per-item licenses; the official page says to open/remix them in the editor, so do not copy an asset without checking its item license. |
| [microinteractions.dev](https://microinteractions.dev/) | A focused gallery of tiny interaction ideas: text swaps, chevron morphs, hold-to-confirm, and other product-scale gestures. Good for finding a signature behavior that remains legible at 14–18px. | Primarily a visual reference gallery. Treat examples as inspiration unless the individual author grants reuse rights. |
| [Loading.io loader gallery](https://loading.io/spinner/) | Broad visual search with live previews and exports in SVG, CSS, GIF, APNG, and Lottie. Its vocabulary includes comets, vortexes, waves, zigzags, DNA, and dash rings. | Many gallery assets are paid. [Its CSS page](https://loading.io/css/) identifies the 12 included CSS loaders as CC0, but premium/gallery items have separate terms. |
| [Sam Herbert's SVG Loaders](https://github.com/SamHerbert/SVG-Loaders) / [live preview](http://samherbert.net/svg-loaders) | A clean, tiny reference set for pure SVG motion. It demonstrates how a loader can have a strong silhouette without gradients, glow, or a large footprint. | The repository is MIT licensed. Animated SVG/SMIL support and platform behavior should still be checked; for Argo, CSS keyframes or a controlled SVG path are safer. |
| [Loader Generator](https://schiste.github.io/loader-generator/) | Best place to invent, not just browse: tweak circle, squircle, hexagon, or triangle geometry; sweep, segmented rings, comet fades, easing, mirror, and glow; export CSS, Canvas, or SVG. | The generator repository is MIT licensed, but generated output should be reviewed for Argo's token and reduced-motion rules. Avoid exporting glow or color complexity for the roster. |
| [LottieFiles loading gallery](https://lottiefiles.com/free-animations/loading) | Large live-preview pool with hundreds of loading animations and filters for spinners, progress bars, and dots. Useful for discovering unusual timing and “loading as a character” ideas. | Each animation has its own license. LottieFiles says free items use the Lottie Simple License and premium items require a paid plan; [check the individual page](https://help.lottiefiles.com/discovering-downloading-and-uploading-animations) before reuse. A Lottie/dotLottie runtime is likely too heavy for this 18px marker. |
| [Lordicon animation docs](https://lordicon.com/docs/animation) | Strong reference for semantic icon motion: intro, hover, morph, loop, and stateful variants. Its core lesson is that motion should reinforce meaning rather than merely signal activity. | Assets and animation types are governed by Lordicon's licensing. Borrow the semantic motion principles, not the icon artwork, unless licensed. |
| [CodePen SVG/Loader collection](https://codepen.io/collection/RzbPvv) | Fast visual experimentation: open a pen, watch it live, and inspect the CSS/SVG implementation. Good for finding odd but compact path, mask, and stroke ideas. | Individual pens have individual licenses and authors. CodePen is a discovery surface, not a blanket reuse license. |
| [CSS Spinners by Jonathan LeBlanc](https://codepen.io/jlong/pen/nJvEYJ) / [source repository](https://github.com/jlong/css-spinners) | A useful study in minimal markup and distinct motion archetypes such as heartbeat, gauge, refreshing, and throbber. Particularly relevant to a developer tool because the forms stay legible in monochrome. | The source repository is MIT licensed; still adapt the implementation to Argo's existing tokens and accessibility behavior. |

## Patterns worth adapting for Argo

1. **A path that reveals itself, then resets.** Motion's path-drawing examples and SVG Loaders suggest a short open path whose head travels around a fixed silhouette. It reads as “active” without looking like a progress bar.
2. **A handoff between two parts.** Rive's state-machine mindset and microinteractions.dev's morph examples point toward two small arcs or nodes passing a highlight between them. The object stays inside the existing trailing slot; the energy moves.
3. **A partial contour with a deliberate pause.** Loader Generator's sweep/comet controls are useful here: a 60–75% contour travels with a soft tail, pauses briefly, then reverses. The pause gives it a designed cadence instead of “CSS spinner.”
4. **A semantic morph loop.** Lordicon's morph principle can become a tiny chevron, bracket, or diamond that opens, resolves, and returns. This is more ownable than a ring and still works in one color.
5. **A signal that compresses and expands.** The gauge/heartbeat family in CSS Spinners and the pulse/ripple examples in Motion can be reduced to a three-segment mark with a shared phase. Use opacity and scale sparingly so it remains a status mark, not an attention-grabbing notification.

## Constraints for the actual prototype

- Keep the running mark separate from the blue unread dot. Running is current activity; unread is a persistent notification.
- Design for the existing 18×14px title-slot footprint first. No glow, gradients, or large orbit that changes row geometry.
- Use the existing foreground token for the running mark. Color remains available for yellow needs-input and blue unread semantics.
- Prefer CSS/SVG reconstruction over importing a Lottie or Rive asset. It keeps the desktop bundle and renderer surface small and makes reduced-motion behavior explicit.
- Provide a reduced-motion fallback that is still distinguishable from idle: a static open contour or compact mark, not disappearance.

## Recommended browsing order

1. [Motion loading examples](https://motion.dev/examples?category=loading) for timing and path behavior.
2. [Rive website/community examples](https://rive.app/use-cases/websites) for distinctive object/state ideas.
3. [microinteractions.dev](https://microinteractions.dev/) for tiny product-scale gestures.
4. [Loader Generator](https://schiste.github.io/loader-generator/) to prototype a contour or segmented signal in Argo's monochrome constraints.
5. [SVG Loaders](http://samherbert.net/svg-loaders) for implementation discipline and small silhouettes.


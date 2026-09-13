# Web interface checks

Use this reference for browser interfaces and Electron renderers.
Read the current [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) and [review rules](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
Record the source revision or access date in the review.
Apply relevant technical checks to the affected states. Keep project requirements and the approved visual language authoritative.
Vercel's brand choices and framework preferences are not universal acceptance criteria.
If a source is unavailable, name that limitation and continue the local checks below.
Follow the parent skill's evidence and reporting procedure.

Inspect semantics, names, text alternatives, announcements, and form labels in the accessibility tree.
Exercise input, paste, validation, submission feedback, and recovery without losing entered data.
Check zoom, hit areas, gesture alternatives, content extremes, theme behavior, reduced motion, and visible interaction feedback.
Try expected navigation and history behavior. Observe typing and scrolling for stalls and unexpected layout movement.
Use these checks alongside the project's token and component rules, not as a replacement for them.

For changed compound controls, read the relevant [WAI-ARIA pattern](https://www.w3.org/WAI/ARIA/apg/patterns/) and [keyboard guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).
Exercise entry, internal navigation, activation, dismissal, and focus return with the keyboard.
Distinguish selected state from focus. Check focus after removing an item or closing an overlay.
Native elements already provide keyboard behavior. Test that behavior before proposing custom handlers.

Use the project's declared accessibility target for contrast and other measured requirements.
When none is declared, use [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) as the review baseline and state that assumption.
A supplementary perceptual contrast estimate does not replace the declared target.
Automated checks supplement live keyboard and accessibility-tree inspection.

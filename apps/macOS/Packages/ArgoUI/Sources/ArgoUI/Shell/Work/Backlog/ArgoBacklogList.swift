import SwiftUI

/// What the deck's leading pane is measured at (`docs/designs/cockpit-work-room.md` — the backlog
/// list). Beside the surface, per `rules/design-system.md`: a measure is not a token.
enum ArgoBacklogList {
    /// The smallest width at which all twelve of the repo's real titles read whole at depth three.
    /// At 480 three of them clip, which is the arithmetic that moved the backlog out of the rail.
    static let width: CGFloat = 520
    /// A FLOOR, not a frame — the same reason `ArgoWorkSidebar.viewRowHeight` is one. It grew from
    /// 28 when the title snapped up to `body` 13.
    static let rowHeight: CGFloat = 30
    /// The row's leading inset, before the twist.
    static let gutter: CGFloat = ArgoSpacing.comfortable
    /// Between the dot, the id, the title and the trailing fact.
    static let gap: CGFloat = ArgoSpacing.base
    /// The twist's slot. A LEAF KEEPS IT, so every dot in the list lands on one vertical — which is
    /// the whole reason the twist is drawn here rather than inherited from `DisclosureGroup`.
    static let twistWidth: CGFloat = 12
    /// One level of nesting. Sized so a child's dot lands under its parent's id.
    static let indentStep: CGFloat = ArgoSpacing.loose
    /// Level three shares level two's inset. At 520 this is comfort rather than necessity — it is
    /// what keeps a five-deep chart legible, and a chart that deep is read on the Route (#334).
    static let indentDepthCap = 2

    /// What one row is inset by, capped. Arithmetic rather than a table, so a depth nobody has
    /// rendered yet still lands somewhere the design named.
    static func indent(atDepth depth: Int) -> CGFloat {
        CGFloat(min(depth, indentDepthCap)) * indentStep
    }
}

import SwiftUI

/// What the deck's leading pane is measured at (`docs/designs/cockpit-work-room.md` — the backlog
/// list). Beside the surface, per `rules/design-system.md`: a measure is not a token.
enum ArgoBacklogList {
    /// The width the pane RESTS at, and its ceiling: the smallest at which all twelve of the repo's
    /// real titles read whole at depth three. At 480 three of them clip, which is the arithmetic
    /// that moved the backlog out of the rail.
    static let width: CGFloat = 520
    /// …and what it gives up to when the window cannot afford 520 (#836). A title that clips is a
    /// title you can still read the start of; a ticket pane squeezed under its own controls is a
    /// control you cannot reach at all, so the list is what yields. Rows already truncate at the
    /// tail, so nothing new happens below here — it happens to more rows.
    ///
    /// Derived, so it moves with the widths it is the remainder of rather than going stale beside
    /// them: the narrowest window, less the sidebar, less a pane of prose, less the two seams
    /// between the three — the split view's divider and the deck's own. Without that last term the
    /// arithmetic comes out exact and the seams are taken from the SIDEBAR, which then draws its
    /// labels off its own leading edge.
    static let minimumWidth: CGFloat = ArgoLayout.windowMinimumWidth
        - ArgoLayout.sidebarMinimumWidth
        - ArgoLayout.feedMinimumWidth
        - ArgoLayout.seamGrabWidth * 2
    /// The band over the list — its title, its count, and the two controls that narrow it (#836).
    /// A FLOOR and not a frame, for the reason the row height below is one: the two lines inside it
    /// are set at the reader's own type size.
    ///
    /// The TICKET pane spends the same number on an empty band, so both panes' content starts on
    /// one line. It reads this rather than repeating it — see `ArgoTicketDetail.bandHeight`.
    static let bandHeight: CGFloat = 44
    /// Inside the band, either edge. The gutter again, so the title starts on the vertical the rows
    /// under it start on.
    static let bandInsetX: CGFloat = ArgoSpacing.comfortable
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

import SwiftUI

/// What the deck's leading pane is measured at (`docs/designs/cockpit-work-room.md` — the backlog
/// list). Beside the surface, per `rules/design-system.md`: a measure is not a token.
enum ArgoBacklogList {
    /// What the pane OPENS at: the smallest width at which all twelve of the repo's real titles
    /// read whole at depth three. At 480 three of them clip, which is the arithmetic that moved
    /// the backlog out of the rail. The reader drags it from here — `ArgoLayout.backlogLimits`.
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
    /// The narrowest pane that still carries label chips. Under it a row spends its width on the
    /// chips and truncates the title to `T…`, which keeps the wrong half — the title is what a
    /// reader scans by. Above the 280 floor and below the 520 the pane opens at, so a reader who
    /// drags the seam in loses the chips before they lose the titles.
    static let labelsAppearAt: CGFloat = 440
    /// How many of a ticket's labels a row draws. Two, because the row's job is to DISTINGUISH one
    /// ticket from the next — the whole set is the ticket detail's, which has the width for it.
    static let labelLimit = 2
    /// Between the label chips, and between the last of them and the trailing fact.
    static let labelGap: CGFloat = ArgoSpacing.hair
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

extension EnvironmentValues {
    /// How wide the backlog pane is being drawn right now, seated inside its limits by the room.
    /// The rows inside a `List` cannot read it any other way: each is proposed its own width, not
    /// the pane's. Defaults to the width the pane opens at, so a `#Preview` with no room above it
    /// draws the shipping row.
    @Entry var backlogPaneWidth: CGFloat = ArgoBacklogList.width
}

import SwiftUI

/// What the deck's leading pane is measured at (`docs/designs/cockpit-work-room.md` — the backlog
/// list). Beside the surface, per `rules/design-system.md`: a measure is not a token.
enum ArgoBacklogList {
    /// The width the pane RESTS at: the smallest at which all twelve of the repo's real titles read
    /// whole at depth three. At 480 three of them clip, which is the arithmetic that moved the
    /// backlog out of the rail. No longer a ceiling — it is where the pane opens, and the reader
    /// drags it from there (#844, `ArgoLayout.backlogLimits`).
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
    /// Since #844 it is the SEAM's floor, so the derivation lives with the other seam limits and
    /// this reads it — one number, one place.
    static let minimumWidth = ArgoLayout.backlogWidths.lowerBound
    /// The heading over the list — its title and its count, and nothing else since the controls
    /// went back to the window's row. A FLOOR and not a frame, for the reason the row height below
    /// is one: the two lines inside it are set at the reader's own type size.
    static let bandHeight: CGFloat = 44
    /// Inside the heading, either edge. The gutter again, so the title starts on the vertical the
    /// rows under it start on.
    static let bandInsetX: CGFloat = ArgoSpacing.comfortable
    /// A FLOOR, not a frame — the same reason `ArgoTicketsSidebar.viewRowHeight` is one. It grew
    /// from 28 when the title snapped up to `body` 13.
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
    /// reader scans by. Between `minimumWidth` and the 520 the pane rests at, so a reader dragging
    /// the seam in loses the chips before they lose the titles.
    static let labelsAppearAt: CGFloat = 440
    /// How many of a ticket's labels a row draws. Two, because the row's job is to DISTINGUISH one
    /// ticket from the next — the whole set is the ticket detail's, which has the width for it.
    static let labelLimit = 2
    /// Between the label chips, and between the last of them and the trailing fact.
    static let labelGap: CGFloat = ArgoSpacing.hair
    /// The blockage mark's capsule, as a floor on both axes: at one digit it is a circle the size
    /// of a `viewRowHeight` glyph, and a second digit grows it sideways rather than shrinking the
    /// numeral. Sized against the machine caption it sets, not against the dot at the row's leading
    /// edge — the dot is a signal and this is a number somebody reads.
    static let blockageMark: CGFloat = 16
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

    /// The moment a row's age stamp is measured against (#897), and `nil` wherever nobody pinned
    /// one — the shipping app, which reads the wall clock as it draws. Only a RENDER sets it, and
    /// it has to: an age measured against the wall clock makes a shot that never matches itself
    /// twice. Optional rather than defaulted to `.now`, because an environment default resolves
    /// once and would freeze every age at whatever instant first read the key.
    @Entry var backlogNow: Date?
}

import SwiftUI

/// What the Route's canvas is measured at (`docs/designs/cockpit-work-room.md` — the Route,
/// re-skinned; the geometry is #334's). Beside the surface rather than in the contract: a measure
/// read by one surface is not a token (`rules/design-system.md`).
///
/// **The label block is measured against real titles, and `route.png`'s grid is not.** The study
/// draws a 132pt block on a 166pt column, which fits the titles it invented — `This prototype`,
/// `Read path`, `Node tree`. Over the repo's own tickets every one of them truncates inside the
/// first three words, and #334's whole layout finding is that legibility is decided by what a node
/// CARRIES rather than by the arrangement. So the block is widened to the measure at which the
/// fixture's titles read, on the same grounds the backlog is 520 rather than 480: a surface
/// measured
/// against short invented strings is a surface nobody has tested.
///
/// The step is DERIVED from the block plus its clearance rather than written down beside it, so the
/// two cannot disagree — a widened block moves its own column. #337 replaces the constant with the
/// widest label block actually in play, which is this same arithmetic over a measured width instead
/// of a chosen one.
enum ArgoRoute {
    /// How much of a column one label block may claim, dot included. A cap on a block that
    /// truncates
    /// rather than wraps, so a long title cannot walk into the column beside it — and the longest
    /// ticket titles still truncate, because no honest column width fits a sentence.
    static let labelWidth: CGFloat = 260
    /// Between one label block and the next column's dot. The rung the deck already parts unrelated
    /// things with.
    static let columnClearance: CGFloat = ArgoSpacing.section

    /// One column of the progress axis, dot to dot.
    static let columnStep: CGFloat = labelWidth + columnClearance
    /// The behind-the-line band's own column, left of the line. The same step: it is one column of
    /// the same axis, counted apart only because its rows stack on the other side of the line.
    static let behindStep: CGFloat = columnStep
    /// One row within a column, dot to dot. `route.png`'s 62, which carries the title and the
    /// machine line under it with the clearance that stops two label blocks touching.
    static let rowPitch: CGFloat = 62

    /// The canvas off its leading and top edges, before the first dot.
    static let originX: CGFloat = 64
    static let originY: CGFloat = 44
    /// The canvas off its trailing and bottom edges, so the last label block is not flush to it.
    /// #339's fog and destination mark take their own room beyond this.
    static let trailingPad: CGFloat = ArgoSpacing.region
    static let bottomPad: CGFloat = ArgoSpacing.section

    /// The dot itself. `ArgoIconSize.statusDot` is the room's own mark and this is the same size: a
    /// Route dot marks a ticket, which is what a backlog dot marks.
    static let dotSize: CGFloat = ArgoIconSize.statusDot
    /// The gap between a dot and the title beside it. Never in a side list — a title beside every
    /// dot is #334's whole layout finding.
    static let labelLead: CGFloat = ArgoSpacing.base
    /// Between the title and the machine line under it.
    static let labelStep: CGFloat = ArgoSpacing.hair
    /// The machine line under the title, onto the title's own vertical rather than the dot's.
    static let machineLineInset: CGFloat = dotSize + labelLead

    /// The NOW line's own inset back from the takeable column's dots. HALF the clearance, so the
    /// line stands in the middle of the gutter between the behind-the-line block and the takeable
    /// dots — which is what makes it impossible for the line to cross a label rather than a number
    /// that happens not to. `route.png`'s 44 was that gutter's half on the study's narrower grid.
    static let nowLineLead: CGFloat = columnClearance / 2
    /// The line's reach above the first row, where its caption sits (#339 writes the caption).
    static let nowLineLift: CGFloat = 28

    /// Around the head that carries the presentation toggle.
    static let headPadding: CGFloat = ArgoSpacing.comfortable

    /// The x a dot in this zone and column lands on. Arithmetic rather than a table, so a column
    /// nobody has rendered yet still lands where the design put it.
    static func x(inZone zone: WorkRoomProjection.Route.Zone, column: Int) -> CGFloat {
        guard zone != .behind else { return originX }
        return originX + behindStep + CGFloat(column) * columnStep
    }

    static func y(atRow row: Int) -> CGFloat {
        originY + CGFloat(row) * rowPitch
    }

    /// The x the NOW line stands on — back off the takeable column's dots by `nowLineLead`.
    static var nowLineX: CGFloat {
        x(inZone: .now, column: 0) - nowLineLead
    }
}

import ArgoDesign
import SwiftUI

/// What the searchable ticket picker is measured at (#1231). Beside the surface, per
/// `apps/macOS/AGENTS.md`: a measure is not a token.
///
/// The whole point of the ticket is that these numbers do not move with the backlog. A picker
/// measured off its content filled almost the window height once the backlog passed a hundred
/// open Tickets, and finding one meant reading many.
enum ArgoTicketPicker {
    /// Wide enough for a number mark and the opening words of a title, and no wider: a picker as
    /// wide as the longest title in the backlog is the same fault as one as tall as it is long.
    static let width: CGFloat = 320

    /// How tall one result row stands: a line of the row's own type with `snug` either side. It
    /// comes out near `ArgoComposerVessel.commandRowHeight` and is not that number — the composer's
    /// rows are set in the machine face and these are not.
    static var rowHeight: CGFloat {
        ArgoTypography.body.nominalLineBox.rounded(.up) + ArgoSpacing.snug * 2
    }

    /// How far the result list may grow before it scrolls inside itself: six rows, whatever the
    /// backlog holds. A ceiling and not a height — three matches are drawn three rows tall, rather
    /// than three rows over a band of nothing.
    static var listCeiling: CGFloat {
        rowHeight * 6
    }
}

import ArgoDesign
import SwiftUI

/// What the Tickets room's toolbar row is measured at (`cockpit-work-room.md` — the toolbar).
/// Beside the surface, per `apps/macOS/AGENTS.md`: a measure is not a token.
///
/// The row height is NOT here. It is the shell's existing titlebar strip and `ArgoToolbarVessel`
/// already names it, so a second number for the same band could only ever disagree with it.
///
/// The icon buttons and their capsule are not here either, for the same reason: `ArgoControlBox`
/// and `ArgoIconButtonGroup` own them for every header at once (#1243) — and the search field's
/// HEIGHT went the same way (#1242), because every container on this band is one height.
enum ArgoTicketsChrome {
    /// Wide enough for `Search the backlog`, and no wider — at 260 the field clipped the trailing
    /// edge at the 1280 window.
    static let searchWidth: CGFloat = 210

    /// What the field widens to while it holds a question (#1317).
    ///
    /// **Derived at the list pane's FLOOR, not at the 1280 window.** #1242 moved the field out of
    /// the window's row and onto the list pane's own band, so the edge it has to clear is the
    /// pane's — and the pane is draggable, which the window's trailing edge is not. At
    /// `ArgoLayout.backlogWidths.lowerBound` (342), less the band's two insets, New ticket's own
    /// vessel and the minimum gap between them, 274 is what is left and this asks for 268.
    ///
    /// A CEILING and not the width. Six points of margin is thin, so what the field actually takes
    /// is `askWidth(inPaneOf:)` — the design's `min(268, what the pane affords)`.
    static let askWidth: CGFloat = 268

    /// The question field's width in a list pane of `pane` points: what it asks for, or what is
    /// left beside New ticket, whichever is less.
    ///
    /// Floored at `searchWidth`, which is the one case the design leaves implicit: below the
    /// pane's own floor there is no pane to afford anything, and a question field NARROWER than
    /// the term field it grew out of would shrink as the reader typed into it.
    static func askWidth(inPaneOf pane: CGFloat) -> CGFloat {
        let besideNewTicket = pane
            - ArgoBacklogList.bandInsetX * 2
            - ArgoControlBox.vessel
            - ArgoSpacing.base
        return max(searchWidth, min(askWidth, besideNewTicket))
    }

    /// The New ticket composer's body field, in lines. Reserved rather than grown into: a field
    /// that expanded as you typed would move the two buttons under it while you were reading them.
    static let composerBodyLines = 6
}

import ArgoDesign
import SwiftUI

/// What the Tickets room's toolbar row is measured at (`cockpit-work-room.md` — the toolbar).
/// Beside the surface, per `rules/swift.md`: a measure is not a token.
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

    /// The New ticket composer's body field, in lines. Reserved rather than grown into: a field
    /// that expanded as you typed would move the two buttons under it while you were reading them.
    static let composerBodyLines = 6
}

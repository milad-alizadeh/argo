import ArgoDesign
import SwiftUI

/// What the Tickets room's toolbar row is measured at (`cockpit-work-room.md` — the toolbar).
/// Beside the surface, per `rules/swift.md`: a measure is not a token.
///
/// The row height is NOT here. It is the shell's existing titlebar strip and `ArgoToolbarVessel`
/// already names it, so a second number for the same band could only ever disagree with it.
///
/// The icon buttons and their capsule are NOT here either. This row measured its own box, three
/// other headers measured three more, and one mark read as four different controls (#1243) —
/// `ArgoControlBox` and `ArgoIconButtonGroup` own all of it now.
enum ArgoTicketsChrome {
    /// Wide enough for `Search the backlog`, and no wider — at 260 the field clipped the trailing
    /// edge at the 1280 window.
    static let searchWidth: CGFloat = 210
    /// The field is shorter than the icon vessels beside it: it holds one line of type, where they
    /// hold a mark plus the vessel's own inset.
    static let searchHeight: CGFloat = 28

    /// The New ticket composer's body field, in lines. Reserved rather than grown into: a field
    /// that expanded as you typed would move the two buttons under it while you were reading them.
    static let composerBodyLines = 6
}

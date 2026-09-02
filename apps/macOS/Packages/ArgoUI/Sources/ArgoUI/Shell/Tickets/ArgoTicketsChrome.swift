import ArgoDesign
import SwiftUI

/// What the Tickets room's toolbar row is measured at (`cockpit-work-room.md` — the toolbar).
/// Beside the surface, per `rules/design-system.md`: a measure is not a token.
///
/// The row height is NOT here. It is the shell's existing titlebar strip and `ArgoToolbarVessel`
/// already names it, so a second number for the same band could only ever disagree with it.
enum ArgoTicketsChrome {
    /// One icon button's slot. Wider than it is tall — a mark centred in a square sat pinched
    /// against a capsule's end cap.
    static let iconButtonWidth: CGFloat = 26
    static let iconButtonHeight: CGFloat = 24

    /// The capsule's own padding round its buttons. It belongs to the VESSEL and not to the button
    /// inside it: spent as button padding, a lone icon in a vessel of its own drew a capsule a
    /// third wider than one holding two.
    static let vesselInset: CGFloat = 3
    /// Between two buttons sharing one vessel. Tighter than any rung of `ArgoSpacing`, and
    /// deliberately: these are segments of one control, not two controls side by side.
    static let vesselGap: CGFloat = ArgoSpacing.hair

    /// The rule inside a vessel, between the segments of one control — the Start verb and the two
    /// link icons past it.
    static let splitDividerHeight: CGFloat = 15

    /// Wide enough for `Search the backlog`, and no wider — at 260 the field clipped the trailing
    /// edge at the 1280 window.
    static let searchWidth: CGFloat = 210
    /// The field is shorter than the icon vessels beside it: it holds one line of type, where they
    /// hold a mark plus the vessel's own inset.
    static let searchHeight: CGFloat = 28

    /// The New ticket composer's body field, in lines. Reserved rather than grown into: a field
    /// that expanded as you typed would move the two buttons under it while you were reading them.
    static let composerBodyLines = 6

    /// The mark on every toolbar button. `ArgoIconSize.control` and not the design's 14: 14 is the
    /// SVG box the study drew its icons into, where `control` is the rung the contract already
    /// gives "a control's own mark" — and a fourth rung would be a token change this room has no
    /// standing to make.
    static let iconSize: ArgoIconSize = .control
}

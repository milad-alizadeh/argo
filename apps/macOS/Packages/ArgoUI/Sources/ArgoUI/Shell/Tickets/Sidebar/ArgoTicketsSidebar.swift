import SwiftUI

/// What the Tickets room's sidebar is measured at (`docs/designs/cockpit-work-room.md` — the
/// sidebar,
/// views not tickets). Beside the surface rather than in the contract: a measure read by one
/// surface is not a token (`rules/design-system.md`).
enum ArgoTicketsSidebar {
    /// A FLOOR, not a frame: macOS scales sidebar row height with the reader's own setting, and a
    /// frame would refuse it — the same reason `ArgoRosterFoot.minimumHeight` is one.
    static let viewRowHeight: CGFloat = 26
    /// The column a view's mark is drawn in, so every view name starts on one vertical.
    static let glyphWidth: CGFloat = 14
    /// The row's leading inset, before the mark.
    static let gutter: CGFloat = ArgoSpacing.comfortable
    /// The Next-up card off the sidebar's edges, which is half of what stops it reading as a row.
    static let heroInset: CGFloat = ArgoSpacing.base
    /// The card's own inner padding.
    static let heroPadding: CGFloat = ArgoSpacing.comfortable
    /// Under the card, where the scroll ends. A step over `heroInset` so the card sits clear of the
    /// hairline the provider foot draws rather than centred between two edges it does not share.
    static let heroFootInset: CGFloat = ArgoSpacing.comfortable
    /// Above and below the provider chip at the foot, and at its two ends.
    static let footPaddingY: CGFloat = ArgoSpacing.base
    static let footPaddingX: CGFloat = ArgoSpacing.comfortable
}

import ArgoDesign
import SwiftUI

/// What the Tickets room's sidebar is measured at (`docs/designs/cockpit-work-room.md` — the
/// sidebar, views not tickets). Beside the surface rather than in the contract: a measure read by
/// one surface is not a token (`rules/swift.md`).
enum ArgoTicketsSidebar {
    /// A FLOOR, not a frame: macOS scales sidebar row height with the reader's own setting, and a
    /// frame would refuse it — the same reason `ArgoRosterFoot.minimumHeight` is one.
    static let viewRowHeight: CGFloat = 26
    /// The column a view's mark is drawn in, so every view name starts on one vertical.
    static let glyphWidth: CGFloat = 14
    /// The rail's ONE horizontal inset, and the only measure anything here is set off.
    ///
    /// OBSERVED, not documented: `.listStyle(.sidebar)` insets its rows' content, and this is that
    /// inset MEASURED off the `ticketsRoom` render — the mark, the count, the rule and the card's
    /// border all standing on 16 with nothing here spending it. AppKit publishes no number, so
    /// nothing may be derived from this one: a row spends nothing to sit on the rail, and what is
    /// outside the `List` — the provider foot — spends it by hand. `.listRowInsets(EdgeInsets())`
    /// on the hero zeroes the ROW's own insets and the platform's own stays, which is why the card
    /// lands on that same vertical rather than at the sidebar's edge.
    ///
    /// If AppKit ever moves it, the foot drifts off the rows silently — no gate can see it, so it
    /// is a `/pixel-review` catch. That is the cost of the alternative being a hand-set inset on
    /// every row, fighting the platform's own for the same 16.
    static let railInset: CGFloat = ArgoSpacing.loose
    /// The card's own inner padding.
    static let heroPadding: CGFloat = ArgoSpacing.comfortable
    /// OVER the card, off the rule the views end at, and vertical only — the card's left and right
    /// are the rail's, not its own.
    static let heroTopInset: CGFloat = ArgoSpacing.base
    /// Under the card, where the scroll ends. A step over `heroTopInset` so the card sits clear of
    /// the hairline the provider foot draws rather than centred between two edges it does not
    /// share.
    static let heroFootInset: CGFloat = ArgoSpacing.comfortable
    /// Above and below the provider chip at the foot, and at its two ends.
    static let footPaddingY: CGFloat = ArgoSpacing.base
    static let footPaddingX: CGFloat = railInset
}

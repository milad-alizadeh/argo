import SwiftUI

/// Fixed measures that define the shell's structural proportions — the panes the window is divided
/// into and the splits between them. A measure read by ONE surface belongs beside that surface
/// instead (`rules/design-system.md`); what is here describes the window, which is every surface
/// and therefore no single one.
public enum ArgoLayout {
    public static let windowMinimumWidth: CGFloat = 960
    public static let windowMinimumHeight: CGFloat = 600
    public static let sidebarMinimumWidth: CGFloat = 280
    public static let sidebarIdealWidth: CGFloat = 320
    /// The size the window opens at (`ArgoApp`'s `defaultSize`) — the width a specimen renders a
    /// pane at when it is showing the ordinary case rather than the narrowest one.
    public static let windowIdealWidth: CGFloat = 1280
    /// The other half of that opening size.
    public static let windowIdealHeight: CGFloat = 800
    public static let sidebarMaximumWidth: CGFloat = 420

    /// How much of the detail pane the centred Session title may take before it ellipsizes
    /// (#691, `docs/designs/cockpit-session-header.md`). It protects the title from colliding with
    /// the scope capsule and the rooms capsule, pinned to opposite edges of the bar.
    ///
    /// Must stay under a half: the title is centred, so it spends this on BOTH sides of the pane's
    /// midpoint.
    public static let titlebarTitleMaximumShare: CGFloat = 0.46

    /// The Instrument Deck's one chrome zone (`docs/designs/cockpit-session-header.md`). Not the
    /// header's alone: the canopy below is derived from it, and the deck insets its zones by that.
    public static let deckTabSlotHeight: CGFloat = 40

    /// What the glass canopy covers, and so how far the zones beneath it are inset. Derived, so a
    /// zone added to the canopy cannot miss the inset.
    public static var deckCanopyHeight: CGFloat {
        deckTabSlotHeight
    }

    /// The overview lane's share of the reading it maps. Its compression is
    /// `laneWidth / feedColumnWidth`, so a share holds that ratio steady where a fixed slot would
    /// move it with every seam. Private because the share is not the answer any caller wants —
    /// `minimapLaneWidth(sharing:)` is, and it is the only thing that may spend it.
    private static let minimapLaneShare: CGFloat = 0.15
    /// Where that share stops. Under the floor the lane is no longer a map of anything; over the
    /// ceiling it takes reading width to say nothing more.
    public static let minimapLaneWidths: ClosedRange<CGFloat> = 72 ... 120

    /// The lane's width beside a feed, given what the two of them have between them — the deck less
    /// the rail and its seam.
    public static func minimapLaneWidth(sharing span: CGFloat) -> CGFloat {
        seated(span * minimapLaneShare, in: minimapLaneWidths)
    }

    /// How far the rail may be dragged. It stops well before nothing.
    public static let railWidths: ClosedRange<CGFloat> = 180 ... 400
    /// What a column of this app's prose stops being readable under. Every pane that holds prose
    /// takes its floor from here, so the three cannot drift to three different answers to one
    /// question.
    public static let proseColumnMinimumWidth: CGFloat = 320
    /// The narrowest the feed may be squeezed to by its neighbours. Read against the lane at ITS
    /// narrowest, because the two shrink together — see `minimapLaneWidth(sharing:)`.
    public static let feedMinimumWidth = proseColumnMinimumWidth
    /// The square a small mark answers clicks over (`argoHitTarget`). The mark keeps its rung; this
    /// is the shape UNDER it, which is what a pointer actually has to find — the same distinction
    /// `seamGrabWidth` draws for a hairline.
    public static let controlHitTarget: CGFloat = 24
    /// A draggable seam's hit area. The line stays a hairline; this is the width of the invisible
    /// strip over it, which is what a pointer actually has to find.
    public static let seamGrabWidth: CGFloat = 9

    /// The evidence panel, opened by a call in the feed. It opens at HALF of the rail-and-feed
    /// span — everything the deck has that is not the minimap — and is dragged from there. Under
    /// this floor it cannot show a line of output without wrapping it.
    public static let evidencePanelMinimumWidth = proseColumnMinimumWidth
    public static let evidencePanelShare: CGFloat = 0.5

    /// How wide the panel may be in a deck of a given width. The ceiling carries the invariant:
    /// whatever the reader drags the seam to, the feed is left `feedMinimumWidth`. The rail and
    /// the minimap are both shut while the panel is up, so the feed's floor is the only one to
    /// leave room for — and at the narrowest window it has to be, since two 320s and the minimap
    /// do not fit in the 680 a 960 window leaves the deck.
    public static func evidencePanelLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        let floor = evidencePanelMinimumWidth
        let ceiling = deck - feedMinimumWidth
        return floor ... max(floor, ceiling)
    }

    /// How wide the rail may be dragged in a deck of a given width. The ceiling carries the
    /// invariant: whatever the reader drags to, the feed is left `feedMinimumWidth` with the lane
    /// at its own floor beside it. The rail's seam counts, because the lane's share is taken from
    /// what is left after it.
    public static func railLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        seamLimits(
            railWidths,
            leaving: minimapLaneWidths.lowerBound + feedMinimumWidth + seamGrabWidth,
            in: deck,
        )
    }

    /// The Tickets room's two panes. The backlog OPENS at `ArgoBacklogList.width` — the measure the
    /// twelve real titles were chosen against — and the reader drags it from there.
    /// The floor is #836's derivation, kept: the narrowest window, less the sidebar, less a pane of
    /// prose, less the two seams between the three — the split view's divider and the deck's own.
    /// Derived so it moves with the widths it is the remainder of rather than going stale beside
    /// them. It arrived as the width the list YIELDS to when the window cannot afford 520, which is
    /// the same question a seam's floor asks, so the seam took it over rather than naming a second
    /// number for it (`ArgoBacklogList.minimumWidth` now reads this).
    public static let backlogWidths: ClosedRange<CGFloat> =
        (windowMinimumWidth - sidebarMinimumWidth - proseColumnMinimumWidth - seamGrabWidth * 2)
            ... 760
    /// The narrowest the ticket detail may be squeezed to by the backlog beside it.
    public static let ticketDetailMinimumWidth = proseColumnMinimumWidth

    /// How wide the backlog may be dragged in a deck of a given width, carrying the same invariant
    /// `railLimits(in:)` does: whatever the reader drags to, the ticket detail keeps its floor.
    public static func backlogLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        seamLimits(backlogWidths, leaving: ticketDetailMinimumWidth + seamGrabWidth, in: deck)
    }

    /// How far a seam may travel: the zone's own range, with the ceiling pulled in far enough that
    /// what shares the deck with it keeps its floor. The FLOOR wins a deck too narrow for both —
    /// a range whose ceiling fell under its floor is not a range.
    private static func seamLimits(
        _ widths: ClosedRange<CGFloat>, leaving taken: CGFloat, in deck: CGFloat,
    )
        -> ClosedRange<CGFloat> {
        widths.lowerBound ... max(widths.lowerBound, min(widths.upperBound, deck - taken))
    }

    /// A zone's width, seated inside its limits and on a whole point. A pointer reports in
    /// fractions of a point and a deck is measured in them; a column on a subpixel offset
    /// re-typesets every line in it, which is prose shimmering while a seam is held. The limits
    /// are seated inward too, or a ceiling from a fractional deck width re-adds the fraction.
    public static func seated(_ width: CGFloat, in limits: ClosedRange<CGFloat>) -> CGFloat {
        let floor = limits.lowerBound.rounded(.up)
        let ceiling = max(floor, limits.upperBound.rounded(.down))
        return min(max(width.rounded(), floor), ceiling)
    }
}

import SwiftUI

/// Fixed measures that define the shell's structural proportions.
public enum ArgoLayout {
    public static let windowMinimumWidth: CGFloat = 960
    public static let windowMinimumHeight: CGFloat = 600
    public static let sidebarMinimumWidth: CGFloat = 280
    public static let sidebarIdealWidth: CGFloat = 320
    public static let sidebarMaximumWidth: CGFloat = 420
    public static let statusDotSize: CGFloat = 6
    public static let connectionSlotWidth: CGFloat = 180
    /// A floor and a ceiling rather than one width. The chip's longest reading names a provider,
    /// an identity and a state — and an account-level failure truncated to `GitHub · wor…` names
    /// neither the identity that broke nor the one to reconnect, which is the whole thing the
    /// account level exists to say. The ceiling keeps a provider's own long sentence from taking
    /// the deck's whole leading edge.
    public static let connectionSlotMaximumWidth: CGFloat = 320
    public static let gitVesselMaximumWidth: CGFloat = 280

    /// How tall a container on the toolbar is, measured off a render. A control drawing a
    /// container of its OWN cannot inherit it from the toolbar, which sizes its own glass.
    public static let toolbarVesselHeight: CGFloat = 36

    // The Project half of the toolbar's scope capsule: wider than the checkout half, which
    // carries only a branch.
    public static let projectVesselMaximumWidth: CGFloat = 220
    public static let scopeDividerHeight: CGFloat = 16
    /// The Project drawer. Wide enough for a full name over a home-relative path, and no wider.
    public static let projectDrawerWidth: CGFloat = 340
    /// The Connect panel. Wide enough for a row naming a provider, an identity and a scope on one
    /// line, and no wider.
    public static let connectPanelWidth: CGFloat = 560
    /// The device code's own line. A fixed slot rather than the code's intrinsic width: a slot
    /// that resized with the code would move the button under it.
    public static let deviceCodeWidth: CGFloat = 200

    /// The ⋯ menu's slot in a drawer row. Explicit, because a borderless menu sizes to its own
    /// chrome rather than to its glyph, and that chrome is wider on the trailing side — which put
    /// the mark 4pt further from the panel edge than the icon column is on the other side.
    public static let rowMenuWidth: CGFloat = 16

    /// The roster's archive header. A FLOOR, not a height: macOS scales sidebar row height with the
    /// reader's own sidebar size setting, and a frame here would refuse it
    /// (`docs/designs/cockpit-roster-archive-foot.md`).
    public static let rosterFootMinimumHeight: CGFloat = 22

    // The Instrument Deck's zones, measured off the approved study
    // (`docs/designs/cockpit-sessions-liquid-glass.png`) — the decision log carries no
    // measurements, so the pixels are the only source for these.
    public static let deckHeaderHeight: CGFloat = 56
    public static let deckTabSlotHeight: CGFloat = 40

    /// The context instrument on the header's trailing edge. Fixed, not a share of the line: the
    /// branch beside it is what gives way (#502), and a shrinking instrument would move its two
    /// threshold ticks on every resize.
    public static let contextInstrumentWidth: CGFloat = 200
    /// Thin enough to read as a gauge rather than as a control — nothing here is draggable.
    public static let contextBarHeight: CGFloat = 3
    /// How far a threshold tick stands proud of the bar on each side. Without the overshoot a
    /// hairline inside a 3pt bar is indistinguishable from the fill's own edge.
    public static let contextBarTickOvershoot: CGFloat = 2
    /// The ⓘ panel. Wide enough for a sentence at the caption size and no wider.
    public static let contextGuideWidth: CGFloat = 320
    /// The threshold column in that panel, so the two meanings beside it start on one edge.
    public static let contextGuideThresholdWidth: CGFloat = 74
    /// Where the rail opens — a starting width, not a fixed one; the seam beside it moves.
    public static let agentsRailWidth: CGFloat = 256
    /// Xcode's measure, near enough.
    public static let minimapLaneWidth: CGFloat = 112

    /// How far the rail may be dragged. It stops well before nothing.
    public static let railWidths: ClosedRange<CGFloat> = 180 ... 400
    /// The narrowest the feed may be squeezed to by its neighbours.
    public static let feedMinimumWidth: CGFloat = 320
    /// A draggable seam's hit area. The line stays a hairline; this is the width of the invisible
    /// strip over it, which is what a pointer actually has to find.
    public static let seamGrabWidth: CGFloat = 9

    /// The evidence panel, opened by a call in the feed. It opens at HALF of the rail-and-feed
    /// span — everything the deck has that is not the minimap — and is dragged from there. Under
    /// this floor it cannot show a line of output without wrapping it.
    public static let evidencePanelMinimumWidth: CGFloat = 320
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

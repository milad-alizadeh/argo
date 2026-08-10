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
    public static let gitVesselMaximumWidth: CGFloat = 280

    /// How tall a container on the toolbar is. The two vessels get this from the toolbar, which
    /// sizes its own glass and not to their content; a control drawing a container of its OWN has
    /// nothing to inherit it from, so the number lives here and is measured off a render rather
    /// than guessed — two container heights on one bar is the first thing a reader sees.
    public static let toolbarVesselHeight: CGFloat = 36

    // The toolbar's scope cluster: the Project and its checkout in one capsule. The Project half
    // is the wider of the two because it carries a full name rather than a branch.
    public static let projectVesselMaximumWidth: CGFloat = 220
    public static let scopeDividerHeight: CGFloat = 16
    /// The Project drawer. Wide enough for a full name over a home-relative path, and no wider —
    /// it hangs off a toolbar control, not over the window.
    public static let projectDrawerWidth: CGFloat = 340
    /// The ⋯ menu's slot in a drawer row. Explicit, because a borderless menu sizes to its own
    /// chrome rather than to its glyph, and that chrome is wider on the trailing side — which put
    /// the mark 4pt further from the panel edge than the icon column is on the other side.
    public static let rowMenuWidth: CGFloat = 16

    // The Instrument Deck's zones, measured off the approved study
    // (`docs/designs/cockpit-sessions-liquid-glass.png`) — the decision log carries no
    // measurements, so the pixels are the only source for these.
    public static let deckHeaderHeight: CGFloat = 56
    public static let deckTabSlotHeight: CGFloat = 40

    /// The context instrument on the header's trailing edge: a label and a reading over a bar.
    ///
    /// A fixed width rather than a share of the line, because it is the thing the line must NOT
    /// give — the branch beside it is what gives way (#502, story 25), and an instrument that
    /// shrank with the window would move its two threshold ticks on every resize.
    public static let contextInstrumentWidth: CGFloat = 200
    /// Thin enough to read as a gauge rather than as a control: nothing here is draggable, and a
    /// bar the height of a scrollbar invites a grab.
    public static let contextBarHeight: CGFloat = 3
    /// How far a threshold tick stands proud of the bar on each side. Without the overshoot a
    /// hairline inside a 3pt bar is indistinguishable from the fill's own edge.
    public static let contextBarTickOvershoot: CGFloat = 2
    /// The ⓘ panel. Wide enough for a sentence at the caption size and no wider — it hangs off a
    /// 10pt glyph, not over the deck.
    public static let contextGuideWidth: CGFloat = 320
    /// The threshold column in that panel, so the two meanings beside it start on one edge.
    public static let contextGuideThresholdWidth: CGFloat = 74
    /// Where the rail opens. It is a starting width now rather than a fixed one — the seam beside
    /// it moves.
    public static let agentsRailWidth: CGFloat = 256
    /// Xcode's measure, near enough. The lane was 56 while it held a placeholder, which is wide
    /// enough for a label turned on its side and not for a map of a file.
    public static let minimapLaneWidth: CGFloat = 112

    /// How far the rail may be dragged. It stops well before nothing: a zone dragged shut is a
    /// surface with no way back except guessing where its seam went.
    public static let railWidths: ClosedRange<CGFloat> = 180 ... 400
    /// The narrowest the feed is allowed to be squeezed to by its neighbours. Under this a line of
    /// prose stops being a line and the column stops being worth reading.
    public static let feedMinimumWidth: CGFloat = 320
    /// A draggable seam's hit area. The line stays a hairline; this is the width of the invisible
    /// strip over it, which is what a pointer actually has to find.
    public static let seamGrabWidth: CGFloat = 9

    /// The evidence panel, opened by a call in the feed.
    ///
    /// It opens at HALF of the rail-and-feed span — everything the deck has that is not the minimap
    /// — and is dragged from there. Narrower than this floor it stops being able to show a line of
    /// output without wrapping it, which is the one thing it exists to do.
    public static let evidencePanelMinimumWidth: CGFloat = 320
    public static let evidencePanelShare: CGFloat = 0.5

    /// How wide the panel may be in a deck of a given width — the split's half of the measure
    /// invariants, which is why it lives here beside the floors rather than inside the view.
    ///
    /// The ceiling is what carries the claim: whatever the reader drags the seam to, the feed is
    /// left `feedMinimumWidth`. The rail and the minimap are both shut while the panel is up, so
    /// the feed's floor is the only one to leave room for — and at the narrowest window it has to
    /// be, since two 320s and the minimap do not fit in the 680 a 960 window leaves the deck.
    public static func evidencePanelLimits(in deck: CGFloat) -> ClosedRange<CGFloat> {
        let floor = evidencePanelMinimumWidth
        let ceiling = deck - feedMinimumWidth
        return floor ... max(floor, ceiling)
    }

    /// A zone's width, seated where it can actually be drawn: inside its limits, and on a whole
    /// point.
    ///
    /// The rounding is the load-bearing half. A pointer reports in fractions of a point and a deck
    /// is measured in them, so a zone that takes either straight through lands its column on a
    /// subpixel offset — and a column on a subpixel offset re-typesets every line in it, which is
    /// prose shimmering for as long as a seam is held. Whole points cost a drag nothing anybody can
    /// see.
    ///
    /// The limits are seated too, inward on both sides: a ceiling derived from a fractional deck
    /// width would otherwise be the fraction the rounding just took out.
    public static func seated(_ width: CGFloat, in limits: ClosedRange<CGFloat>) -> CGFloat {
        let floor = limits.lowerBound.rounded(.up)
        let ceiling = max(floor, limits.upperBound.rounded(.down))
        return min(max(width.rounded(), floor), ceiling)
    }
}

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

    // The toolbar's scope cluster: the Project and its checkout in one capsule. The Project half
    // is the wider of the two because it carries a full name rather than a branch.
    public static let projectVesselMaximumWidth: CGFloat = 220
    public static let scopeDividerHeight: CGFloat = 16
    /// A disclosure chevron's ink height. Below every label glyph on purpose — see
    /// `ArgoGlyph.init(indicator:height:)`.
    public static let disclosureHeight: CGFloat = 5
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
    public static let agentsRailWidth: CGFloat = 256
    public static let minimapLaneWidth: CGFloat = 56
    public static let deckDockHeight: CGFloat = 40
}

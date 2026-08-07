import SwiftUI

/// Fixed measures that define the shell's structural proportions.
public enum ArgoLayout {
    public static let windowMinimumWidth: CGFloat = 960
    public static let windowMinimumHeight: CGFloat = 600
    public static let sidebarMinimumWidth: CGFloat = 280
    public static let sidebarIdealWidth: CGFloat = 320
    public static let sidebarMaximumWidth: CGFloat = 420
    public static let projectStripWidth: CGFloat = 52
    public static let projectMarkSize: CGFloat = 32
    public static let statusDotSize: CGFloat = 6
    public static let connectionSlotWidth: CGFloat = 180
    public static let gitVesselMaximumWidth: CGFloat = 280

    // The Instrument Deck's zones. Measured off the approved study
    // (`docs/designs/cockpit-sessions-liquid-glass.png`), because the decision log carries
    // hex values and no measurements — the rhythm exists only as pixels.
    public static let deckHeaderHeight: CGFloat = 56
    public static let deckTabSlotHeight: CGFloat = 40
    public static let agentsRailWidth: CGFloat = 256
    public static let minimapLaneWidth: CGFloat = 56
    public static let dockSeamHeight: CGFloat = 40
}

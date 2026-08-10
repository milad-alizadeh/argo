import SwiftUI

/// What ink a context tier is drawn in — the one place the instrument, its bar and the ⓘ panel all
/// ask, so the three cannot drift into three shades of the same alarm.
///
/// Amber and red are ROLES here, never hues: a tier borrows the operational state that already
/// means "needs you" and "went wrong", so the header cannot drift away from the dot on the roster
/// row beside it. Its own file rather than a block inside one of the three views, because a
/// mapping two of them import is not a detail of either.
extension SessionHeaderProjection.Context.Tier {
    var operationalState: ArgoOperationalState {
        switch self {
        case .okay: .running
        case .warn: .attention
        case .crit: .failure
        }
    }

    func tint(in palette: ArgoPalette) -> ArgoColor {
        operationalState.tint(in: palette)
    }

    /// The READING's ink, which is not the bar's. `okay` is set in the ordinary metadata ink rather
    /// than in the running green: a reading that celebrates is a reading the eye stops sorting from
    /// the facts beside it, and the whole point of the instrument is that it is quiet until it is
    /// not. The bar keeps the tint, where a fill has nothing else to say with.
    func readingInk(in palette: ArgoPalette) -> ArgoColor {
        switch self {
        case .okay: palette.text.secondary
        case .warn, .crit: tint(in: palette)
        }
    }
}

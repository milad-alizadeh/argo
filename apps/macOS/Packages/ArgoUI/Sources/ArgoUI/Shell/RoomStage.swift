import SwiftUI

/// Keeps a room's view mounted through a switch, so what SwiftUI would otherwise destroy — the
/// feed's `NSTableView`, the measured heights, a scroll offset — survives it. `InstrumentDeckShell`
/// and the sidebar hold all their rooms in one `ZStack` and gate each with this, rather than a
/// `switch`/`if let` that gives the branch left behind a fresh identity on the way back (#1356).
///
/// Ground alone carries the room that is on screen: no accent, and no destruction either.
extension View {
    func room(isActive: Bool) -> some View {
        opacity(isActive ? 1 : 0)
            .allowsHitTesting(isActive)
            .accessibilityHidden(!isActive)
    }
}

import SwiftUI

/// Keeps a room's view mounted through a switch, so what SwiftUI would otherwise destroy — the
/// feed's `NSTableView`, the measured heights, a scroll offset — survives it. `InstrumentDeckShell`
/// and the sidebar hold all their rooms in one `ZStack` and gate each with this, rather than a
/// `switch`/`if let` that gives the branch left behind a fresh identity on the way back (#1356).
///
/// Ground alone carries the room that is on screen: no accent, and no destruction either.
extension View {
    func room(isActive: Bool) -> some View {
        // `Group` is NOT a `ZStack`: in a `NavigationSplitView` column it STACKS its rooms and
        // divides the height between them, so a mounted-but-invisible room was taking half the
        // sidebar and the roster stopped drawing halfway down it (#1404). A room that is not on
        // screen asks for no height; the one that is takes the column. Kept a frame rather than an
        // `if`, because the whole point of this stage is that the view stays mounted (#1356).
        frame(maxHeight: isActive ? .infinity : 0)
            .opacity(isActive ? 1 : 0)
            .allowsHitTesting(isActive)
            .accessibilityHidden(!isActive)
    }
}

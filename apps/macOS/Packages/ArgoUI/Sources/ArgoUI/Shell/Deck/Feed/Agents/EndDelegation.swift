import SwiftUI

extension EnvironmentValues {
    /// Stop waiting for one backgrounded delegation's report (#1267), by the delegating call's own
    /// id. Travels in the environment rather than through the four views between the shell and the
    /// chip that offers it — `argoOpenSession`'s road, for its reason.
    ///
    /// Bound to the SELECTED Session above the deck, so nothing below has to carry an id: the rail
    /// draws one Session's delegations, and the act reaches the same one the reader is looking at.
    ///
    /// Inert by default, so every specimen and `#Preview` draws the menu entry without a Hub behind
    /// it, and a rail rendered outside the shell cannot end a delegation nobody is holding.
    @Entry var argoEndDelegation: @MainActor @Sendable (String) -> Void = { _ in }
}

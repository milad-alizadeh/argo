import ArgoEngine
import SwiftUI

/// What the deck's one vessel DOES — the closures that reach the selected Session, beside the
/// `DeckVessel` value that says what is drawn. Every intent is inert by default, so a specimen
/// renders the vessel without a terminal behind it.
struct DeckIntents {
    /// One Turn to the shown Session; refusals are thrown back and the composer's seam repeats
    /// them.
    var send: ComposerSend = { _, _ in }
    /// The answer to the Permission in the slot.
    var decide: (PermissionDecision) -> Void = { _ in }
    /// Taking back one of the Session's standing allows, by tool (#572). Reached from BOTH the
    /// composer and the prompt, because either can draw the tray.
    var revoke: (String) -> Void = { _ in }
    /// Stopping the Turn in flight (#541); a Session blocked on a Permission has nothing to stop.
    var stop: () throws -> Void = {}
    /// Putting the Session on a rung of the Mode ladder (#545); refused rungs reach the seam.
    /// Async because the port's walk is: the ring is stepped one keystroke at a time (#653).
    var setMode: (SessionMode) async throws -> Void = { _ in }
    /// The exit the undriveable line offers: a fresh Session in the shown one's folder.
    var spawnBeside: () async -> Void = {}
    /// What the composer is holding. A binding handed in from ABOVE the deck's Session identity:
    /// `.id(session)` discards everything under it on a switch, and an unsent draft must survive
    /// one (#539).
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    /// Controls that reach nothing, for a specimen or a `#Preview` with no Session behind them.
    @MainActor static let inert = DeckIntents()
}

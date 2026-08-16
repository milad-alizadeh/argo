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
    /// Saying the Turn reported lost has been put back in the field (#682), so the Hub stops
    /// reporting it. The composer's own act: it is the thing that took the news in.
    var lostTurnSeen: () -> Void = {}
    /// Stopping the Turn in flight (#541); a Session blocked on a Permission has nothing to stop.
    var stop: () throws -> Void = {}
    /// Putting the Session on a rung of the Mode ladder (#545); refused rungs reach the seam.
    /// Async because the port's walk is: the ring is stepped one keystroke at a time (#653).
    var setMode: (SessionMode) async throws -> Void = { _ in }
    /// The exit the undriveable line offers: a fresh Session in the shown one's folder.
    var spawnBeside: () async -> Void = {}
    /// Every skill installed for this Project (#685). A closure and not a value, because it is READ
    /// AFRESH each time the menu opens — that is what puts a skill installed mid-Session in the
    /// list with no watcher and no restart. The filesystem stays on this side of it: what the view
    /// holds is whatever value the last call answered.
    var commands: () -> CommandCatalog = { CommandCatalog.empty }
    /// Every file in the shown Session's Workspace (#687), read afresh the way `commands` is —
    /// which is what puts a file written mid-Session in the very next list. `async` because the
    /// tree can be enormous and the composer may not wait on it.
    var files: () async -> [String] = { [] }
    /// What the composer is holding. A binding handed in from ABOVE the deck's Session identity:
    /// `.id(session)` discards everything under it on a switch, and an unsent draft must survive
    /// one (#539).
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    /// Controls that reach nothing, for a specimen or a `#Preview` with no Session behind them.
    @MainActor static let inert = DeckIntents()
}

import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// How `ComposerBusyWindowTests` drives the vessel — the log it writes into, and the Session it
/// drives (#1636).
///
/// Beside the cases for the reason `ComposerReleaseTests+Vessel.swift` is: the cases are the
/// claims, and the scaffolding sitting in with them pushes a suite past its body ceiling.
@MainActor
extension ComposerBusyWindowTests {
    /// Every act the vessel made, in the order it made them, and the draft it wrote through.
    ///
    /// The ORDER is what this suite is about: #1636 is two Turns arriving as one, so a case has to
    /// be able to say which acts went and how many — a count of sends is the whole assertion.
    final class Log {
        var draft = ComposerDraft()
        var acts: [String] = []
    }

    /// The vessel over one Session at one status, writing through the log's draft.
    ///
    /// It carries the interrupt and the steer beside the send, because the boundary-after-steer
    /// case needs all three through ONE log: "delivered exactly once" is a claim about the order
    /// of three acts, and three separate logs could not make it.
    func composer(_ log: Log, at status: SessionStatus) -> SessionComposer {
        SessionComposer(
            composer: ComposerPutWaitTests.session(at: status),
            intents: DeckIntents(
                send: { text, _ in log.acts.append("send \(text)") },
                turn: SessionTurnIntents(
                    stop: { log.acts.append("interrupt") },
                    steer: { text, _ in log.acts.append("steer \(text)") },
                ),
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }

    /// The reader typing a Turn and pressing Return, through the act the field makes — never
    /// `ComposerDraft.submit(whileTurnInFlight:)` directly. Where the Turn GOES is the whole
    /// subject here, and a case that stated the flag itself would prove nothing.
    func type(_ text: String, in log: Log, at status: SessionStatus) {
        log.draft.text = text
        composer(log, at: status).submit()
    }
}

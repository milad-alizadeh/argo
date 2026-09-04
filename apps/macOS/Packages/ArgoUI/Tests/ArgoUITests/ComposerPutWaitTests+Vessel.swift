import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// How `ComposerPutWaitTests` drives the vessel — the log it writes into and the Session it drives
/// (#1337).
///
/// Beside the cases for the reason `ComposerReleaseTests+Vessel.swift` is: the cases are the
/// claims, and the scaffolding sitting in with them pushes a suite past its body ceiling.
@MainActor
extension ComposerPutWaitTests {
    /// What the vessel put, and the draft it wrote through.
    final class Log {
        var draft = ComposerDraft()
        var sent: [String] = []
    }

    /// The vessel over one Session at one status, writing through the log's draft.
    func composer(_ log: Log, at status: SessionStatus) -> SessionComposer {
        SessionComposer(
            composer: Self.session(at: status),
            intents: DeckIntents(
                send: { text, _ in log.sent.append(text) },
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }

    /// The specimen Session at one status, with the projection's own answer for the Turn's end —
    /// read off the projection rather than restated, so a case here cannot come to disagree with
    /// what the cockpit builds.
    static func session(at status: SessionStatus) -> SessionComposerProjection.Composer {
        var composer = status == .running ? ComposerSpecimen.running : ComposerSpecimen.composer
        composer.hasTurnEnded = SessionComposerProjection.hasTurnEnded(status)
        return composer
    }

    /// A follow-up typed while the Turn runs, put through the same act Return makes.
    func queue(_ text: String, in log: Log) {
        log.draft.text = text
        log.draft.submit(whileTurnInFlight: true) { _, _ in }
    }
}

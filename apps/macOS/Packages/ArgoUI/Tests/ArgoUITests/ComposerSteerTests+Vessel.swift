import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// How `ComposerSteerTests` drives the vessel — the log it writes into, the Session it drives, and
/// the follow-ups it queues to steer (#1238).
///
/// Beside the cases for the reason `ComposerReleaseTests+Vessel.swift` is: the cases are the
/// claims, and the scaffolding sitting in with them pushed the suite past its body ceiling.
@MainActor
extension ComposerSteerTests {
    /// What the vessel put and in what order, and the draft it wrote through.
    final class Log {
        var draft = ComposerDraft()
        var acts: [String] = []
    }

    func composer(
        _ log: Log,
        refusing interrupt: SessionDriveError? = nil,
        refusingSteer steer: SessionDriveError? = nil,
    )
        -> SessionComposer {
        SessionComposer(
            composer: Self.session(at: .running),
            intents: DeckIntents(
                turn: SessionTurnIntents(
                    stop: {
                        log.acts.append("interrupt")
                        if let interrupt {
                            throw interrupt
                        }
                    },
                    steer: { text, _ in
                        if let steer {
                            throw steer
                        }
                        log.acts.append("steer \(text)")
                    },
                ),
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }

    /// The specimen Session at one status, with the projection's own answer for the Turn's end.
    static func session(at status: SessionStatus)
        -> SessionComposerProjection.Composer {
        var composer = status == .running ? ComposerSpecimen.running : ComposerSpecimen.composer
        composer.hasTurnEnded = SessionComposerProjection.hasTurnEnded(status)
        return composer
    }

    /// Follow-ups typed while the Turn runs, through the act Return makes.
    func queue(_ texts: [String], in log: Log) {
        for text in texts {
            log.draft.text = text
            log.draft.submit(whileTurnInFlight: true) { _, _ in }
        }
    }
}

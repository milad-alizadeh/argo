import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// How `ComposerReleaseTests` drives the vessel — the log it writes into, the Session it drives,
/// and the replay of the two `onChange` watches that make up the release chain (#1238).
///
/// Beside the cases rather than among them: the cases are the claims, and a catalogue of
/// scaffolding sitting in with them pushed the suite past its body ceiling.
@MainActor
extension ComposerReleaseTests {
    /// What the vessel wrote and what it put, in the order it did — the ordering IS the claim in
    /// more than one case in the suite.
    final class Log {
        var draft = ComposerDraft()
        var sent: [String] = []
        var acts: [String] = []
    }

    /// The vessel over one Session at one status, writing through the log's draft.
    func composer(
        _ log: Log,
        at status: SessionStatus,
        refusing refusal: SessionDriveError? = nil,
    )
        -> SessionComposer {
        SessionComposer(
            composer: Self.composer(at: status),
            intents: DeckIntents(
                send: { text, _ in
                    if let refusal {
                        throw refusal
                    }
                    log.sent.append(text)
                    log.acts.append("send \(text)")
                },
                settings: SessionSettingIntents(setMode: { log.acts.append("walk \($0)") }),
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }

    /// The specimen Session, moved to the status the case is about. `hasTurnEnded` is read off the
    /// projection's own answer rather than restated, so a case here cannot come to disagree with
    /// what the cockpit builds.
    static func composer(at status: SessionStatus)
        -> SessionComposerProjection.Composer {
        var composer = status == .running ? ComposerSpecimen.running : ComposerSpecimen.composer
        composer.hasTurnEnded = SessionComposerProjection.hasTurnEnded(status)
        return composer
    }

    /// A follow-up typed while the Turn runs, put through the same act Return makes.
    func queue(_ text: String, in log: Log) {
        log.draft.text = text
        log.draft.submit(whileRunning: true) { _, _ in }
    }

    /// The vessel's own release chain, replayed over a walk of statuses — the two `onChange`
    /// modifiers on `SessionComposer.body`, and nothing else.
    ///
    /// Spelled here rather than driven through SwiftUI because nothing in a test can make SwiftUI
    /// render: what these cases claim is that the CHAIN releases the queue for every path the
    /// status takes, and the chain is these two watches over these two values.
    func walk(
        _ statuses: [SessionStatus],
        _ log: Log,
        refusing refusal: SessionDriveError? = nil,
    ) {
        // `nil` until the first reading, which is what `initial: true` means on the boundary.
        var lastEnded: Bool?
        var lastAwaiting: ComposerRelease.Awaiting?
        for status in statuses {
            let vessel = composer(log, at: status, refusing: refusal)
            let hasTurnEnded = Self.composer(at: status).hasTurnEnded
            if lastEnded != hasTurnEnded {
                vessel.turnEnded()
            }
            lastEnded = hasTurnEnded
            let awaiting = ComposerRelease.Awaiting(log.draft)
            if let lastAwaiting, lastAwaiting != awaiting {
                vessel.release()
            }
            lastAwaiting = awaiting
        }
    }
}

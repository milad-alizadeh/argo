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
    /// What the vessel put, in the order it put it, and the draft it wrote through.
    final class Log {
        var draft = ComposerDraft()
        var acts: [String] = []
    }

    /// The vessel over one Session at one status, writing through the log's draft. It carries the
    /// interrupt and the steer beside the send: the boundary-after-steer case reads all three acts
    /// in one order.
    func composer(_ log: Log, at status: SessionStatus) -> SessionComposer {
        SessionComposer(
            composer: Self.session(at: status),
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

    /// The specimen Session at one status, with the projection's own answer for the Turn's end —
    /// read off the projection rather than restated, so a case here cannot come to disagree with
    /// what the cockpit builds.
    ///
    /// `isTurnInFlight` is left at the specimen's default, which is the narrower reading: what the
    /// `asking` case rests on is that the real projection answers `false` there, and
    /// `SessionComposerInFlightTests` pins that off a whole `CockpitPresentation.Session`.
    static func session(at status: SessionStatus) -> SessionComposerProjection.Composer {
        var composer = status == .running ? ComposerSpecimen.running : ComposerSpecimen.composer
        composer.hasTurnEnded = SessionComposerProjection.hasTurnEnded(status)
        return composer
    }

    /// The reader typing a Turn and pressing Return, through the act the field makes — never
    /// `ComposerDraft.submit(whileTurnInFlight:)` directly. Where the Turn GOES is the whole
    /// subject here, and a case that stated the flag itself would prove nothing.
    func type(_ text: String, in log: Log, at status: SessionStatus) {
        log.draft.text = text
        composer(log, at: status).submit()
    }

    /// The same vessel over the REAL per-Session store, which is what production writes through
    /// (`CockpitView+Intents.swift`).
    ///
    /// Its own harness because the store is not a passive holder: it drops a draft that holds
    /// nothing (`ComposerDrafts.subscript`), so a claim left on an otherwise-empty draft does not
    /// survive one write-back through its binding. A `Log`'s bare `var draft` keeps everything and
    /// would call that bug green.
    func stored(_ drafts: ComposerDrafts, _ log: Log, at status: SessionStatus) -> SessionComposer {
        SessionComposer(
            composer: Self.session(at: status),
            intents: DeckIntents(
                send: { text, _ in log.acts.append("send \(text)") },
                draft: drafts.binding(for: Self.session(at: status).sessionID),
            ),
        )
    }

    /// Return, through the store's binding.
    func type(
        _ text: String,
        into drafts: ComposerDrafts,
        _ log: Log,
        at status: SessionStatus,
    ) {
        let id = Self.session(at: status).sessionID
        drafts[id].text = text
        stored(drafts, log, at: status).submit()
    }
}

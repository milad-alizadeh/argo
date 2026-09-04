import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI

/// How `ComposerRunFactsHeldTests` drives the vessel — beside the cases rather than among them,
/// for the reason `ComposerReleaseTests+Vessel.swift` is.
@MainActor
extension ComposerRunFactsHeldTests {
    final class Log {
        var draft = ComposerDraft()
        var acts: [String] = []
    }

    /// The projection alone, for the cases that read `ComposerRelease` directly rather than
    /// driving the vessel.
    ///
    /// `hasTurnEnded` is a THIRD state beside `isRunning`, for the reason the ticket's own trap
    /// names: a Permission or a question refuses `runFactsBusy` just as truly as a running Turn
    /// does, and neither is `isRunning`. Defaulted off `isRunning` for the ordinary running case,
    /// and overridden for the permission/asking one.
    func projection(
        isRunning: Bool = true,
        hasTurnEnded: Bool? = nil,
    )
        -> SessionComposerProjection.Composer {
        var projection = isRunning ? ComposerSpecimen.running : ComposerSpecimen.composer
        if let hasTurnEnded {
            projection.hasTurnEnded = hasTurnEnded
        }
        return projection
    }

    /// The vessel under test, over a Session whose ports answer however the case needs.
    func composer(
        _ log: Log,
        refusingModel: SessionDriveError? = SessionDriveError.runFactsBusy,
        refusingEffort: SessionDriveError? = SessionDriveError.runFactsBusy,
        refusingMode: SessionDriveError? = nil,
        isRunning: Bool = true,
        hasTurnEnded: Bool? = nil,
    )
        -> SessionComposer {
        SessionComposer(
            composer: projection(isRunning: isRunning, hasTurnEnded: hasTurnEnded),
            intents: DeckIntents(
                send: { text, _ in log.acts.append("send \(text)") },
                settings: SessionSettingIntents(
                    setMode: { mode in
                        log.acts.append("walk \(mode)")
                        if let refusingMode {
                            throw refusingMode
                        }
                    },
                    setModel: { model in
                        log.acts.append("model \(model)")
                        if let refusingModel {
                            throw refusingModel
                        }
                    },
                    setEffort: { effort in
                        log.acts.append("effort \(effort)")
                        if let refusingEffort {
                            throw refusingEffort
                        }
                    },
                ),
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }
}

@testable import ArgoEngine

/// The Hub's five delivery answers, written down instead of acted on.
@MainActor
final class DeliveryRecorder {
    var records: Int
    /// What the Session's screen says. `unheard` by default, which is the state every claim
    /// about silence here is set in: the composer is still holding the Turn.
    var echo = TurnEcho.unheard
    var canRetype = true
    var onRetype: (() -> Void)?
    private(set) var retyped = 0
    private(set) var submitted: [SessionTurnSubmission] = []
    private(set) var lost: [(text: String, sessionID: String)] = []

    init(records: Int) {
        self.records = records
    }

    var watch: TurnDelivery.Watch {
        TurnDelivery.Watch(
            says: TurnDelivery.Watch.Says(
                records: { [weak self] _ in self?.records ?? 0 },
                echo: { [weak self] _, _ in self?.echo ?? .unreadable },
            ),
            submitted: { [weak self] submission, _ in
                self?.submitted.append(submission)
            },
            retype: { [weak self] _ in
                guard let self, canRetype else { return false }
                retyped += 1
                onRetype?()
                return true
            },
            lost: { [weak self] text, sessionID in
                self?.lost.append((text: text, sessionID: sessionID))
            },
        )
    }
}

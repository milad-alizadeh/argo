@testable import ArgoEngine
import Foundation

/// One permission gate on its own, with the rung under the test's hand rather than the roster's —
/// the only way to move a Session's rung BETWEEN two calls without a live CLI to walk it (#663).
@MainActor
final class GateFixture {
    /// The rung the next call is judged by.
    var rung: SessionMode {
        get { observed.rung }
        set { observed.rung = newValue }
    }

    let socketPath: String

    /// Held apart from the fixture because the channel is handed a closure over the rung inside
    /// `init`, where `self` cannot yet be captured.
    private final class ObservedRung {
        var rung: SessionMode = .code
    }

    private let observed = ObservedRung()
    private let root: URL
    private let ledger = ClaimLedger()
    private let claim = SessionOwnership.ClaimID(value: "gate-\(UUID().uuidString.prefix(8))")
    private let channel: PermissionChannel

    init() throws {
        // Short, for the reason every companion root in these suites is: a `sockaddr_un` path is
        // 103 bytes.
        let token = String(UUID().uuidString.prefix(8))
        self.root = URL(fileURLWithPath: "/tmp/argo-g-\(token)", isDirectory: true)
        let observed = observed
        self.channel = PermissionChannel(
            scope: CompanionScope(under: root),
            ledger: ledger,
            rung: { _ in observed.rung },
        )
        self.socketPath = try channel.grant(claim)
    }

    /// What this claim's gate has published — the same reading the roster folds into a Session.
    var facts: ClaimFacts {
        ledger.facts(for: claim)
    }

    func remove() {
        channel.withdraw(claim)
        try? FileManager.default.removeItem(at: root)
    }
}

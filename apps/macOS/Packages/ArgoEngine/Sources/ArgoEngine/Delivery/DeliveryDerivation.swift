import Foundation

/// Assembling one Project's Deliveries per branch, from local git ∪ code host (`CONTEXT.md` L1 ·
/// Delivery).
///
/// The local half is taken from `WorkspaceProjection` and never from a second git read: the branch
/// is the join key (#259), and two readers of the same fact are two chances to disagree about it.
public actor DeliveryDerivation {
    /// Raised once a derivation has finished. Nothing above an actor can observe one, so a surface
    /// wired to the ledger alone would draw the strip as it was when the reader last clicked
    /// something.
    public typealias Landing = @Sendable () async -> Void

    private let port: CodeHostPort
    private let health: ConnectionHealthLedger
    private let deliveries: DeliveryLedger
    private let now: @Sendable () -> Date
    private var landed: Landing = {}

    public init(
        port: CodeHostPort,
        health: ConnectionHealthLedger,
        deliveries: DeliveryLedger,
        now: @escaping @Sendable () -> Date = Date.init,
    ) {
        self.port = port
        self.health = health
        self.deliveries = deliveries
        self.now = now
    }

    /// Tell the derivation who to raise on. Called before the first `derive`.
    public func report(to landed: @escaping Landing) {
        self.landed = landed
    }

    /// Everything one derivation needs beyond the target: the Workspaces the branches come from,
    /// and the assertions the join falls back to.
    public struct Locally: Sendable {
        public let workspaces: [WorkspaceProjection]
        public let assertions: DeliveryAssertions

        public init(workspaces: [WorkspaceProjection], assertions: DeliveryAssertions = .init()) {
            self.workspaces = workspaces
            self.assertions = assertions
        }
    }

    /// One derivation. Public because a Delivery strip's Refresh is the same act as a tick, and two
    /// paths to it would be two chances to record health differently.
    ///
    /// A failed read leaves the previous derivation where it was, old and still accurately DERIVED.
    /// The landing is raised on that path too: the strip did not move, but the health behind the
    /// provider's own dot did.
    public func derive(_ target: PortReadTarget, locally: Locally) async {
        do {
            let assembled = try await assembled(target, locally: locally)
            await deliveries.record(assembled, for: target.projectID)
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
        } catch {
            await health.record(error as? ProviderFetchError ?? .unreachable, of: target)
        }
        await landed()
    }

    /// The union: every Delivery the host has in flight, then every local branch that listing held
    /// nothing for, asked about by name.
    private func assembled(
        _ target: PortReadTarget, locally: Locally,
    ) async throws
        -> [Delivery] {
        let hosted = try await port.inFlight(in: target.scope, grant: target.binding.grant)
        var assembled = hosted
        let inFlight = Set(hosted.map(\.branch))
        for branch in Self.branches(of: locally.workspaces) where !inFlight.contains(branch) {
            try await assembled.append(named(branch, of: target))
        }
        return assembled.map {
            $0.linking(to: locally.assertions.number(ofBranch: $0.branch, in: target.projectID))
        }
    }

    /// One local branch's Delivery. A branch the host has never seen has no pull request and no
    /// Checks, which is "no CI yet" rather than a synthesized pass.
    private func named(
        _ branch: String, of target: PortReadTarget,
    ) async throws
        -> Delivery {
        try await port.delivery(ofBranch: branch, in: target.scope, grant: target.binding.grant)
            ?? Delivery(branch: branch, pullRequest: nil)
    }

    /// The branches the local Workspaces are on, each once and in the order they were read.
    ///
    /// A Workspace with no branch contributes none — a detached HEAD, and a Session with no branch
    /// at all, have no Delivery (`CONTEXT.md` L1 · Delivery).
    static func branches(of workspaces: [WorkspaceProjection]) -> [String] {
        var seen: Set<String> = []
        return workspaces.compactMap(\.branch).filter { seen.insert($0).inserted }
    }
}

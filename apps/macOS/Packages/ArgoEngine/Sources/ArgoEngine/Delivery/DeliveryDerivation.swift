import Foundation

/// Assembling one Project's Deliveries per branch, from local git ∪ code host (`CONTEXT.md` L1 ·
/// Delivery).
///
/// An actor, so no read and no decode ever runs on the MainActor.
///
/// The local half is taken from `WorkspaceProjection` and never from a second git read: the branch
/// is the join key (#259), and two readers of the same fact are two chances to disagree about it.
public actor DeliveryDerivation {
    private let port: CodeHostPort
    private let health: ConnectionHealthLedger
    private let deliveries: DeliveryLedger
    private let now: @Sendable () -> Date

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
    /// A failed read leaves the previous derivation exactly where it was — old, and still
    /// accurately DERIVED.
    public func derive(_ target: PortReadTarget, locally: Locally) async {
        do {
            let hosted = try await port.deliveries(in: target.scope, grant: target.binding.grant)
            await deliveries.record(
                assembled(hosted, locally: locally, projectID: target.projectID),
                for: target.projectID,
            )
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
        } catch {
            await health.record(error as? ProviderFetchError ?? .unreachable, of: target)
        }
    }

    /// The union, host side first: every Delivery the host holds, then every local branch it holds
    /// nothing for. A branch the host has never seen is a Delivery at `commits` — no pull request
    /// and no Checks, which is "no CI yet" rather than a synthesized pass.
    private func assembled(
        _ hosted: [Delivery], locally: Locally, projectID: String,
    )
        -> [Delivery] {
        var assembled = hosted.map { linked($0, locally: locally, projectID: projectID) }
        let hostedBranches = Set(hosted.map(\.branch))
        for branch in Self.branches(of: locally.workspaces) where !hostedBranches.contains(branch) {
            assembled.append(linked(
                Delivery(branch: branch, pullRequest: nil),
                locally: locally,
                projectID: projectID,
            ))
        }
        return assembled
    }

    private func linked(
        _ delivery: Delivery, locally: Locally, projectID: String,
    )
        -> Delivery {
        Delivery(
            branch: delivery.branch,
            pullRequest: delivery.pullRequest,
            observed: Delivery.Observed(checks: delivery.checks, reviews: delivery.reviews),
            workItem: .derived(
                branch: delivery.branch,
                pullRequestBody: delivery.pullRequest?.body,
                asserted: locally.assertions.number(ofBranch: delivery.branch, in: projectID),
            ),
        )
    }

    /// The branches the local Workspaces are on, each once and in the order they were read.
    ///
    /// A Workspace with no branch contributes none — a detached HEAD, and a Session with no branch
    /// at all, have no Delivery to be part of (`CONTEXT.md` L1 · Delivery).
    static func branches(of workspaces: [WorkspaceProjection]) -> [String] {
        var seen: Set<String> = []
        return workspaces.compactMap(\.branch).filter { seen.insert($0).inserted }
    }
}

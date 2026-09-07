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
    /// A failed LISTING leaves the previous derivation where it was, old and still accurately
    /// DERIVED. The landing is raised on that path too: the strip did not move, but the health
    /// behind the provider's own dot did.
    ///
    /// A refusal PART WAY through the fan-out records what the read did establish and reports the
    /// refusal beside it. The whole assembly used to go, and with it the listing that already held
    /// the row's own pull request (#1546).
    public func derive(_ target: PortReadTarget, locally: Locally) async {
        do {
            let union = try await union(target, locally: locally)
            await deliveries.record(union.deliveries, for: target.projectID)
            if let refusal = union.refusal {
                await health.record(refusal, of: target)
            } else {
                await health.succeeded(target.projectBinding, in: target.projectID, at: now())
            }
        } catch {
            await health.record(.refusal(error), of: target)
        }
        await landed()
    }

    /// One derivation's answer: the Deliveries it established, and the refusal that cut it short
    /// where one did. Both, rather than one or the other, because a refusal half way through the
    /// fan-out leaves a set that is honest as far as it goes and a host that is not healthy.
    private struct Assembled {
        var deliveries: [Delivery] = []
        var refusal: ProviderFetchError?

        /// The same answer with every Delivery's Ticket joined, `asserted` being the human's own
        /// link. Taken at the end so a carried Delivery is linked by the assertions of THIS read.
        func linked(by assertions: DeliveryAssertions, in projectID: String) -> Assembled {
            Assembled(
                deliveries: deliveries.map {
                    $0.linking(to: assertions.number(ofBranch: $0.branch, in: projectID))
                },
                refusal: refusal,
            )
        }
    }

    /// The union: every Delivery the host has in flight, then every local branch that listing held
    /// nothing for, asked about by name.
    ///
    /// The fan-out stops at its first refusal. A host that refused one branch is refusing this
    /// read, not that branch — the answer is a rate limit or an outage, and the requests after it
    /// would buy nothing but more of the limit that caused it.
    ///
    /// It also skips every branch whose Delivery is already settled, which is what stops the
    /// fan-out
    /// growing without bound as a checkout collects worktrees (#1588).
    private func union(
        _ target: PortReadTarget, locally: Locally,
    ) async throws
        -> Assembled {
        // Read once, not per branch: this is the loop whose cost the ticket is about.
        let held = await deliveries.deliveries(of: target.projectID)
            .reduce(into: [String: Delivery]()) { held, delivery in
                held[delivery.branch] = delivery
            }
        let open = held.values.filter { $0.pullRequest?.isFinished == false }
        // Conditional only where a `304` is reproducible from what is held. An open pull request is
        // not: its checks and reviews move without its own body moving, so the listing that carries
        // it is asked outright (`GitHubDeliveries.deliveries`).
        let listed = try await port.inFlight(
            in: target.scope, grant: target.binding.grant, revalidating: open.isEmpty,
        )
        // An unchanged listing is the host's word that the open set has not moved, which for an
        // empty one is the empty set — and NOT an empty derivation: every settled and every
        // pull-request-less branch below is still to be assembled.
        let hosted = listed.answer ?? Array(open)
        var union = Assembled(deliveries: hosted)
        let inFlight = Set(hosted.map(\.branch))
        for branch in Self.branches(of: locally.workspaces) where !inFlight.contains(branch) {
            if let already = held[branch], already.pullRequest?.isFinished == true {
                union.deliveries.append(already)
                continue
            }
            do {
                try await union.deliveries.append(named(branch, holding: held[branch], of: target))
            } catch {
                union.refusal = .refusal(error)
                let carried = await carried(past: union.deliveries, of: target)
                union.deliveries.append(contentsOf: carried)
                break
            }
        }
        return union.linked(by: locally.assertions, in: target.projectID)
    }

    /// What the LAST derivation established for the branches this one never reached — old, and
    /// still accurately DERIVED, which is exactly what a wholly failed read leaves standing.
    ///
    /// Carried rather than dropped because the in-flight listing is bounded by what is OPEN: every
    /// merged Delivery comes from the fan-out, and a refusal at the third branch of fifty-five
    /// would otherwise empty a strip that was full (`DeliveryLedger`). The refused branch itself is
    /// carried by the same rule, and is never derived at its commits — that reading is what a host
    /// ANSWERING nothing means, and a refusal established nothing.
    private func carried(
        past established: [Delivery], of target: PortReadTarget,
    ) async
        -> [Delivery] {
        let asked = Set(established.map(\.branch))
        return await deliveries.deliveries(of: target.projectID)
            .filter { !asked.contains($0.branch) }
    }

    /// One local branch's Delivery. A branch the host has never seen has no pull request and no
    /// Checks, which is "no CI yet" rather than a synthesized pass.
    ///
    /// Asked conditionally where what is held for the branch is a pull request the host does not
    /// have — which is the answer this read most often repeats, and the whole of it: there is
    /// nothing under a branch with no pull request for a `304` to be silent about. That is where
    /// the saving is. On this repository's checkout it is 47 of the 63 branches, and each is one
    /// request that a `304` now costs nothing against the primary limit (#1620).
    ///
    /// A branch holding a LIVE pull request is asked outright, because its checks and reviews move
    /// without its own body moving. A branch holding a settled one is not asked at all — the loop
    /// above answers it from the ledger (#1588).
    private func named(
        _ branch: String, holding held: Delivery?, of target: PortReadTarget,
    ) async throws
        -> Delivery {
        let none = Delivery(branch: branch, pullRequest: nil)
        let read = try await port.delivery(
            ofBranch: branch, in: target.scope, grant: target.binding.grant,
            revalidating: held?.pullRequest == nil,
        )
        // `unchanged` keeps what the branch already had; only an ANSWER of `nil` is the host saying
        // nobody has opened a pull request on it. Read the two as one and every tick that saved a
        // request would erase the pull request the last tick found.
        guard let answered = read.answer else { return held ?? none }
        return answered ?? none
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

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
    /// Where the round robin over each Project's local branches left off (#1571).
    private var fallbackCursor: [String: Int] = [:]

    /// How many local branches with no settled pull request one tick will ask about by name,
    /// before deferring the rest to the next tick — the decided cap `DeliveryPoll.interval`
    /// documents the cost of. Bounds a cold tick's local fan-out to a number a person chose rather
    /// than to however many worktrees a checkout has collected (#1571).
    ///
    /// Every branch with an OPEN pull request is unaffected: it arrives through `inFlight` in
    /// `union(_:locally:)`, which this budget never touches, so a Session with a pull request open
    /// is drawn on every tick regardless of how many other branches are waiting their turn — #258's
    /// "a branch is a Delivery whether or not a Session is on it" holds for the branches this
    /// defers too, just not on every single tick.
    static let localFallbackBudget = 20

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
    /// the row's own pull request (#1546). Every branch the read never reached keeps its Delivery
    /// where the ledger merges this in (`DeliveryLedger.record`).
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
        /// link. Taken at the end, so every Delivery this read established is linked by the
        /// assertions of THIS read.
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
    /// nothing for, asked about by name. What neither half reached is not assembled here — the
    /// ledger keeps it (`DeliveryLedger.record`).
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
        // Conditional only where a `304` is reproducible from what is held, which for the listing
        // means holding nothing open. An open pull request is not reproducible: its checks and its
        // reviews move without its own body moving, so the listing that carries it is asked
        // outright (`GitHubDeliveries.deliveries`).
        //
        // Since #1617 the ledger keeps a branch that has left the local half, so one stale open
        // Delivery holds this at `false` for the life of the window. That costs the one request the
        // listing is, and it errs toward asking — the direction a wrong guess has to err in.
        let listed = try await port.inFlight(
            in: target.scope, grant: target.binding.grant, revalidating: open.isEmpty,
        )
        // An unchanged listing is the host's word that the open set has not moved, and it is only
        // ever asked for when that set is empty — so it stays empty. What it is NOT is an empty
        // derivation: every settled and every pull-request-less branch below is still to be
        // assembled, and reading `unchanged` as "the room is gone" is the erasure this is about.
        let hosted = listed.answer ?? Array(open)
        var union = Assembled(deliveries: hosted)
        let inFlight = Set(hosted.map(\.branch))
        // A branch whose pull request the host has FINISHED with — merged, or closed without
        // merging — is answered from the ledger and never asked about again. That answer cannot
        // move, and it was 15 of the 63 branches in a tick at three requests each (#1588).
        // Reopening one, or opening a second pull request on the same branch, arrives through
        // the in-flight listing above, which runs first and takes the branch out of this loop
        // entirely — so nothing here strands a branch on a stale terminal answer while its
        // replacement is open. A branch name reused after its first pull request merged, whose
        // second one opens AND closes between two ticks, is answered from the first for the
        // life of the window: the ledger no longer forgets a branch that leaves the local half
        // (#1617).
        var unsettled: [String] = []
        for branch in Self.branches(of: locally.workspaces) where !inFlight.contains(branch) {
            if let already = held[branch], already.pullRequest?.isFinished == true {
                union.deliveries.append(already)
            } else {
                unsettled.append(branch)
            }
        }
        let scheduled = Self.scheduled(
            from: unsettled, budget: Self.localFallbackBudget,
            cursor: &fallbackCursor[target.projectID, default: 0],
        )
        for branch in scheduled {
            do {
                try await union.deliveries.append(named(branch, holding: held[branch], of: target))
            } catch {
                union.refusal = .refusal(error)
                break
            }
        }
        return union.linked(by: locally.assertions, in: target.projectID)
    }

    /// One local branch's Delivery. A branch the host has never seen has no pull request and no
    /// Checks, which is "no CI yet" rather than a synthesized pass.
    ///
    /// Asked conditionally where what is held for the branch is a pull request the host does not
    /// have — which is the answer this read most often repeats, and the whole of it: there is
    /// nothing under a branch with no pull request for a `304` to be silent about. That is where
    /// the saving is. On this repository's checkout it is 56 of the 77 branches, and each is one
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
        // `held != nil` is half the condition and not a formality: `held?.pullRequest == nil` is
        // also true for a branch the ledger holds NOTHING for, and there a `304` has nothing to
        // keep. The two are separate lifetimes — the transport's ETags are per URL and outlive any
        // one Project's ledger, which starts empty in a fresh window while the validators do not —
        // and asked conditionally such a branch would answer `304`, resolve to "no pull request",
        // and then keep answering `304`, because the bare Delivery it just wrote satisfies this
        // test too. Since #1617 the ledger no longer forgets a branch, so the gap is the first read
        // of a window rather than any tick whose local half came back short; it is still a gap.
        let read = try await port.delivery(
            ofBranch: branch, in: target.scope, grant: target.binding.grant,
            revalidating: held != nil && held?.pullRequest == nil,
        )
        // `unchanged` keeps what the branch already had; only an ANSWER of `nil` is the host saying
        // nobody has opened a pull request on it. Read the two as one and every tick that saved a
        // request would erase the pull request the last tick found.
        guard let answered = read.answer else { return held ?? none }
        return answered ?? none
    }

    /// The next `budget`-many of `branches`, starting where the last tick's `cursor` left off and
    /// wrapping — round robin, so a checkout with more unsettled local branches than the budget
    /// covers a different slice each tick instead of starving whichever branch sorts last (#1571).
    /// `cursor` is left ready for the NEXT tick, whether or not this one's slice was asked in full:
    /// a refusal partway through is the host's, not any one branch's, so nothing here would earn a
    /// refused branch a second try before the branches after it get a first one.
    static func scheduled(from branches: [String], budget: Int, cursor: inout Int) -> [String] {
        guard !branches.isEmpty else { return [] }
        let start = cursor % branches.count
        let rotated = Array(branches[start...] + branches[..<start])
        let slice = Array(rotated.prefix(budget))
        cursor = (start + slice.count) % branches.count
        return slice
    }

    /// A watch could not be dialled. The socket half of a Binding failing, recorded the same way a
    /// failed read is: `DeliverySocket`'s own doc still holds — the roster degrades to the poll's
    /// pace regardless — this only stops that degrade-down from being silent (#1643).
    public func dialFailed(_ target: PortReadTarget, cause: ConnectionCause = .unreachable) async {
        await health.failed(target.projectBinding, in: target.projectID, cause: cause)
        await landed()
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

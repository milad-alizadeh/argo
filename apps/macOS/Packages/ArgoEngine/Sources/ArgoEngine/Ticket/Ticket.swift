import Foundation

/// One ticket as a provider holds it, read through a Binding (`CONTEXT.md` L1 · Ticket).
///
/// **Read-through, never authoritative.** Argo stores the link — the number and which port — and
/// everything else here is the provider's, cached for as long as the app runs and rebuilt by the
/// next poll. Nothing in this type is written to disk (ADR-0008), which is what keeps a failed
/// poll from being able to blank a list it never held.
///
/// `status` is the provider's own word and renders verbatim (#272); `closure` is what Argo
/// computes across providers with. Both, because neither does the other's job.
public struct Ticket: Equatable, Sendable, Identifiable {
    public let number: Int
    public let title: String
    /// The provider's status word, exactly as it spells it.
    public let status: String
    public let closure: TicketClosure
    public let assignees: [String]
    public let labels: [TicketLabel]
    /// The provider's own priority word, verbatim and in its own case, and `nil` where the adapter
    /// read no priority for this ticket. Absent rather than a middle rung nothing said — Argo
    /// neither ranks these nor recases them (ADR-0014, per-fact `unknown`).
    public let priority: String?
    /// The provider's own type word, on the same terms. A property rather than a rung of a ladder
    /// (#160), so it never orders anything.
    public let type: String?
    /// Children in the provider's own author order, which every provider serves natively.
    public let children: [Int]
    /// The dependency edges, and `nil` where the provider served none AT ALL — which is UNKNOWN and
    /// not "no blockers". Absent rather than empty, so the two can never be told apart wrongly by a
    /// caller that forgot to ask: every claim resting on the edges is suppressed rather than
    /// asserted where this is `nil` (`CONTEXT.md` L2 · degrade-down).
    public let blockedBy: [TicketBlocker]?
    /// The ticket's body, verbatim, and `nil` where nothing was read. Held for as long as the
    /// listing is and never persisted, on the same terms as every other fact here.
    public let body: String?
    /// When the provider last saw this ticket change, and `nil` where the adapter read none. LAST
    /// TOUCHED and not filed: it is what `oldest untouched` claims, and the hero's age key (#273).
    public let updatedAt: Date?

    public init(
        number: Int,
        title: String,
        status: String,
        closure: TicketClosure,
        assignees: [String] = [],
        labels: [TicketLabel] = [],
        priority: String? = nil,
        type: String? = nil,
        children: [Int] = [],
        blockedBy: [TicketBlocker]? = nil,
        body: String? = nil,
        updatedAt: Date? = nil,
    ) {
        self.number = number
        self.title = title
        self.status = status
        self.closure = closure
        self.assignees = assignees
        self.labels = labels
        self.priority = priority
        self.type = type
        self.children = children
        self.blockedBy = blockedBy
        self.body = body
        self.updatedAt = updatedAt
    }

    public var id: Int {
        number
    }

    public var blockage: TicketBlockage {
        blockedBy.map(TicketBlockage.init(blockers:)) ?? .unread
    }

    /// How many blockers still stand in the way, and `nil` where the provider served no edges at
    /// all — UNKNOWN, never zero. Zero is a provider SAYING the way is clear, which is a different
    /// fact and the one a mark may rest on (`CONTEXT.md` L2 · degrade-down).
    ///
    /// A ruled-out blocker counts. It satisfies nothing (`TicketClosure.satisfiesBlocker`), so the
    /// ticket is stranded rather than clear, and a count that dropped it would read as startable.
    public var standingBlockers: Int? {
        blockedBy?.filter { !$0.closure.satisfiesBlocker }.count
    }

    public func state(claimed: Bool) -> TicketState {
        TicketState(closure: closure, claimed: claimed)
    }
}

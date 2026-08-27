import Foundation

/// One ticket as a provider holds it, read through a Binding (`CONTEXT.md` L1 · Work Item).
///
/// **Read-through, never authoritative.** Argo stores the link — the number and which port — and
/// everything else here is the provider's, cached for as long as the app runs and rebuilt by the
/// next poll. Nothing in this type is written to disk (ADR-0008), which is what keeps a failed
/// poll from being able to blank a list it never held.
///
/// `status` is the provider's own word and renders verbatim (#272); `closure` is what Argo
/// computes across providers with. Both, because neither does the other's job.
public struct WorkItem: Equatable, Sendable, Identifiable {
    public let number: Int
    public let title: String
    /// The provider's status word, exactly as it spells it.
    public let status: String
    public let closure: WorkItemClosure
    public let assignees: [String]
    public let labels: [String]
    /// The provider's own priority word, verbatim and in its own case, and `nil` where the adapter
    /// read no priority for this ticket. Absent rather than a middle rung nothing said — Argo
    /// neither ranks these nor recases them (ADR-0014, per-fact `unknown`).
    public let priority: String?
    /// The provider's own type word, on the same terms. A property rather than a rung of a ladder
    /// (#160), so it never orders anything.
    public let type: String?
    /// Children in the provider's own author order, which every provider serves natively.
    public let children: [Int]
    public let blockedBy: [WorkItemBlocker]
    /// Whether the provider served dependency edges for this ticket AT ALL. `false` is UNKNOWN and
    /// not "no blockers": an empty `blockedBy` cannot tell a provider that answered none from one
    /// that was never asked, and every claim built on the edges is suppressed rather than asserted
    /// where this is false (`CONTEXT.md` L2 · degrade-down).
    public let blockersRead: Bool
    /// The ticket's body, verbatim, and `nil` where nothing was read. Held for as long as the
    /// listing is and never persisted, on the same terms as every other fact here.
    public let body: String?

    public init(
        number: Int,
        title: String,
        status: String,
        closure: WorkItemClosure,
        assignees: [String] = [],
        labels: [String] = [],
        priority: String? = nil,
        type: String? = nil,
        children: [Int] = [],
        blockedBy: [WorkItemBlocker] = [],
        blockersRead: Bool = false,
        body: String? = nil,
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
        self.blockersRead = blockersRead
        self.body = body
    }

    public var id: Int {
        number
    }

    public var blockage: WorkItemBlockage {
        WorkItemBlockage(blockers: blockedBy)
    }

    public func state(claimed: Bool) -> WorkItemState {
        WorkItemState(closure: closure, claimed: claimed)
    }
}

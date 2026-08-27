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
    /// `nil` where the ticket has none — and always `nil` where the port carries no priority at
    /// all, which is what `WorkItemPort.carriesPriority` tells apart.
    public let priority: String?
    /// Children in the provider's own author order, which every provider serves natively.
    public let children: [Int]
    public let blockedBy: [WorkItemBlocker]

    public init(
        number: Int,
        title: String,
        status: String,
        closure: WorkItemClosure,
        assignees: [String] = [],
        labels: [String] = [],
        priority: String? = nil,
        children: [Int] = [],
        blockedBy: [WorkItemBlocker] = [],
    ) {
        self.number = number
        self.title = title
        self.status = status
        self.closure = closure
        self.assignees = assignees
        self.labels = labels
        self.priority = priority
        self.children = children
        self.blockedBy = blockedBy
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

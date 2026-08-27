import Foundation

/// One edge of a Work Item's `blockedBy` DAG, carrying the blocker's own closure (`CONTEXT.md`
/// L1 · Work Item).
///
/// The closure is on the edge because blockers are verified per-blocker: the provider's summary
/// counts open blockers only, so it cannot tell a cleared edge from a cancelled one.
public struct WorkItemBlocker: Equatable, Sendable {
    public let number: Int
    public let closure: WorkItemClosure

    public init(number: Int, closure: WorkItemClosure) {
        self.number = number
        self.closure = closure
    }
}

/// What a Work Item's blockers say about whether it can be picked up.
public enum WorkItemBlockage: Equatable, Sendable {
    case clear
    case blocked
    /// A blocker was ruled out, so the edge is neither satisfied nor waiting on anything: the
    /// premise was cancelled and a human has to re-scope one of the two.
    case stranded

    /// Stranded outranks blocked: a blocked ticket clears itself in time and a stranded one never
    /// will.
    public init(blockers: [WorkItemBlocker]) {
        if blockers.contains(where: { $0.closure == .ruledOut }) {
            self = .stranded
        } else if blockers.contains(where: { !$0.closure.satisfiesBlocker }) {
            self = .blocked
        } else {
            self = .clear
        }
    }
}

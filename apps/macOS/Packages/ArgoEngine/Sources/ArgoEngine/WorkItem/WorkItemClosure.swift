import Foundation

/// How a Work Item stopped being open, read per-port from the provider's own closure kind
/// (`CONTEXT.md` L1 · Work Item).
///
/// DERIVED, and four cases rather than a boolean, because closure kind is what decides whether a
/// `blockedBy` edge is satisfied. GitHub says it in `state_reason`, Linear in the state's `type`,
/// Jira through a configured resolution mapping — and a port that cannot read it at all still has
/// to answer.
public enum WorkItemClosure: Equatable, Sendable, CaseIterable {
    case open
    /// Closed because the work was done.
    case resolved
    /// Closed because the work was cancelled — GitHub's `not_planned` and `duplicate`.
    case ruledOut
    /// Closed, and the port could not read which of the two it was.
    case closedUnreadably

    /// Whether a blocker in this closure lets its dependent proceed.
    ///
    /// A ruled-out blocker satisfies nothing — Argo disagrees with the GitHub and Linear UIs here.
    /// An UNREADABLE closure satisfies, so a port that cannot read closure kinds costs a notice
    /// rather than stranding every map it touches.
    public var satisfiesBlocker: Bool {
        switch self {
        case .open, .ruledOut: false
        case .resolved, .closedUnreadably: true
        }
    }
}

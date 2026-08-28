import Foundation

/// Where a Work Item sits in its provider's workflow, in the one vocabulary every provider is read
/// through and written back to (#167, `CONTEXT.md` → Ports).
///
/// Purely the provider's workflow position, never derived from a local fact: a running Session does
/// not make a ticket `inProgress` and an open PR does not make it `inReview`. Those are the
/// Session-liveness and Delivery-review axes.
public enum WorkItemCanonicalState: String, Equatable, Sendable, CaseIterable {
    case todo
    case inProgress
    /// Read through ONLY from a provider that expresses it.
    case inReview
    /// Terminated successfully — GitHub's `completed`, Linear's completed category, Jira's
    /// resolution. A tracker that carries no reason collapses this into `closed`.
    case done
    /// Terminated without completing.
    case closed
}

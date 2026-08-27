import Foundation

/// The Work Item provider port: the seam every listing is read through (`CONTEXT.md` → Ports).
///
/// One method, because a listing is what a poll needs and Argo performs no provider mutations
/// yet. A second provider is a second file conforming here, not a branch in the poll.
public protocol WorkItemPort: Sendable {
    /// Every open Work Item the grant can see in the scope, children and verified blockers
    /// included.
    func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem]
}

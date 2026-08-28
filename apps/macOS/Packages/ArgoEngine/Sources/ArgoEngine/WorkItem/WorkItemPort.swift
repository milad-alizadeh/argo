import Foundation

/// The Work Item provider port: the seam every listing is read through (`CONTEXT.md` → Ports).
///
/// A listing is what a poll needs; addressing one item in a browser is what the room's two link
/// verbs need (#872). A second provider is a second file conforming here, not a branch in the poll.
public protocol WorkItemPort: Sendable {
    /// Every open Work Item the grant can see in the scope, children and verified blockers
    /// included.
    func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem]

    /// Where a human reads one item on this provider's own site, and `nil` where a Binding's scope
    /// cannot address one at all.
    ///
    /// `static` and grant-free because it reads nothing: a browse URL is a fact about how this
    /// provider addresses pages, not about what an identity can see. `WorkItemAddress` routes here.
    static func browseURL(of number: Int, in scope: String) -> URL?
}

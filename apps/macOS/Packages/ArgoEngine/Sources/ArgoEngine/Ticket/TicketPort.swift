import Foundation

/// The Ticket provider port: the seam every listing is read through (`CONTEXT.md` → Ports).
///
/// A listing is what a poll needs; addressing one item in a browser is what the room's two link
/// verbs need (#872). A second provider is a second file conforming here, not a branch in the poll.
public protocol TicketPort: Sendable {
    /// Every open Ticket the grant can see in the scope, children and verified blockers
    /// included.
    func list(in scope: String, grant: AccountGrant) async throws -> [Ticket]

    /// Where a human reads one item on this provider's own site, and `nil` where a Binding's scope
    /// cannot address one at all.
    ///
    /// `static` and grant-free because it reads nothing: a browse URL is a fact about how this
    /// provider addresses pages, not about what an identity can see. `TicketAddress` routes here.
    static func browseURL(of number: Int, in scope: String) -> URL?
}

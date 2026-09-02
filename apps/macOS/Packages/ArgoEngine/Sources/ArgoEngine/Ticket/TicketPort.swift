import Foundation

/// The Ticket provider port: the seam every listing is read through (`CONTEXT.md` → Ports).
///
/// A listing is what a poll needs; addressing one item in a browser is what the room's two link
/// verbs need (#872). A second provider is a second file conforming here, not a branch in the poll.
public protocol TicketPort: Sendable {
    /// Every open Ticket the grant can see in the scope, children and verified blockers
    /// included.
    func list(in scope: String, grant: AccountGrant) async throws -> [Ticket]

    /// One PAGE of the closed Tickets the grant can see in the scope, last touched first, and the
    /// cursor for the page behind it (#1075).
    ///
    /// A second method rather than a state argument on `list` above, because closed is unbounded
    /// where open is not: the bound belongs on the read that needs one. It is not the poll's — it
    /// answers "what did I finish", which no cadence is waiting on — so nothing calls this until a
    /// reader opens the view that shows it.
    ///
    /// **No edges.** A closed ticket's blockers are nobody's question and its children cost a
    /// request each, which is most of what keeps this cheap next to `list`.
    func closed(in scope: String, after cursor: String?, grant: AccountGrant) async throws
        -> ClosedTicketPage

    /// ONE Ticket by the number a link named, in whatever state it is now — the read a closed
    /// ticket is reachable through at all, since no listing carries one (#895).
    ///
    /// `nil` is the provider ANSWERING that there is nothing behind the number; a read that
    /// established nothing throws instead. That is the distinction `TicketTitleReading` draws
    /// between `.absent` and no reading, spelled in the two things a Swift call already has.
    func ticket(number: Int, in scope: String, grant: AccountGrant) async throws -> Ticket?

    /// Where a human reads one item on this provider's own site, and `nil` where a Binding's scope
    /// cannot address one at all.
    ///
    /// `static` and grant-free because it reads nothing: a browse URL is a fact about how this
    /// provider addresses pages, not about what an identity can see. `TicketAddress` routes here.
    static func browseURL(of number: Int, in scope: String) -> URL?
}

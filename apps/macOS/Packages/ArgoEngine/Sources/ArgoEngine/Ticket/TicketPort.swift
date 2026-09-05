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
    /// Nothing calls it until a reader opens the view that shows them: no poll reads the closed
    /// set, and none may be added that does (`TicketPollTests`).
    ///
    /// **No edges**, wherever an edge costs a request of its own — most of what keeps this cheap
    /// next to `list`.
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

    /// `browseURL(of:in:)` read the other way: which Ticket IN THIS SCOPE a URL addresses, and
    /// `nil` for every URL that addresses something else (#1178).
    ///
    /// Scoped, so a link to another repository on the same host answers `nil` here. An adapter
    /// that answers `nil` to `browseURL` answers `nil` here too: it has no URL to recognise.
    static func ticketNumber(of url: URL, in scope: String) -> Int?
}

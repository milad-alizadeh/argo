import ArgoEngine
@testable import ArgoUI
import Testing

/// The two readings the roster's Ticket links drive (#745) — what triggers a resolve, and what
/// one is performed over. They came out of the app target so a test could reach them (ADR-0022).
@Suite("Roster ticket links")
struct CockpitTicketLinkTests {
    private static func presentation(_ sessions: [CockpitPresentation.Session])
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [], activeProjectID: nil, sessions: sessions,
            checkout: .unavailable, connection: .idle,
        )
    }

    private static func session(_ id: String, ticket: Int?, title: String? = nil)
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id, title: "Session \(id)", access: .managed, status: .idle,
            work: .init(ticket: ticket
                .map { .linked(.init(number: $0, title: title)) } ?? .unlinked),
        )
    }

    /// A ticket already named is left alone — the whole point of keying the trigger on this set
    /// rather than on the roster, which moves on every turn.
    @Test
    func `only the tickets with no title yet trigger a resolve`() {
        let roster = Self.presentation([
            Self.session("A", ticket: 812),
            Self.session("B", ticket: 819, title: "Priority groups the backlog roots"),
            Self.session("C", ticket: nil),
        ])

        #expect(roster.untitledTicketNumbers == [812])
    }

    /// A resolve is performed over EVERY linked Session, titled or not: it replaces the whole set
    /// of stored titles, and one built from the untitled alone would drop the rest.
    @Test
    func `the links carry every Session that names a ticket`() {
        let roster = Self.presentation([
            Self.session("A", ticket: 812),
            Self.session("B", ticket: 819, title: "Priority groups the backlog roots"),
            Self.session("C", ticket: nil),
        ])

        #expect(roster.ticketLinks == ["A": 812, "B": 819])
    }

    @Test
    func `a roster naming no ticket asks for nothing`() {
        let roster = Self.presentation([Self.session("A", ticket: nil)])

        #expect(roster.untitledTicketNumbers.isEmpty)
        #expect(roster.ticketLinks.isEmpty)
    }
}

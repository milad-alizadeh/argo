import ArgoEngine
@testable import ArgoUI
import Testing

/// Which of the join's two numbers each link reading feeds (#1074), and — for a `.linked` one —
/// which claimant it names (#1092).
///
/// The mapping is the whole of #894's degrade-down rule after the amendment, and it is not
/// obvious from either end: `unlinked` and `unread` are both "no link", and the difference between
/// them is exactly the difference between a count that is short and a count that cannot be made.
/// One test per reading, so a fourth reading has to say which number it feeds rather than fall
/// through to whichever branch answers first.
@Suite("The claim join over a Session's link reading")
struct TicketClaimsTests {
    private static func session(
        id: String = "s1",
        title: String = "A Session",
        ticket: CockpitPresentation.Session.TicketLinkReading,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id, title: title, access: .managed, status: .idle, work: .init(ticket: ticket),
        )
    }

    private static func claims(_ sessions: [CockpitPresentation.Session]) -> TicketClaims {
        TicketClaims(over: sessions)
    }

    /// A read link is a placed claim: it feeds the numbers and neither shortfall, and names the
    /// Session that placed it.
    @Test
    func `a linked Session places a claim and is short of nothing`() {
        let claims = Self.claims([
            Self.session(
                id: "s1", title: "Fix login flow bug", ticket: .linked(.init(number: 812)),
            ),
        ])

        #expect(claims.numbers == [812])
        #expect(
            claims.claimants[812] == [TicketClaims.Claimant(id: "s1", name: "Fix login flow bug")],
        )
        #expect(claims.unplaced == .zero)
        #expect(claims.unread == .zero)
        #expect(claims.wasRead)
    }

    /// A provider is bound and this Session named no ticket — the state a branch naming its ticket
    /// repairs. It is short by one, and the join still HAPPENED, so a count can be printed.
    @Test
    func `an unlinked Session is one the count is short by, and the join still stands`() {
        let claims = Self.claims([Self.session(ticket: .unlinked)])

        #expect(claims.numbers.isEmpty)
        #expect(claims.unplaced == 1)
        #expect(claims.unread == .zero)
        #expect(claims.wasRead)
    }

    /// Nothing to link TO, so no join was made and the count is not short — it is absent. The one
    /// reading that takes `wasRead` down.
    @Test
    func `an unread Session sinks the join rather than shortening it`() {
        let claims = Self.claims([Self.session(ticket: .unread)])

        #expect(claims.numbers.isEmpty)
        #expect(claims.unplaced == .zero)
        #expect(claims.unread == 1)
        #expect(!claims.wasRead)
    }

    /// Each reading counts once and into its own number, over a roster carrying all three.
    @Test
    func `a roster of all three readings splits three ways`() {
        let claims = Self.claims([
            Self.session(id: "a", ticket: .linked(.init(number: 812))),
            Self.session(id: "b", ticket: .linked(.init(number: 894))),
            Self.session(ticket: .unlinked), Self.session(ticket: .unlinked),
            Self.session(ticket: .unlinked), Self.session(ticket: .unread),
        ])

        #expect(claims.numbers == [812, 894])
        #expect(claims.unplaced == 3)
        #expect(claims.unread == 1)
    }

    /// No live Sessions is a whole answer of zero, not an unread one: nothing was left unjoined.
    @Test
    func `an empty roster reads as a whole join of nothing`() {
        let claims = Self.claims([])

        #expect(claims.numbers.isEmpty)
        #expect(claims.unplaced == .zero)
        #expect(claims.wasRead)
    }

    /// Two Sessions on ONE ticket are one claim and two Sessions — the numbers stay a set, and the
    /// claimants under that one key carry BOTH, in the order the roster served them (#1092): the
    /// head that reads them must not silently pick one.
    @Test
    func `two Sessions on one ticket place one claim and name both claimants`() {
        let claims = Self.claims([
            Self.session(id: "a", title: "Fix login flow bug", ticket: .linked(.init(number: 812))),
            Self.session(id: "b", title: "/implement 812", ticket: .linked(.init(number: 812))),
        ])

        #expect(claims.numbers == [812])
        #expect(claims.claimants[812] == [
            TicketClaims.Claimant(id: "a", name: "Fix login flow bug"),
            TicketClaims.Claimant(id: "b", name: "/implement 812"),
        ])
    }

    /// The back-compat initializer every fixture that asks only WHICH tickets are claimed uses —
    /// `numbers` still answers, and no claimant is invented for a Session nothing named one for.
    @Test
    func `a numbers-only set names no claimant`() {
        let claims = TicketClaims(numbers: [812])

        #expect(claims.numbers == [812])
        #expect(claims.claimants[812] == [])
    }
}

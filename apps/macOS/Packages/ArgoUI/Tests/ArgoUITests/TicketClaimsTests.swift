import ArgoEngine
@testable import ArgoUI
import Testing

/// Which of the join's two numbers each link reading feeds (#1074).
///
/// The mapping is the whole of #894's degrade-down rule after the amendment, and it is not
/// obvious from either end: `unlinked` and `unread` are both "no link", and the difference between
/// them is exactly the difference between a count that is short and a count that cannot be made.
/// One test per reading, so a fourth reading has to say which number it feeds rather than fall
/// through to whichever branch answers first.
@Suite("The claim join over a Session's link reading")
struct TicketClaimsTests {
    private static func claims(_ readings: [CockpitPresentation.Session.TicketLinkReading])
        -> TicketClaims {
        TicketClaims(over: readings)
    }

    /// A read link is a placed claim: it feeds the numbers and neither shortfall.
    @Test
    func `a linked Session places a claim and is short of nothing`() {
        let claims = Self.claims([.linked(.init(number: 812))])

        #expect(claims.numbers == [812])
        #expect(claims.unplaced == .zero)
        #expect(claims.unread == .zero)
        #expect(claims.wasRead)
    }

    /// A provider is bound and this Session named no ticket — the state a branch naming its ticket
    /// repairs. It is short by one, and the join still HAPPENED, so a count can be printed.
    @Test
    func `an unlinked Session is one the count is short by, and the join still stands`() {
        let claims = Self.claims([.unlinked])

        #expect(claims.numbers.isEmpty)
        #expect(claims.unplaced == 1)
        #expect(claims.unread == .zero)
        #expect(claims.wasRead)
    }

    /// Nothing to link TO, so no join was made and the count is not short — it is absent. The one
    /// reading that takes `wasRead` down.
    @Test
    func `an unread Session sinks the join rather than shortening it`() {
        let claims = Self.claims([.unread])

        #expect(claims.numbers.isEmpty)
        #expect(claims.unplaced == .zero)
        #expect(claims.unread == 1)
        #expect(!claims.wasRead)
    }

    /// Each reading counts once and into its own number, over a roster carrying all three.
    @Test
    func `a roster of all three readings splits three ways`() {
        let claims = Self.claims([
            .linked(.init(number: 812)), .linked(.init(number: 894)), .unlinked, .unlinked,
            .unlinked, .unread,
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

    /// Two Sessions on ONE ticket are one claim and two Sessions. The numbers are a set — the view
    /// counts tickets — and the shortfall counts Sessions, which is why they are separate numbers
    /// rather than a total.
    @Test
    func `two Sessions on one ticket place one claim`() {
        let claims = Self.claims([.linked(.init(number: 812)), .linked(.init(number: 812))])

        #expect(claims.numbers == [812])
    }
}

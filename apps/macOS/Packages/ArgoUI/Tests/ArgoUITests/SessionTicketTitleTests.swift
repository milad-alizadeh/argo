import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// What a roster row is CALLED once the ticket names it (#745). Every claim here is asserted on
/// BOTH surfaces where it is one, because the whole point is that they read one seam.
///
/// Where the link itself comes from — the branch, and what a provider answers about it — is
/// `SessionBranchTicketTests`. Every case here is handed a Session that already carries one.
@Suite("Session ticket title")
struct SessionTicketTitleTests {
    @Test
    func `a Session on a ticket branch reads the ticket on the roster and the header alike`(
    ) throws {
        let linked = Self.session(issue: .init(number: 741, title: "Anchor the feed"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        #expect(row.title == "#741 — Anchor the feed")
        #expect(SessionHeaderProjection.header(from: linked).title == "#741 — Anchor the feed")
    }

    @Test
    func `the roster and the ⓘ panel word the link the same way`() throws {
        let linked = Self.session(issue: .init(number: 741, title: "Anchor the feed"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)
        let fact = SessionHeaderProjection.header(from: linked).facts.first { $0.term == "Issue" }

        // One composition, in `IssueReading`: a second one would let the two disagree about a fact
        // they are both reading off the same link.
        #expect(row.title == fact?.value)
    }

    @Test
    func `a link the provider has not named yet keeps the derived title`() throws {
        let linked = Self.session(issue: .init(number: 741))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        // `#741` alone carries no more than the `/implement 741` it would replace, so the number
        // on its own is not a promotion.
        #expect(row.title == "/implement 741")
    }

    @Test
    func `a Session with no link keeps its derived title, with no empty hash`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [Self.session()]).first)

        #expect(row.title == "/implement 741")
    }

    @Test
    func `an explicit name outranks the ticket's title`() throws {
        let renamed = Self.session(
            issue: .init(number: 741, title: "Anchor the feed"),
            explicitName: "Tonight's run",
        )

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        #expect(row.title == "Tonight's run")
        // And Reset lands on the ticket, which is where the Session would be without the rename.
        #expect(row.rename?.derived == "#741 — Anchor the feed")
    }

    @Test
    func `the run kind reads on the secondary line once the ticket holds the title`() throws {
        let linked = Self.session(issue: .init(number: 741, title: "Anchor the feed"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        // The verb, off the title and onto the line with room for it (#745).
        #expect(row.toldApart == "/implement")
        #expect(row.announcement.contains("/implement"))
    }

    @Test
    func `the run kind is not said twice on a Session whose title is still the command`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [Self.session()]).first)

        #expect(row.toldApart == nil)
    }

    @Test
    func `a Session whose first prompt was prose has no run kind to move`() throws {
        let linked = Self.session(
            title: "Draw the header", issue: .init(number: 741, title: "Anchor the feed"),
        )

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        #expect(row.toldApart == nil)
    }

    @Test
    func `the roster the ticket specimens render carries the case the ticket is about`() {
        // The `ticketRoster` PNGs are the only evidence this rendering has, so the fixture has to
        // carry several Sessions sharing one ticket, one that owns its ticket alone, and a row
        // that resolved none.
        let rows = TicketFixture.rows

        // Every row reads differently, which is the judgement the render is for (#1072).
        #expect(Set(rows.map(\.title)).count == rows.count)
        #expect(rows.contains { $0.toldApart == "#741" })
        #expect(rows.contains { $0.title.hasPrefix("#736 — ") })
    }

    private static func session(
        title: String = "/implement 741",
        issue: CockpitPresentation.Session.Issue? = nil,
        explicitName: String? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: title,
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#741-anchor-the-feed"),
                ticket: issue.map { .linked($0) } ?? .unread,
            ),
            annotations: .init(explicitName: explicitName),
        )
    }
}

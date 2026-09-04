import ArgoEngine
@testable import ArgoUI
import Testing

/// The two addresses line 3 draws at its trailing edge (#1346, `cockpit-roster-row.md` —
/// `DeliveryAddresses`).
@Suite("The roster row's addresses")
struct SessionRowAddressesTests {
    @Test
    func `a Session on a Ticket draws its number, and one on none draws nothing`() throws {
        let linked = try #require(rows(ticket: .linked(.init(number: 1269))).first)
        let unlinked = try #require(rows(ticket: .unread).first)

        #expect(linked.ticketNumber == 1269)
        #expect(unlinked.ticketNumber == nil)
    }

    @Test
    func `a Session on a branch with a pull request carries it, and one without carries nothing`()
        throws {
        let withPR = try #require(rows(pullRequest: .fixture(state: "open")).first)
        let withoutPR = try #require(rows(pullRequest: nil).first)

        #expect(withPR.pullRequest?.number == 1312)
        #expect(withoutPR.pullRequest == nil)
    }

    @Test
    func `a fold draws neither address, whatever its newest run carries`() throws {
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            RosterSessionFixture.session(
                id: "headless-\(index)",
                workspaceLocation: RosterSessionFixture.checkout,
                access: .external,
                entry: .headless,
                status: .running,
                lastSeenAtMs: 0,
                ticket: .linked(.init(number: 1269)),
                pullRequest: .fixture(state: "open"),
            )
        }).first { $0.fold != nil })

        #expect(fold.ticketNumber == nil)
        #expect(fold.pullRequest == nil)
    }

    private func rows(
        ticket: CockpitPresentation.Session.TicketLinkReading = .unread,
        pullRequest: DeliveryPullRequest? = nil,
    )
        -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(
                id: "one", status: .idle, lastSeenAtMs: 0, ticket: ticket, pullRequest: pullRequest,
            ),
        ])
    }
}

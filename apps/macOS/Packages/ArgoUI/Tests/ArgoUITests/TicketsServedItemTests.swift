import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the LISTING itself says once a provider has served it (#820): the status word rendered
/// verbatim beside Argo's own bucket, the two views that cannot be counted where a provider serves
/// no dependency edges, and which shape of ticket is a chart.
///
/// Every case here is a claim about the items served; the Binding's health is
/// `TicketsReadingLiveTests` and the roster is `TicketsProgressCountTests`.
@Suite("Tickets room served items")
@MainActor
struct TicketsServedItemTests {
    /// The two views partition the open set, so neither can be counted where a ticket's edges were
    /// not served. Absent rather than zero: zero is a claim that nothing is blocked.
    @Test
    func `a provider with no dependency edges counts neither view`() {
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.unedged],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.view(.allOpen)?.count == 1)
        #expect(room.view(.unblocked)?.count == nil)
        #expect(room.view(.blocked)?.count == nil)
    }

    /// Opening `Blocked` against such a provider is a no-op rather than a page reading zero of
    /// nothing: the room still has open work, so it draws the view empty and not a vacancy.
    @Test
    func `the Blocked view over unread edges no-ops`() {
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.unedged],
            health: TicketsLiveFixture.answered,
            view: .blocked,
        )

        #expect(room.vacancy == nil)
        #expect(room.backlog.isEmpty)
    }

    @Test
    func `a ticket whose edges were never read draws no Blocked by section`() {
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.unedged],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.ticket?.blockedBy.isEmpty == true)
    }

    /// The provider's word renders verbatim (#272) — Argo's own bucket never stands in for it.
    @Test
    func `the status word is the provider's own`() {
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.ticket?.status == "open")
    }

    /// And the bucket sits beside that word rather than over it: a claim is Argo's alone, and no
    /// provider word could have said it.
    @Test
    func `the bucket is Argo's, beside that word`() {
        let claimed = RosterSessionFixture.session(id: "A", ticket: .linked(.init(number: 812)))
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [claimed],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.ticket?.bucket == .claimed)
    }

    /// A chart is a PRD-shaped PARENT (`cockpit-work-room.md`), so a typed ticket with no children
    /// is not one — its row would open onto a Route with nothing on it.
    @Test
    func `a chart is a PRD-typed parent`() {
        let leaf = Ticket(
            number: 606, title: "A typed leaf", status: "open", closure: .open, type: "PRD",
            blockedBy: [],
        )
        #expect(TicketsLiveFixture.chart.isChartShaped)
        #expect(!leaf.isChartShaped)
    }

    /// Where the provider carries no type at all the role falls back to hierarchy
    /// (`CONTEXT.md` L1 · Ticket), which is the only reading a repository with issue types
    /// switched off can have. A ticket the provider DID type does not fall back.
    @Test
    func `an untyped parent is chart-shaped, and a typed non-PRD one is not`() {
        #expect(TicketsLiveFixture.chart.untyped.isChartShaped)
        #expect(!TicketsLiveFixture.chart.typed("task").isChartShaped)
    }
}

private extension Ticket {
    var untyped: Ticket {
        Ticket(copying: self, type: .some(nil))
    }

    func typed(_ word: String) -> Ticket {
        Ticket(copying: self, type: word)
    }
}

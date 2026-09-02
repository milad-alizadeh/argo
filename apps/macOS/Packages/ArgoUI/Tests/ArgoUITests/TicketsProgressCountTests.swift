import ArgoEngine
@testable import ArgoUI
import Testing

/// What the ROSTER claims of the backlog (#820, #894): a live Session on a ticket holds it, an
/// ended one holds nothing, and where a join could not be evaluated at all `In progress` prints no
/// number rather than a zero.
///
/// Every case here is a claim about the Sessions on the roster; the Binding's health is
/// `TicketsReadingLiveTests` and the listing is `TicketsServedItemTests`.
@Suite("Tickets room progress count")
@MainActor
struct TicketsProgressCountTests {
    @Test
    func `a live Session on a ticket claims it`() {
        let running = RosterSessionFixture.session(id: "A", ticket: .linked(.init(number: 812)))
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [running],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.view(.inProgress)?.count == 1)
    }

    /// An ended Session's branch still names the ticket it was cut for, and counting that as a
    /// claim would leave `In progress` filling up for the life of the machine.
    @Test
    func `an ended Session claims nothing`() {
        let over = RosterSessionFixture.session(
            id: "B",
            status: .ended,
            ticket: .linked(.init(number: 812)),
        )
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [over],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.view(.inProgress)?.count == .zero)
    }

    /// The shortfall #1074 makes visible. A live Session whose link nothing recognised is a claim
    /// Argo could not place — but it is ONE claim, not the whole join, so the count stands and
    /// says what it is short by. #894 blanked the number here, and every real machine has at least
    /// one such Session, so the number never appeared at all.
    @Test
    func `a live Session with no recognised link leaves the count short and says so`() {
        let placed = RosterSessionFixture.session(id: "C1", ticket: .linked(.init(number: 812)))
        let unjoined = RosterSessionFixture.session(id: "C2", ticket: .unlinked)
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [placed, unjoined],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.view(.allOpen)?.count == 1)
        #expect(room.view(.inProgress)?.count == 1)
        #expect(room.view(.inProgress)?.unplaced == 1)
    }

    /// The shortfall is the CLAIMS' alone. A view resting on the provider's edges is not short of
    /// anything because a Session named no ticket, and a rail that said otherwise would attach the
    /// same caveat to three numbers it does not apply to.
    @Test
    func `only the view resting on the claims carries the shortfall`() {
        let unjoined = RosterSessionFixture.session(id: "F", ticket: .unlinked)
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [unjoined],
            health: TicketsLiveFixture.answered,
        )

        for reading in room.views where reading.id != .inProgress {
            #expect(reading.unplaced == .zero)
        }
        #expect(room.view(.inProgress)?.unplaced == 1)
    }

    /// The one case #1074 leaves alone: nobody could read a link AT ALL, so no join happened and
    /// there is no partial answer to state. Absent, and no shortfall beside it — a shortfall off a
    /// join that never ran is the same nothing said twice.
    @Test
    func `a live Session nobody could read a link for counts no view of progress`() {
        let unread = RosterSessionFixture.session(id: "G", ticket: .unread)
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [unread],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.view(.allOpen)?.count == 1)
        #expect(room.view(.inProgress)?.count == nil)
        #expect(room.view(.inProgress)?.unplaced == .zero)
    }

    /// With NO provider bound the join could not be evaluated either, so the count is absent on the
    /// same ground — and the room is vacant over it, so no reader meets a rail of four views with
    /// one number missing and no explanation. Pinned here because the second half is decided two
    /// files away, and a count's honesty must not rest on a guard nothing asserts.
    @Test
    func `nothing bound counts no view of progress, under a vacant room`() {
        let running = RosterSessionFixture.session(id: "E", ticket: .unread)
        let room = TicketsLiveFixture.room(items: [TicketsLiveFixture.read], sessions: [running])

        #expect(room.vacancy == .unbound)
        #expect(room.view(.inProgress)?.count == nil)
    }

    /// And an ENDED one does not: its link was never going to be counted, so nothing about it was
    /// left unevaluated. Absent is for a join that could not be made, never for one nobody wanted.
    @Test
    func `an ended Session with no recognised link still counts progress at zero`() {
        let over = RosterSessionFixture.session(id: "D", status: .ended, ticket: .unlinked)
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            sessions: [over],
            health: TicketsLiveFixture.answered,
        )

        #expect(room.view(.inProgress)?.count == .zero)
    }
}

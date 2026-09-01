import ArgoEngine
@testable import ArgoUI
import Testing

/// What the sidebar's hero states, and — the sharper half — what it refuses to state (#817). Every
/// claim on this card is one a person acts on next, so an unearned chip costs more than a missing
/// one.
@Suite("Next-up hero")
struct NextUpTests {
    /// #273 is `medium` in the fixture, so the hero does NOT claim high priority for it — the same
    /// word the ticket detail draws beside it (#815). One fact, one answer, both surfaces.
    @Test
    func `the hero picks a takeable leaf out of the backlog`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.nextUp == .pick(.init(
            number: 273,
            title: "The Next-up cold-start planner",
            reasons: [.unblocked, .next(chart: "#607")],
        )))
    }

    /// The chip echoes the provider's own word back; it does not rank the ladder. A ticket the
    /// provider calls `medium` earns nothing here however urgent it looks from elsewhere.
    @Test
    func `only the provider's own high word earns the priority chip`() throws {
        let reading = TicketsFixture.reading(of: [Self.priced("medium")])

        try #expect(pick(in: TicketsRoomProjection.room(from: reading)).reasons.isEmpty)
    }

    /// Never more than two, whatever is earned — the third reason is read after the question has
    /// already been answered. Against the literal, not against the constant production reads.
    @Test
    func `at most two chips are carried`() throws {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        try #expect(pick(in: room).reasons.count == 2)
    }

    /// One earned reason is one chip, and the card does not pad itself out to two. This is also the
    /// tier the room ships in: a provider that served no dependency edge has not said this ticket
    /// is unblocked, so the chip is suppressed rather than asserted.
    @Test
    func `with no dependency edges read the unblocked chip is suppressed`() throws {
        let room = TicketsRoomProjection.room(from: TicketsFixture.oneChip)

        try #expect(pick(in: room).reasons == [.highPriority])
    }

    /// Per PICK, not per backlog. A provider that served edges for other tickets has still said
    /// nothing about this one, and inferring from the neighbours is the failure the tier guards.
    @Test
    func `edges read for another ticket earn this one nothing`() throws {
        let read = Ticket(
            number: 999,
            title: "Read",
            status: "Todo",
            closure: .open,
            blockedBy: [],
        )
        let reading = TicketsFixture.reading(of: [Self.priced("high"), read])

        try #expect(pick(in: TicketsRoomProjection.room(from: reading)).reasons == [.highPriority])
    }

    /// The chip names the chart the pick belongs to, which is the only place a `<PRD>` comes from.
    @Test
    func `a pick inside a chart earns the next-in chip`() throws {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [chart, leaf]))

        try #expect(pick(in: room).reasons == [.next(chart: "#607")])
    }

    /// Two charts both claiming the pick: the chip names the LOWER-NUMBERED of them, and names the
    /// same one when the provider serves them the other way round — the chip's parent is Argo's
    /// answer rather than the array's (#985). Reversed, #999 is the first claimant served.
    @Test(arguments: [false, true])
    func `a pick two charts both claim names the lower-numbered one`(reversed: Bool) throws {
        let served = reversed ? Self.contested.reversed() : Self.contested
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: Array(served)))

        try #expect(pick(in: room).reasons == [.next(chart: "#607")])
    }

    /// Work happens at leaves, so a parent is never what the hero offers — even when it is the
    /// first unblocked thing the provider served.
    @Test
    func `a parent is never picked`() throws {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [chart, leaf]))

        try #expect(pick(in: room).number == 273)
    }

    @Test
    func `every open leaf blocked reads as the blocked tier`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.poolBlocked)
            .nextUp == .nothingUnblocked)
    }

    /// A backlog of parents alone holds no open leaf, so nothing is WAITING — saying every open
    /// leaf is blocked would be a sentence about a set with no members in it.
    @Test
    func `a backlog with no open leaf reads as clear rather than blocked`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [chart]))

        #expect(room.nextUp == .backlogClear)
    }

    @Test
    func `every takeable leaf claimed reads as the running tier`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.poolRunning).nextUp == .allRunning)
    }

    @Test
    func `a provider that answered with nothing reads as the clear tier`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.answeredEmpty)
            .nextUp == .backlogClear)
    }

    /// With nothing bound the room hides whole — a backlog-clear sentence would answer a question
    /// nobody was in a position to ask.
    @Test
    func `an unbound room states no hero at all`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.unbound).nextUp == nil)
    }

    /// The hero is over the WHOLE open set. Opening `Blocked` narrows the deck and must not turn
    /// "here is what to pick up" into "nothing is unblocked".
    @Test
    func `opening a view does not move the hero`() {
        let atRest = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .allOpen)
        let filtered = TicketsRoomProjection.room(from: TicketsFixture.reading, in: .blocked)

        #expect(atRest.nextUp == filtered.nextUp)
    }

    /// The design's honest fallback, and the only state that reaches it: with the edges unread and
    /// no priority word, the other three reasons are all refused, so the card names the one input
    /// left rather than carrying no chip at all.
    @Test
    func `a pick that earned nothing else says it is the oldest untouched`() throws {
        let room = TicketsRoomProjection.room(from: Self.edgeless(dated: true))

        try #expect(pick(in: room).reasons == [.oldestUntouched])
    }

    /// And it is CHECKED, not assumed: with no timestamp read there is no age, so `oldest` is not a
    /// thing anybody may say — the card carries no chip rather than a fourth unearned one.
    @Test
    func `with no age read the fallback is suppressed too`() throws {
        let room = TicketsRoomProjection.room(from: Self.edgeless(dated: false))

        try #expect(pick(in: room).reasons.isEmpty)
    }

    /// `spec ready` would need an explicit provider label, and the design draws no such chip — so
    /// there is no case for one, and prose that says the words earns nothing (#273).
    @Test
    func `spec readiness is never inferred from a ticket's prose`() throws {
        let reading = TicketsFixture.reading(of: [Ticket(
            number: 1, title: "A ticket", status: "Todo", closure: .open,
            labels: [TicketLabel(name: "spec ready")], blockedBy: [],
            body: "Spec ready — pick this up.",
        )])

        try #expect(pick(in: TicketsRoomProjection.room(from: reading)).reasons == [.unblocked])
    }

    /// A provider that serves no dependency summary, no priority word and no chart — every claim
    /// but the age refused. `dated` is the one thing that varies between the two cases above.
    private static func edgeless(dated: Bool) -> TicketsReading {
        TicketsFixture.reading(of: [Ticket(
            copying: TicketsFixture.candidate(1, day: dated ? 1 : nil),
            blockedBy: .some(nil),
        )])
    }

    /// Only priority takes ink. Two coloured chips would read as a scale, and the hero never
    /// renders a score.
    @Test
    func `only the priority reason is urgent`() {
        #expect(NextUp.Reason.highPriority.isUrgent)
        #expect(!NextUp.Reason.unblocked.isUrgent)
        #expect(!NextUp.Reason.next(chart: "#607").isUrgent)
    }

    private func pick(in room: TicketsRoomProjection.Room) throws -> NextUp.Pick {
        try NextUpPick.of(room)
    }

    /// #388 as an edgeless provider serves it: one priority word, no type, and no dependency
    /// summary — which is exactly what earns or refuses each chip above.
    private static func priced(_ priority: String) -> Ticket {
        Ticket(
            number: 388, title: "Ticket read path", status: "Todo", closure: .open,
            priority: priority,
        )
    }

    /// A chart is one by its TYPE word, which is what the `CHARTS` group and this chip both read.
    private var chart: Ticket {
        Ticket(
            number: 607, title: "Wayfinder", status: "Todo", closure: .open, type: "PRD",
            children: [273],
        )
    }

    private var leaf: Ticket {
        Ticket(number: 273, title: "The planner", status: "Todo", closure: .open)
    }

    /// #607 and #999 are both PRD-shaped and both claim #273, in that order.
    private static let contested = [
        Ticket(
            number: 607, title: "Wayfinder", status: "Todo", closure: .open, type: "PRD",
            children: [273],
        ),
        Ticket(
            number: 999, title: "Later plan", status: "Todo", closure: .open, type: "PRD",
            children: [273],
        ),
        Ticket(number: 273, title: "The planner", status: "Todo", closure: .open),
    ]
}

import ArgoEngine
@testable import ArgoUI
import Testing

/// What the sidebar's hero states, and — the sharper half — what it refuses to state (#817). Every
/// claim on this card is one a person acts on next, so an unearned chip costs more than a missing
/// one.
@Suite("Next-up hero")
struct NextUpTests {
    @Test
    func `the hero picks a takeable leaf out of the backlog`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        #expect(room.nextUp == .pick(.init(
            id: 273,
            title: "The Next-up cold-start planner",
            reasons: [.highPriority, .unblocked],
        )))
    }

    /// Never more than two, whatever is earned — the third reason is read after the question has
    /// already been answered.
    @Test
    func `at most two chips are carried`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        guard case let .pick(pick) = room.nextUp else { return #expect(Bool(false)) }
        #expect(pick.reasons.count == NextUp.chipLimit)
    }

    /// The tier the room ships in: a provider that served no dependency edge has not said this
    /// ticket is unblocked, so the chip is suppressed rather than asserted.
    @Test
    func `with no dependency edges the unblocked chip is suppressed`() {
        let room = WorkRoomProjection.room(from: WorkFixture.oneChip)

        guard case let .pick(pick) = room.nextUp else { return #expect(Bool(false)) }
        #expect(pick.reasons == [.highPriority])
    }

    /// One earned reason is one chip. The card does not pad itself out to two.
    @Test
    func `one earned reason carries one chip`() {
        let room = WorkRoomProjection.room(from: WorkFixture.oneChip)

        guard case let .pick(pick) = room.nextUp else { return #expect(Bool(false)) }
        #expect(pick.reasons.count == 1)
    }

    /// The chip names the chart the pick belongs to, which is the only place a `<PRD>` comes from.
    @Test
    func `a pick inside a chart earns the next-in chip`() {
        let parent = WorkItem(
            number: 607, title: "Wayfinder", status: "Todo", closure: .open, children: [273],
        )
        let child = WorkItem(number: 273, title: "The planner", status: "Todo", closure: .open)
        var reading = WorkFixture.reading(of: [parent, child])
        reading.charts = [607]

        guard case let .pick(pick) = WorkRoomProjection.room(from: reading).nextUp else {
            return #expect(Bool(false))
        }
        #expect(pick.reasons == [.next(chart: "#607")])
    }

    /// Work happens at leaves, so a parent is never what the hero offers — even when it is the
    /// first unblocked thing the provider served.
    @Test
    func `a parent is never picked`() {
        let parent = WorkItem(
            number: 607, title: "Wayfinder", status: "Todo", closure: .open, children: [273],
        )
        let child = WorkItem(number: 273, title: "The planner", status: "Todo", closure: .open)

        guard case let .pick(pick) = WorkRoomProjection.room(
            from: WorkFixture.reading(of: [parent, child]),
        ).nextUp else { return #expect(Bool(false)) }
        #expect(pick.id == 273)
    }

    @Test
    func `every open leaf blocked reads as the blocked tier`() {
        #expect(WorkRoomProjection.room(from: WorkFixture.poolBlocked).nextUp == .nothingUnblocked)
    }

    @Test
    func `every takeable leaf claimed reads as the running tier`() {
        #expect(WorkRoomProjection.room(from: WorkFixture.poolRunning).nextUp == .allRunning)
    }

    @Test
    func `a provider that answered with nothing reads as the clear tier`() {
        #expect(WorkRoomProjection.room(from: WorkFixture.answeredEmpty).nextUp == .backlogClear)
    }

    /// The three tiers are three sentences. Sharing one would tell a reader whose backlog is
    /// deadlocked the same thing it tells one whose backlog is finished.
    @Test
    func `the three empty tiers are distinct`() {
        let tiers: [NextUp] = [.nothingUnblocked, .allRunning, .backlogClear]

        #expect(Set(tiers.map(String.init(describing:))).count == 3)
    }

    /// With nothing bound the room hides whole — a backlog-clear sentence would answer a question
    /// nobody was in a position to ask.
    @Test
    func `an unbound room states no hero at all`() {
        #expect(WorkRoomProjection.room(from: WorkFixture.unbound).nextUp == nil)
    }

    /// The hero is over the WHOLE open set. Opening `Blocked` narrows the deck and must not turn
    /// "here is what to pick up" into "nothing is unblocked".
    @Test
    func `opening a view does not move the hero`() {
        let atRest = WorkRoomProjection.room(from: WorkFixture.reading, in: .allOpen)
        let filtered = WorkRoomProjection.room(from: WorkFixture.reading, in: .blocked)

        #expect(atRest.nextUp == filtered.nextUp)
    }

    /// Only priority takes ink. Two coloured chips would read as a scale, and the hero never
    /// renders a score.
    @Test
    func `only the priority reason is urgent`() {
        #expect(NextUp.Reason.highPriority.isUrgent)
        #expect(!NextUp.Reason.unblocked.isUrgent)
        #expect(!NextUp.Reason.next(chart: "#607").isUrgent)
    }
}

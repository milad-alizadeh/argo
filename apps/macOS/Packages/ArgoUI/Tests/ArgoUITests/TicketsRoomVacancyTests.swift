import ArgoEngine
@testable import ArgoUI
import Testing

/// The room's two vacancies, told apart (#818). Two different nothings: nobody was asked, and
/// somebody answered with nothing. Conflating them tells a reader their backlog is clear when in
/// fact nothing has been read.
@Suite("Tickets room vacancy")
struct TicketsRoomVacancyTests {
    @Test
    func `an unbound room is the unbound vacancy`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.unbound)

        #expect(room.vacancy == .unbound)
    }

    /// The other page names WHO answered — a backlog reported clear with no source is a claim
    /// nobody signed.
    @Test
    func `a provider that answered with nothing names itself`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.answeredEmpty)

        #expect(room.vacancy == .nothingOpen(provider: "GitHub"))
    }

    /// The connection chip is a property of the bound provider, so it goes when the binding does.
    @Test
    func `the provider foot is quiet when nothing is bound`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.unbound).provider == nil)
    }

    /// And it stays when the provider merely has nothing to say.
    @Test
    func `the provider foot is present when the provider answered with nothing`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.answeredEmpty).provider != nil)
    }

    @Test
    func `a room with open work has no vacancy`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.reading).vacancy == nil)
    }

    /// The sharpest edge: emptiness is judged over the whole open set, never over the pane. A view
    /// that happens to draw no rows must not announce that the backlog is clear.
    @Test
    func `an empty view is not an empty backlog`() {
        let unblocked = TicketsFixture.item(272, blockedBy: [])
        let room = TicketsRoomProjection.room(
            from: TicketsFixture.reading(of: [unblocked]),
            in: .blocked,
        )

        #expect(room.backlog.isEmpty)
        #expect(room.vacancy == nil)
    }

    /// Both sentences name the Project the window is scoped to, so the room has to carry it
    /// through the one case where nothing else survives.
    @Test
    func `an unbound room still knows which Project it is scoped to`() {
        #expect(TicketsRoomProjection.room(from: TicketsFixture.unbound).project == "argo")
    }
}

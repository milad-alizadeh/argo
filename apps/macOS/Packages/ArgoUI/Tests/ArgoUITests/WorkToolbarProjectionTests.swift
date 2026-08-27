@testable import ArgoUI
import Testing

/// What the Work room's toolbar reads off the room (#816). The heading is two lines because a title
/// without its count can lie about what you are filtered to, and the row's two vacancies are
/// different pages: an empty backlog keeps New ticket, an unbound provider keeps nothing.
@Suite("Work toolbar projection")
struct WorkToolbarProjectionTests {
    private static func reading(
        of view: WorkView = .allOpen,
        showing: Int? = 272,
    )
        -> WorkToolbarProjection.Reading {
        WorkToolbarProjection.reading(
            of: WorkRoomProjection.room(from: WorkFixture.reading, in: view),
            in: view,
            showing: showing,
        )
    }

    @Test
    func `the heading names the view and counts the rows the list draws`() {
        let room = WorkRoomProjection.room(from: WorkFixture.reading)

        #expect(Self.reading().heading == "Backlog")
        #expect(Self.reading().subtitle == "All open · \(room.backlog.count) tickets")
    }

    /// The whole reason the heading is two lines: switching view has to move BOTH halves, or the
    /// count stands under a name it no longer belongs to.
    @Test
    func `the count tracks the filter`() {
        let blocked = WorkRoomProjection.room(from: WorkFixture.reading, in: .blocked)

        #expect(Self.reading(of: .blocked).subtitle
            == "Blocked · \(blocked.backlog.count) tickets")
    }

    /// One ticket is `1 ticket`, not `1 tickets`. Cheap to get wrong and visible on every render of
    /// a filtered view.
    @Test
    func `a single ticket is counted in the singular`() {
        let one = WorkRoomProjection.room(from: WorkFixture.reading(of: [
            WorkFixture.item(272, blockedBy: []),
        ]))

        #expect(WorkToolbarProjection.reading(of: one, in: .allOpen, showing: nil).subtitle
            == "All open · 1 ticket")
    }

    @Test
    func `a backlog with rows carries every control`() {
        let reading = Self.reading()

        #expect(reading.narrows)
        #expect(reading.creates)
        #expect(reading.ticket == 272)
    }

    /// The moment you most want New ticket. What goes is what has nothing to act on: there is no
    /// list to narrow, nothing to search, and no ticket to start a Session on.
    @Test
    func `an empty backlog keeps New ticket and loses the rest`() {
        let empty = WorkRoomProjection.room(from: WorkFixture.answeredEmpty)
        let reading = WorkToolbarProjection.reading(of: empty, in: .allOpen, showing: 272)

        #expect(reading.creates)
        #expect(!reading.narrows)
        #expect(reading.ticket == nil)
        #expect(reading.subtitle == "All open · 0 tickets")
    }

    /// Nothing is bound, so there is nothing to create INTO — a different page from the one above,
    /// and the row empties rather than keeping the call-to-action over a provider nobody asked.
    @Test
    func `an unbound provider empties the row`() {
        let reading = WorkToolbarProjection.reading(
            of: WorkRoomProjection.room(from: WorkFixture.unbound),
            in: .allOpen,
            showing: 272,
        )

        #expect(reading == .none)
        #expect(!reading.draws)
    }

    /// The verbs address the ticket the deck is OPEN on, not whatever is in the backlog — with no
    /// ticket open there is nothing for Start, open-on-host or copy link to name.
    @Test
    func `the ticket verbs go with the ticket`() {
        #expect(Self.reading(showing: nil).ticket == nil)
        #expect(Self.reading(showing: nil).narrows)
    }
}

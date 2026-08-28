@testable import ArgoUI
import Testing

/// What the Tickets room's chrome reads off the room (#816) — the two bands and the window's row,
/// one value between them (#836). The heading is two lines because a title without its count can
/// lie about what you are filtered to, and the room's two vacancies are different pages: an empty
/// backlog keeps New ticket, an unbound provider keeps nothing.
@Suite("Tickets chrome projection")
struct TicketsChromeProjectionTests {
    private static func reading(
        of view: TicketsView = .allOpen,
        showing: Int? = 272,
    )
        -> TicketsChromeProjection.Reading {
        TicketsChromeProjection.reading(
            of: TicketsRoomProjection.room(from: TicketsFixture.reading, in: view),
            in: view,
            showing: showing,
        )
    }

    /// Spelled out rather than interpolated from the projection: an expectation built from the
    /// value under test passes whatever that value is, which is no expectation at all. 12 is the
    /// fixture's open set, and the design's renders read the same.
    @Test
    func `the heading names the view and counts every ticket in it`() {
        #expect(Self.reading().heading == "Backlog")
        #expect(Self.reading().subtitle == "All open · by priority · 12 tickets")
    }

    /// The count is the VIEW's, not the tree's top level (#814). Counting rows would report the
    /// roots — five, where the view holds twelve — and would fall every time a reader folded a
    /// parent, which changes what is on screen and not what the filter holds.
    @Test
    func `the count is of tickets, not of the rows the tree happens to draw`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)

        #expect(room.backlog.count < 12)
        #expect(Self.reading().subtitle == "All open · by priority · 12 tickets")
    }

    /// The middle term names the grouping in force, and it arrived WITH the grouping (#819). It
    /// was absent through #812 and #814 because a heading reading `by priority` over an ungrouped
    /// list is the exact lie the second line exists to prevent.
    @Test
    func `the subtitle names the grouping the list is under`() {
        #expect(Self.reading().subtitle.contains("by priority"))
        #expect(Self.reading(of: .blocked).subtitle.contains("by priority"))
    }

    /// The whole reason the heading is two lines: switching view has to move BOTH halves, or the
    /// count stands under a name it no longer belongs to.
    @Test
    func `the count tracks the filter`() {
        #expect(Self.reading(of: .blocked).subtitle == "Blocked · by priority · 8 tickets")
        #expect(Self.reading(of: .unblocked).subtitle == "Unblocked · by priority · 4 tickets")
    }

    /// One ticket is `1 ticket`, not `1 tickets`. Cheap to get wrong and visible on every render of
    /// a filtered view.
    @Test
    func `a single ticket is counted in the singular`() {
        let one = TicketsRoomProjection.room(from: TicketsFixture.reading(of: [
            TicketsFixture.item(272, blockedBy: []),
        ]))

        #expect(TicketsChromeProjection.reading(of: one, in: .allOpen, showing: nil).subtitle
            == "All open · by priority · 1 ticket")
    }

    @Test
    func `a backlog with rows carries every control`() {
        let reading = Self.reading()

        #expect(reading.narrows)
        #expect(reading.draws)
        #expect(reading.ticket == 272)
    }

    /// The moment you most want New ticket. What goes is what has nothing to act on: there is no
    /// list to narrow, nothing to search, and no ticket to start a Session on.
    @Test
    func `an empty backlog keeps New ticket and loses the rest`() {
        let empty = TicketsRoomProjection.room(from: TicketsFixture.answeredEmpty)
        let reading = TicketsChromeProjection.reading(of: empty, in: .allOpen, showing: 272)

        #expect(reading.draws)
        #expect(!reading.narrows)
        #expect(reading.ticket == nil)
        #expect(reading.subtitle == "All open · by priority · 0 tickets")
    }

    /// Nothing is bound, so there is nothing to create INTO — a different page from the one above,
    /// and the chrome empties rather than keeping the call-to-action over a provider nobody asked.
    @Test
    func `an unbound provider empties the chrome`() {
        let reading = TicketsChromeProjection.reading(
            of: TicketsRoomProjection.room(from: TicketsFixture.unbound),
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
    }
}

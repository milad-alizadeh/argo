@testable import ArgoUI
import Testing

/// What the backlog's search field narrows, and what the heading over the narrowed list says
/// (#873). The field took a query and returned the whole list for three tickets, which is worse
/// than a control that does nothing visible: a full list under a typed query claims that no ticket
/// was excluded, and the claim was false.
///
/// The vocabulary is `cockpit-work-room.md` — **the two narrowings, decided**.
@Suite("Backlog search")
@MainActor
struct BacklogSearchTests {
    private static func room(matching query: String, in view: TicketsView = .allOpen)
        -> TicketsRoomProjection.Room {
        TicketsRoomProjection.room(from: TicketsFixture.reading, in: view, matching: query)
    }

    /// Every row the list draws, at every depth — the count the reader can see, as opposed to the
    /// count of matches the heading states.
    private static func rows(of room: TicketsRoomProjection.Room) -> [Int] {
        TicketsRoomProjection.drawn(room.backlog, shut: []).map(\.id)
    }

    // MARK: - What a query matches

    @Test
    func `a query narrows the backlog to the tickets whose titles hold it`() {
        #expect(Self.rows(of: Self.room(matching: "graphite")) == [275])
    }

    /// The provider's own case is not the reader's. Nobody types `Prototype` to find `Prototype`.
    @Test
    func `a query matches a title whatever case either is in`() {
        #expect(Self.rows(of: Self.room(matching: "TRANSPORT")) == [763])
    }

    /// The number is what a reader has in hand coming from anywhere else in the app, and `#` is
    /// how this room writes one everywhere else.
    @Test(arguments: ["763", "#763"])
    func `a query matches a ticket by its number`(typed: String) {
        #expect(Self.rows(of: Self.room(matching: typed)) == [763])
    }

    /// A blank field is not a query. Matching everything by accident would be the same false claim
    /// the other way round: a list narrowed to itself, under a heading saying it was searched.
    @Test
    func `a field holding only spaces is not a query`() {
        #expect(Self.room(matching: "   ").narrowing == nil)
        #expect(Self.rows(of: Self.room(matching: "   ")) == Self.rows(of: Self.room(matching: "")))
    }

    /// The query narrows WITHIN the view the sidebar has open, never across it — the two compose
    /// by intersection, in that order.
    @Test
    func `a query narrows within the open view rather than across it`() {
        let everywhere = Self.rows(of: Self.room(matching: "the", in: .allOpen))
        let blocked = Self.rows(of: Self.room(matching: "the", in: .blocked))

        #expect(!blocked.isEmpty)
        #expect(Set(blocked).isSubset(of: Set(everywhere)))
        #expect(blocked != everywhere)
    }

    // MARK: - The rails a match hangs from

    /// The list's structure is "priority groups the roots, a child hangs under its parent" (#819,
    /// #814). A match whose parent does not match cannot vanish with it, or the heading counts a
    /// ticket the reader can never reach. #336 hangs under #334, which hangs under #607, and
    /// neither ancestor holds the word.
    @Test
    func `a matching child under a non-matching parent keeps its parents`() {
        #expect(Self.rows(of: Self.room(matching: "canvas")) == [607, 334, 336])
    }

    /// A rail is on screen for its child's sake, so it is marked as one — the row draws its title
    /// demoted, and a reader is never left counting rails as results.
    @Test
    func `a parent kept for its child's sake is a rail`() {
        let drawn = TicketsRoomProjection.drawn(Self.room(matching: "canvas").backlog, shut: [])
        let rails = drawn.filter(\.row.isRail).map(\.id)

        #expect(rails == [607, 334])
    }

    @Test
    func `the row that matched is not a rail`() {
        let drawn = TicketsRoomProjection.drawn(Self.room(matching: "canvas").backlog, shut: [])

        #expect(drawn.first { $0.id == 336 }?.row.isRail == false)
    }

    /// An ancestor the VIEW excluded is not brought back: #609 matches under `Unblocked` and #607
    /// — its parent, and blocked — stays out. The match stands as a root rather than dragging a
    /// row past the filter the sidebar is holding.
    @Test
    func `a match keeps no rail the view already excluded`() {
        #expect(Self.rows(of: Self.room(matching: "Prototype", in: .unblocked)) == [609])
    }

    @Test
    func `a rail is not counted as a result`() {
        #expect(Self.room(matching: "canvas").narrowing?.matches == 1)
    }

    /// Nothing is a rail when nothing is narrowing: the tree the reader browses is all matches by
    /// definition.
    @Test
    func `an unsearched backlog has no rails in it`() {
        let drawn = TicketsRoomProjection.drawn(Self.room(matching: "").backlog, shut: [])

        #expect(!drawn.contains { $0.row.isRail })
    }

    // MARK: - Nothing matched

    @Test
    func `a query that matches nothing empties the list`() {
        #expect(Self.room(matching: "zzzzz").backlog.isEmpty)
        #expect(Self.room(matching: "zzzzz").narrowing?.matches == 0)
    }

    /// A query that matched nothing is a fact about the QUERY, and the room's three vacancies are
    /// facts about the provider. Conflating them would replace both panes over a typo.
    @Test
    func `a query that matches nothing is not one of the room's vacancies`() {
        #expect(Self.room(matching: "zzzzz").vacancy == nil)
    }

    // MARK: - What the heading says

    private static func chrome(matching query: String, in view: TicketsView = .allOpen)
        -> TicketsChromeProjection.Reading {
        TicketsChromeProjection.reading(of: room(matching: query, in: view), in: view, showing: nil)
    }

    /// Spelled out rather than interpolated from the projection: an expectation built from the
    /// value under test passes whatever that value is.
    @Test
    func `the heading says it is searching while a query narrows the list`() {
        #expect(Self.chrome(matching: "graphite").heading == "Searching")
    }

    /// `results` and not `tickets`: the count is of matches, and the rows on screen can exceed it
    /// by the rails.
    @Test
    func `the count under a search is of results, not of tickets`() {
        #expect(Self.chrome(matching: "canvas").subtitle == "All open · by priority · 1 result")
        #expect(Self.chrome(matching: "the").subtitle.hasSuffix(" results"))
    }

    @Test
    func `clearing the field returns the heading to the list it names`() {
        #expect(Self.chrome(matching: "").heading == "Backlog")
    }

    @Test
    func `clearing the field returns the count to the view's own`() {
        #expect(Self.chrome(matching: "").subtitle == "All open · by priority · 12 tickets")
    }

    /// The heading reads in the order the narrowings compose: the view, the grouping, then what the
    /// query left of it.
    @Test
    func `a search under a view still names the view it narrowed`() {
        #expect(Self.chrome(matching: "the", in: .blocked).subtitle.hasPrefix("Blocked · "))
    }

    /// The one that would strand a reader: a field that removes itself the moment it matches
    /// nothing is a field nobody can clear.
    @Test
    func `a query that matches nothing keeps the controls that can clear it`() {
        #expect(Self.chrome(matching: "zzzzz").narrows)
    }

    @Test
    func `a query that matches nothing states the empty rather than leaving the pane blank`() {
        let stated = Self.chrome(matching: "zzzzz").empty

        #expect(stated?.contains("zzzzz") == true)
        #expect(stated?.contains("All open") == true)
    }

    /// The ticket beside the list is still open when the query matched nothing, so the verbs that
    /// address it stay. They follow the ticket, not the rows.
    @Test
    func `a query that matches nothing leaves the open ticket's verbs standing`() {
        let room = Self.room(matching: "zzzzz")
        let chrome = TicketsChromeProjection.reading(of: room, in: .allOpen, showing: 272)

        #expect(room.ticket != nil)
        #expect(chrome.ticket == 272)
    }

    @Test
    func `a list with rows in it states no empty`() {
        #expect(Self.chrome(matching: "graphite").empty == nil)
        #expect(Self.chrome(matching: "").empty == nil)
    }

    /// The pane draws everything open while a query is narrowing: a fold that hid the only match
    /// would leave the heading claiming a result nobody can see.
    @Test
    func `a search draws the tree open whatever the reader folded`() {
        #expect(Self.chrome(matching: "canvas").structure.folds == false)
        #expect(Self.chrome(matching: "").structure.folds)
    }
}

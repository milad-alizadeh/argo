import ArgoEngine
@testable import ArgoUI
import Testing

/// How priority and nesting share one list (#819). Priority groups the ROOTS and a child hangs
/// under its parent whatever its own priority is, so a band's header stands over rows that can
/// disagree with it — and where one does, the row says so rather than the header speaking for it.
@Suite("Priority groups the backlog roots")
@MainActor
struct TicketsBacklogBandsTests {
    private static var roots: [TicketsRoomProjection.Row] {
        TicketsRoomProjection.room(from: TicketsFixture.reading).backlog
    }

    @Test
    func `the roots band by their own priority word, in the order the headers stand`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        #expect(bands.map(\.priority) == ["high", "medium", "low"])
        #expect(bands.map { $0.roots.map(\.id) } == [[607], [763], [275, 185, 160]])
    }

    /// The conflict the design resolves: #273 and #334 are `medium` and #336 is `low`, and all
    /// three stay under #607 in `HIGH` rather than leaving for their own band.
    @Test
    func `a child never leaves its parent to join its own priority band`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        #expect(TicketsRoomProjection.drawn(bands[0], shut: []).map(\.id)
            == [607, 609, 388, 334, 336, 335, 273, 272])
        #expect(bands[1].roots.map(\.id) == [763])
    }

    /// A header counts the rows it DRAWS — eight under `HIGH` is one root and its seven
    /// descendants — so folding lowers it and unfolding restores it. A subtree count would stand
    /// over one visible row and read as a lie.
    @Test
    func `a band counts the rows it draws, and the fold moves the number`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        #expect(bands.map { TicketsRoomProjection.drawn($0, shut: []).count } == [8, 1, 3])
        #expect(bands.map { TicketsRoomProjection.drawn($0, shut: [607]).count } == [1, 1, 3])
        #expect(bands.map { TicketsRoomProjection.drawn($0, shut: []).count } == [8, 1, 3])
    }

    /// A child under a header it disagrees with states its own priority; one that agrees states
    /// nothing, because the header already said it.
    @Test
    func `only a child whose priority differs from its header states one`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        let drawn = TicketsRoomProjection.drawn(bands[0], shut: [])
        let stated = drawn.filter { $0.odd != nil }
        #expect(stated.map(\.id) == [334, 336, 335, 273])
        #expect(stated.map(\.odd) == ["medium", "low", "medium", "medium"])
    }

    /// A root always agrees with the header it is under — the header is derived from it.
    @Test
    func `a root states nothing under its own band`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        #expect(bands.flatMap { TicketsRoomProjection.drawn($0, shut: []) }
            .filter { $0.depth == 0 }.allSatisfy { $0.odd == nil })
    }

    /// The caption holds one fact. #334 is a `medium` under `HIGH` AND a parent, and the roll-up
    /// is what it draws — the two never collide.
    @Test
    func `a parent's roll-up wins the trailing slot over an odd priority`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        let route = TicketsRoomProjection.drawn(bands[0], shut: []).first { $0.id == 334 }
        #expect(route?.odd == "medium")
        #expect(route?.row.trailing == "0/2")
        #expect(route?.caption(asOf: TicketsFixture.asOf) == "0/2")
    }

    /// A leaf with an odd priority has the slot to itself.
    @Test
    func `a leaf's odd priority takes the caption slot`() {
        let bands = TicketsRoomProjection.bands(of: Self.roots)

        let planner = TicketsRoomProjection.drawn(bands[0], shut: []).first { $0.id == 273 }
        #expect(planner?.row.trailing == nil)
        #expect(planner?.caption(asOf: TicketsFixture.asOf) == "medium")
    }

    /// No port reads a priority yet (#388), so a reading with none is the state that ships. Those
    /// roots keep their rows under a header that says nothing was read rather than being sorted
    /// into a band nobody named — and a row lost to a missing fact would be the worse failure.
    @Test
    func `roots with no priority read band under a header that says so`() {
        let items = [
            Ticket(number: 1, title: "First", status: "Todo", closure: .open),
            Ticket(number: 2, title: "Second", status: "Todo", closure: .open),
        ]
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading(of: items))

        let bands = TicketsRoomProjection.bands(of: room.backlog)
        #expect(bands.map(\.priority) == [nil])
        #expect(bands.map(\.label) == ["no priority read"])
        #expect(TicketsRoomProjection.drawn(bands[0], shut: []).count == 2)
    }

    /// The unread band sits at the FOOT, under every band a word was read for.
    @Test
    func `the unread band comes last`() {
        let reading = TicketsFixture.reading { priorities in priorities = [607: "high"] }
        let room = TicketsRoomProjection.room(from: reading)

        #expect(TicketsRoomProjection.bands(of: room.backlog).map(\.priority) == ["high", nil])
    }

    /// Argo does not RANK a priority, it matches the words it has headers for. A word it has no
    /// band for keeps its own header rather than being folded into one of the three.
    @Test
    func `a word Argo has no band for keeps its own header`() {
        let reading = TicketsFixture.reading { priorities in priorities[275] = "critical" }
        let room = TicketsRoomProjection.room(from: reading)

        #expect(TicketsRoomProjection.bands(of: room.backlog).map(\.priority)
            == ["high", "medium", "low", "critical"])
    }

    /// A tracker that spells one of its own words `Low` must not open a second band beside the
    /// `low` one, headed with the same word. The match folds case; the WORD is still the
    /// provider's, verbatim, and `GroupLabel` is what uppercases it.
    @Test
    func `two spellings of one word are one band`() {
        let reading = TicketsFixture.reading { priorities in priorities[275] = "Low" }
        let room = TicketsRoomProjection.room(from: reading)

        let bands = TicketsRoomProjection.bands(of: room.backlog)
        #expect(bands.count == 3)
        #expect(bands[2].roots.map(\.id) == [275, 185, 160])
        #expect(bands[2].priority == "Low")
    }

    /// A child agrees with its header on the same terms, or #275's siblings would each be told
    /// they disagree with a header spelled differently from them.
    @Test
    func `a child agrees with a header spelled in another case`() {
        let reading = TicketsFixture.reading { priorities in priorities[607] = "HIGH" }
        let room = TicketsRoomProjection.room(from: reading)

        let high = TicketsRoomProjection.bands(of: room.backlog)[0]
        let drawn = TicketsRoomProjection.drawn(high, shut: [])
        #expect(drawn.first { $0.id == 609 }?.odd == nil)
    }

    /// A band nobody read a priority for and one whose word is empty are different bands. Sharing a
    /// `ForEach` key would draw one and drop the other, which is a row lost to a bad id.
    @Test
    func `the unread band and an empty word do not share a key`() {
        let reading = TicketsFixture.reading { priorities in priorities = [275: ""] }
        let room = TicketsRoomProjection.room(from: reading)

        let bands = TicketsRoomProjection.bands(of: room.backlog)
        #expect(Set(bands.map(\.id)).count == bands.count)
        #expect(bands.map(\.priority) == ["", nil])
    }
}

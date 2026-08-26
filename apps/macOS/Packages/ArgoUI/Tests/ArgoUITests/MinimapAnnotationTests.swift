import AppKit
@testable import ArgoUI
import Testing

/// What the lane says about the Turn under the pointer (#382), and what it costs to say it.
///
/// The cost is half the point. A minimap that re-rasterises its miniature every time the pointer
/// crosses it is the same bug as one that does it on every scroll frame — invisible, and read as a
/// feed gone heavy three surfaces from the cause.
@Suite("Minimap annotations")
@MainActor
struct MinimapAnnotationTests {
    private static func mounted() -> MinimapLaneFixture.Mounted {
        MinimapLaneFixture.mounted(over: FeedProjection.longRows)
    }

    private static func pointer(_ kind: NSEvent.EventType, at laneY: CGFloat) -> NSEvent? {
        MinimapLaneFixture.pointer(kind, at: laneY)
    }

    @Test
    func `a lane nobody is pointing at marks no Turn`() {
        #expect(Self.mounted().lane.marking.isEmpty)
    }

    @Test
    func `the pointer marks the Turn it is over`() throws {
        let deck = Self.mounted()

        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 120)))

        let annotated = try #require(deck.lane.marking.first)
        #expect(deck.lane.marking.count == 1)
        #expect(annotated.span.contains(120))
    }

    @Test
    func `the pointer leaving the lane unmarks what it named`() throws {
        let deck = Self.mounted()
        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 120)))

        // A move event: `NSEvent.mouseEvent` refuses to build an exit one, and the handler reads
        // nothing off the event it is handed.
        try deck.lane.mouseExited(with: #require(Self.pointer(.mouseMoved, at: 120)))

        #expect(deck.lane.marking.isEmpty)
    }

    /// The second Turn on screen, and where the pointer has to be to be over each of its ROWS.
    ///
    /// Resolved from the Turn's own extents rather than from `blocks(in:)`, so the expectations
    /// below are the reading's boundaries and not the lane's own answer restated (#732).
    private static func secondTurn(_ deck: MinimapLaneFixture.Mounted)
        throws -> (turn: MinimapTurn, laneYs: [CGFloat]) {
        let lane = deck.lane
        let turn = try #require(MinimapTurn.extents(of: lane.geometry.reading.rows)
            .dropFirst().first { $0.rows.count > 1 })
        let slide = lane.geometry.laneOffset(at: deck.feed.offset() ?? 0)
        return (turn, turn.rows.map { lane.geometry.rectY(row: $0) + 1 - slide })
    }

    /// #732 read the mark as covering the prompt alone. It does not: standing over ANY of the
    /// Turn's rows — the last as much as the prompt's own — names the same Turn with the same
    /// words, which is the ticket's acceptance and the claim nothing here previously made.
    @Test
    func `the pointer names one Turn from every row of it`() throws {
        let deck = Self.mounted()
        let (turn, laneYs) = try Self.secondTurn(deck)

        for laneY in laneYs {
            try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: laneY)))
            #expect(deck.lane.marking.map(\.words) == [turn.prompt])
        }
    }

    /// And the line under those words spans the whole Turn: from the head of its first row to
    /// where the row after its last one begins. A mark ending at the prompt's own foot would name
    /// the Turn from one bubble's worth of the lane and nowhere else.
    @Test
    func `the mark spans the Turn from its first row to past its last`() throws {
        let deck = Self.mounted()
        let (turn, laneYs) = try Self.secondTurn(deck)
        let slide = deck.lane.geometry.laneOffset(at: deck.feed.offset() ?? 0)
        let head = deck.lane.geometry.rectY(row: turn.rows.lowerBound) - slide
        let foot = deck.lane.geometry.rectY(row: turn.rows.upperBound + 1) - slide

        let overTheFirstRow = try #require(laneYs.first)
        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: overTheFirstRow)))

        #expect(deck.lane.marking.map(\.span) == [head ... foot])
    }

    /// The other place #732 could have gone wrong: a zone cut over the prompt's rows alone would
    /// leave the pointer unheard everywhere else, and the mark would read as covering the prompt
    /// however right the block underneath it was. One zone, the lane's whole height.
    @Test
    func `the pointer is heard over the lane's whole height`() {
        let lane = Self.mounted().lane

        lane.updateTrackingAreas()

        #expect(lane.trackingAreas.map(\.rect) == [lane.bounds])
        #expect(lane.trackingAreas.allSatisfy { $0.options.contains(.mouseMoved) })
    }

    /// The whole reason the annotations are their own layer. A pointer crossing the lane must not
    /// cost the miniature a single rasterise.
    @Test
    func `naming a Turn repaints nothing in the miniature`() throws {
        let deck = Self.mounted()
        let drawn = deck.lane.rectRedraws

        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 60)))
        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 300)))

        #expect(deck.lane.rectRedraws == drawn)
        #expect(deck.lane.annotationRedraws > 0)
    }

    /// A Turn is many points tall, so most of a pointer's travel across the lane is inside the one
    /// it is already naming — and re-drawing the same annotation is a bitmap for nothing.
    @Test
    func `a pointer moving inside the Turn it already named draws nothing again`() throws {
        let deck = Self.mounted()
        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 120)))
        let drawn = deck.lane.annotationRedraws

        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 121)))

        #expect(deck.lane.annotationRedraws == drawn)
    }

    @Test
    func `holding shift and command marks every Turn on screen at once`() throws {
        let deck = Self.mounted()
        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 120)))

        deck.lane.readModifiers([.shift, .command])

        #expect(deck.lane.marking.count > 1)
    }

    /// Labels drawn on top of each other are none of them, so the lane drops the WORDS from any
    /// that would not fit.
    @Test
    func `no two Turns are labelled closer together than a label can be read`() {
        let deck = Self.mounted()
        deck.lane.readModifiers([.shift, .command])

        let labelled = deck.lane.marking
            .filter { $0.words != nil }
            .map { $0.labelY(inside: MinimapLaneFixture.column.height) }
        #expect(!labelled.isEmpty)
        #expect(zip(labelled, labelled.dropFirst()).allSatisfy {
            $1 - $0 >= ArgoMinimapLane.labelHeight
        })
    }

    /// The line says a Turn is THERE, which stays true whether or not there is room to say what it
    /// asked. A crowded label may lose its words; its Turn may not lose its mark.
    ///
    /// Against `legible` itself rather than the mounted lane: whether any two Turns in the fixture
    /// land within a label of each other follows from the rows' MEASURED heights, so a lane asked
    /// for the crowded case answers differently on a machine whose text metrics differ.
    @Test
    func `a Turn too crowded to label keeps its line and loses its words`() {
        let crowding = ArgoMinimapLane.labelHeight / 2
        let annotations = [
            MinimapAnnotation(span: 0 ... 50, words: "first"),
            MinimapAnnotation(span: crowding ... 60, words: "under the first"),
            MinimapAnnotation(span: 200 ... 260, words: "clear of both"),
        ]

        let legible = MinimapAnnotation.legible(annotations, inside: 480)

        #expect(legible.map(\.words) == ["first", nil, "clear of both"])
        #expect(legible.map(\.span) == annotations.map(\.span))
    }

    /// Whatever the crowding costs a label, every Turn named at once still has a line to stand on.
    @Test
    func `every Turn named at once keeps a line`() {
        let deck = Self.mounted()
        deck.lane.readModifiers([.shift, .command])

        let annotated = deck.lane.marking
        #expect(!annotated.isEmpty)
        #expect(annotated.allSatisfy { $0.span.upperBound > $0.span.lowerBound })
    }
}

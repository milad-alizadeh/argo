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

        let marked = try #require(deck.lane.marking.first)
        #expect(deck.lane.marking.count == 1)
        #expect(marked.span.contains(120))
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

    /// The whole reason the annotations are their own layer. A pointer crossing the lane must not
    /// cost the miniature a single rasterise.
    @Test
    func `naming a Turn repaints nothing in the miniature`() throws {
        let deck = Self.mounted()
        let drawn = deck.lane.markRedraws

        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 60)))
        try deck.lane.mouseMoved(with: #require(Self.pointer(.mouseMoved, at: 300)))

        #expect(deck.lane.markRedraws == drawn)
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
    func `every Turn marked at once keeps a line`() {
        let deck = Self.mounted()
        deck.lane.readModifiers([.shift, .command])

        let marked = deck.lane.marking
        #expect(!marked.isEmpty)
        #expect(marked.allSatisfy { $0.span.upperBound > $0.span.lowerBound })
    }
}

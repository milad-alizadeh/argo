import AppKit
@testable import ArgoUI
import Testing

/// What a drag on an edge costs the geometry: nothing at all while it runs, and one pass when it
/// ends (ADR-0030, Rule 6).
///
/// The claim is not about how a pass is scheduled. It is what a reader sees — rows that do not move
/// under the hand, and a document at the width they let go on that is the document a fresh measure
/// at that width would have produced. Counted in measurements, never in seconds: a measurement is
/// one row typeset, and the count is what the drag cost rather than what the machine was doing.
@Suite("Feed resize freeze")
@MainActor
struct FeedResizeFreezeTests {
    /// The widths one drag crosses, and the one it ends on. Far enough apart that every row of the
    /// fixture re-wraps at each of them.
    private static let widths: [CGFloat] = [400, 340, 300]
    private static let landed: CGFloat = 300

    private static let rows = (0 ..< 120).map {
        FeedRow(
            id: $0,
            content: .message("A line of prose long enough to wrap the pane, number \($0)."),
        )
    }

    @Test
    func `a drag through three widths measures nothing and moves no row`() async throws {
        let deck = try await FeedDraggedDeck.opened(over: Self.rows)
        let measured = deck.coordinator.measurements
        let stood = try deck.heights()

        deck.began()
        for width in Self.widths {
            deck.widen(to: width)
        }
        try await Self.quietElapsed()

        #expect(deck.coordinator.measurements == measured)
        #expect(try deck.heights() == stood)
        #expect(deck.coordinator.geometry.settled?.stamp.width == FeedDraggedDeck.opening.width)
        // Clipped and unreflowed: the rows are still DRAWN across the width they were measured at,
        // so no visible cell re-wraps at drag rate under heights that are not allowed to follow.
        #expect(deck.table.frame.width == FeedDraggedDeck.opening.width)
    }

    @Test
    func `the drag ending measures the reading once, at the width it ended on`() async throws {
        let deck = try await FeedDraggedDeck.opened(over: Self.rows)
        let measured = deck.coordinator.measurements

        deck.began()
        for width in Self.widths {
            deck.widen(to: width)
        }
        try await Self.quietElapsed()
        await deck.ended()

        #expect(deck.coordinator.measurements - measured == Self.rows.count)
        #expect(deck.coordinator.geometry.settled?.stamp.width == Self.landed)
        #expect(deck.table.frame.width == Self.landed)
    }

    /// The half a count cannot say: one pass is worth nothing if the document it leaves is not the
    /// document the reader would have had by opening the reading at that width to begin with.
    @Test
    func `the heights a drag ends on are the heights a fresh measure gives`() async throws {
        let deck = try await FeedDraggedDeck.opened(over: Self.rows)

        deck.began()
        for width in Self.widths {
            deck.widen(to: width)
        }
        await deck.ended()

        let afresh = await FeedTableFixture.laidOut(
            Self.rows,
            in: CGSize(width: Self.landed, height: FeedDraggedDeck.opening.height),
            through: FeedTableHandle(),
        )
        #expect(try deck.heights() == afresh.geometry.settled?.everyHeight)
    }

    /// One reading re-wraps and the other does not: heights are held per reading
    /// (`FeedGeometries`), so a drag moves the width of the reading on screen and of nothing else.
    ///
    /// The CONTRAST is the claim, and it is why both halves are asserted in one case. A drag that
    /// dropped or re-measured every store it could reach would fail on the reading nobody was
    /// looking at; a freeze that stuck on would fail on the one they were.
    ///
    /// A floor rather than the whole of what #1116 asks for. "Hidden kept decks are not remeasured"
    /// is a claim about decks, and a deck a reader has left does not survive at all until #1113 —
    /// so until it does, a reading's heights are all there is to be spared.
    @Test
    func `the drag re-wraps the reading on screen and no other`() async throws {
        let deck = await FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let alpha = deck.geometries.geometry(for: FeedSwitchFixture.alpha)
        let bravo = deck.geometries.geometry(for: FeedSwitchFixture.bravo)
        let stood = try #require(alpha.settled)
        let dragged = try FeedDraggedDeck(deck.coordinator)

        dragged.began()
        dragged.widen(to: Self.widths[0])
        await dragged.ended()

        #expect(alpha.settled?.everyHeight == stood.everyHeight)
        #expect(alpha.settled?.stamp.width == stood.stamp.width)
        #expect(bravo.settled?.stamp.width == Self.widths[0])
    }

    /// The other half: the reading that was spared the drag's pass pays for it on its next SHOW,
    /// at the width the reader actually left the window at.
    @Test
    func `the reading measures at the fresh width on its next show`() async throws {
        let deck = await FeedSwitchDeck()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)
        await deck.show(FeedSwitchFixture.bravoRows, of: FeedSwitchFixture.bravo)
        let alpha = deck.geometries.geometry(for: FeedSwitchFixture.alpha)
        let dragged = try FeedDraggedDeck(deck.coordinator)

        dragged.began()
        dragged.widen(to: Self.widths[0])
        await dragged.ended()
        await deck.show(FeedSwitchFixture.alphaRows, of: FeedSwitchFixture.alpha)

        #expect(alpha.settled?.stamp.width == Self.widths[0])
    }

    /// A drag that ends on a reading Argo cannot measure inside the motion ceiling gives its stale
    /// document up, and the deck stands in `FeedVacancy.unread` — the same word and indicator a
    /// first open shows (ADR-0030, Rule 6).
    ///
    /// Driven at the decision rather than through the clock that reaches it, so the case is not a
    /// half-second sleep whose answer depends on the machine. `FeedVacancy.words(overdue:)` is
    /// reached the same way, for the same reason.
    @Test
    func `a re-wrap that outlasts the delay gives up the document it was holding`() async throws {
        let deck = try await FeedDraggedDeck.opened(over: Self.rows)
        deck.began()
        deck.widen(to: Self.landed)
        deck.table.liveResizeEnded?()

        // The pass is in flight and the rows the reader had are still on screen: a drag end that
        // blanked the deck outright would flash on every reading Argo measures inside a frame.
        #expect(deck.coordinator.surrendersHeld)
        #expect(deck.coordinator.geometry.isSettled)
        deck.coordinator.surrenderHeld()

        #expect(!deck.coordinator.geometry.isSettled)
        await FeedTableFixture.settled(deck.coordinator)
        #expect(deck.coordinator.geometry.settled?.stamp.width == Self.landed)
    }

    /// The other side of that decision: a pass that has already landed put its own document up, so
    /// a clock running out behind it has nothing to give up.
    @Test
    func `a landed pass leaves nothing for the hold to give up`() async throws {
        let deck = try await FeedDraggedDeck.opened(over: Self.rows)
        deck.began()
        deck.widen(to: Self.landed)
        await deck.ended()

        #expect(!deck.coordinator.surrendersHeld)
        deck.coordinator.surrenderHeld()

        #expect(deck.coordinator.geometry.settled?.stamp.width == Self.landed)
    }

    /// The drag that can never end: a table taken out of its window mid-drag hears no
    /// `viewDidEndLiveResize` from AppKit, and a freeze left latched there is a reading nothing
    /// would measure again for the life of the window.
    @Test
    func `a table taken out of its window mid-drag is not left frozen`() async throws {
        let deck = try await FeedDraggedDeck.opened(over: Self.rows)
        // In a real window, because that is the whole subject: the callback under test fires on a
        // view whose window CHANGES, and a table that never had one has nothing to be taken out of.
        let window = NSWindow(
            contentRect: deck.scroller.frame,
            styleMask: [.titled],
            backing: .buffered,
            defer: false,
        )
        window.contentView = deck.scroller
        deck.began()
        deck.widen(to: Self.landed)
        #expect(deck.table.isFrozen)

        window.contentView = NSView(frame: deck.scroller.frame)

        #expect(!deck.coordinator.isDragging)
        #expect(!deck.table.isFrozen)
    }

    /// Longer than the quiet a width burst is normally answered after, so a case that measured
    /// nothing measured nothing because the table was frozen rather than because it did not wait.
    private static func quietElapsed() async throws {
        try await Task.sleep(for: .milliseconds(FeedTableCoordinator.quietMilliseconds + 150))
    }
}

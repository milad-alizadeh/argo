import AppKit
@testable import ArgoUI
import Testing

/// The seam ADR-0030 Rule 3 adds, held to the four things it promises: it is complete or absent and
/// never partial; it is produced off the main actor; it changes only by growth at the tail and by
/// one row replaced in place; and a document that stands does not move while the reader scrolls
/// through it.
///
/// Driven from outside — a height, a state, a position — never from how the pass is scheduled or
/// which type holds the store. What a reader would see, said as a number.
@Suite("Feed settled document")
@MainActor
struct FeedSettledDocumentTests {
    /// Longer than the pane can hold many times over, so most of the document is off screen — which
    /// is where every one of the defects ADR-0030 names lived.
    private static let rows = (0 ..< 300).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    private static let pane = CGSize(width: 460, height: 300)

    /// Complete or absent. The deck stands in `FeedVacancy.unread` for the whole span before it,
    /// and there is no half-measured document for anything to consume.
    @Test
    func `the deck has no document at all until the pass has measured every row`() async throws {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.mounting(
            Self.rows,
            in: Self.pane,
            keeping: FeedTableFixture.Kept(handle: handle, geometry: FeedGeometry()),
        )

        #expect(!table.geometry.isSettled)
        #expect(!handle.isSettled)
        #expect(table.table?.numberOfRows == 0)

        await FeedTableFixture.settled(table)

        #expect(handle.isSettled)
        #expect(table.geometry.count == Self.rows.count)
        #expect(try Self.heights(of: table).allSatisfy { $0 > 0 })
    }

    /// Rows appended at the tail are measured and inserted with every other height untouched —
    /// ADR-0030 Rule 5, and the whole of what a live Session does to a document.
    ///
    /// One row of the standing document does move, and it is named: the Turn's copy chip is drawn
    /// under the reading's LAST message, so an arriving message takes it off the one that had it
    /// (`FeedCopy.drawsChip(of:at:)`). Every row above that is the claim.
    @Test
    func `a tail append leaves every other height where it was`() async throws {
        let table = await Self.laidOut(Self.rows)
        let stood = try Self.heights(of: table)
        let chip = Self.rows.count - 1

        table.apply(FeedTableFixture.model(showing: Self.rows + Self.grown(4)))
        await FeedTableFixture.settled(table)

        let after = try Self.heights(of: table)
        #expect(after.count == Self.rows.count + 4)
        #expect(Array(after.prefix(chip)) == Array(stood.prefix(chip)))
        // The chip really did move, so the case is about a document that changed rather than one
        // nothing happened to.
        #expect(after[chip] < stood[chip])
        #expect(after[after.count - 1] == stood[chip])
    }

    /// A Result arriving late changes ONE row's height, and the rows above and below it stand
    /// exactly where they stood.
    @Test
    func `a row replaced in place leaves every other height where it was`() async throws {
        let table = await Self.laidOut(Self.rows)
        let stood = try Self.heights(of: table)
        var answered = Self.rows
        let at = answered.count - 1
        answered[at] = FeedRow(
            id: at,
            content: .message(String(repeating: "The Result arrived, and it is long. ", count: 20)),
        )

        table.apply(FeedTableFixture.model(showing: answered))
        await FeedTableFixture.settled(table)

        let after = try Self.heights(of: table)
        #expect(after[at] > stood[at])
        #expect(Array(after.prefix(at)) == Array(stood.prefix(at)))
    }

    /// The overview lane and the feed arrive together. There is no frame in which one of them is
    /// showing the reading and the other is not, because both read the same document — a lane with
    /// nothing to map answers `nil` rather than a map of the reading it last had.
    @Test
    func `the Minimap has nothing to map until the feed has a document, and both then`(
    ) async throws {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.mounting(
            Self.rows,
            in: Self.pane,
            keeping: FeedTableFixture.Kept(handle: handle, geometry: FeedGeometry()),
        )

        #expect(table.reading() == nil)
        #expect(table.readingStamp()?.isProvisional == true)

        await FeedTableFixture.settled(table)

        #expect(table.readingStamp()?.isProvisional == false)
        let reading = try #require(table.reading())
        #expect(reading.rows.count == Self.rows.count)
        // The lane maps the very heights the table draws, or a mark stands beside a row it is not
        // a mark for.
        #expect(try reading.rows.map(\.height) == (Self.heights(of: table)))
    }

    /// A Result that arrives while the reader is part-way down does not move what they are reading:
    /// the anchor is read before the heights change and landed after them (ADR-0030, Rule 5).
    @Test
    func `a row replaced in place holds the row the reader was on`() async throws {
        // The handle is kept by the CASE. A coordinator holds its handle weakly — the deck owns it
        // in the app — so a case that let it go would be asserting over a table with no policy to
        // answer where the reading should land, which answers `stay` to everything.
        let handle = FeedTableHandle()
        let table = await FeedTableFixture.laidOut(Self.rows, in: Self.pane, through: handle)
        let scroller = try #require(table.scroller)
        table.settle(at: Self.pane.height * 3, over: nil)
        scroller.layoutSubtreeIfNeeded()
        let anchored = try #require(table.anchor())

        var answered = Self.rows
        answered[1] = FeedRow(
            id: 1,
            content: .message(String(repeating: "A Result far above the reader. ", count: 20)),
        )
        table.apply(FeedTableFixture.model(showing: answered))
        await FeedTableFixture.settled(table)

        // The same row, still the same distance into it — the row above the viewport's top edge.
        #expect(table.anchor()?.row == anchored.row)
    }

    /// The reader scrolls the whole document and comes back, and not one row has moved. This is the
    /// property every defect ADR-0030 names is the absence of: a height corrected as its row
    /// scrolled into view is a document whose total height keeps changing under the scroller.
    @Test
    func `no row changes height while the reader scrolls top to bottom and back`() async throws {
        let table = await Self.laidOut(Self.rows)
        let before = try Self.heights(of: table)
        let scroller = try #require(table.scroller)

        for offset in Self.sweep(over: scroller, of: table) {
            table.settle(at: offset, over: nil)
            scroller.layoutSubtreeIfNeeded()
        }

        #expect(try Self.heights(of: table) == before)
        #expect(table.geometry.settled?.totalHeight == before.reduce(0, +))
    }

    /// Every offset a scroll top to bottom and back passes through, a viewport at a time.
    private static func sweep(over scroller: NSScrollView, of table: FeedTableCoordinator)
        -> [CGFloat] {
        let document = table.geometry.settled?.totalHeight ?? 0
        let step = max(1, scroller.contentView.bounds.height)
        let down = stride(from: 0, through: document, by: step).map(\.self)
        return down + down.reversed()
    }

    /// Rows a live Session appended after the ones the document holds.
    private static func grown(_ count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(
                id: rows.count + $0,
                content: .message("A line that arrived while the reader was reading, \($0)."),
            )
        }
    }

    /// Every row's height as the TABLE has it laid out — what a reader sees, not what a store says.
    private static func heights(of table: FeedTableCoordinator) throws -> [CGFloat] {
        let view = try #require(table.table)
        return (0 ..< view.numberOfRows).map { view.rect(ofRow: $0).height }
    }

    private static func stamp(of rows: [FeedRow]) -> FeedMeasureStamp {
        FeedMeasureStamp(of: FeedTableFixture.model(showing: rows), atWidth: pane.width)
    }

    private static func laidOut(_ rows: [FeedRow]) async -> FeedTableCoordinator {
        await FeedTableFixture.laidOut(rows, in: pane, through: FeedTableHandle())
    }
}

/// The pass runs off the main actor, measured as what the reader would feel. An extension so the
/// suite's own body stays inside its length gate; the private members it reads are in this file.
extension FeedSettledDocumentTests {
    /// Off the main actor, said as the count it is: not one chunk of the pass runs on the main
    /// thread, so a document of any size never costs the reader a dropped frame (ADR-0030 Rule 3,
    /// ADR-0028 Rule 8).
    ///
    /// A COUNT and not a stopwatch, and the stopwatch it replaces is worth recording. That gate
    /// watched a clock only the main actor advances and compared the pass's longest gap against an
    /// idle control's. It was load-sensitive at first and then, once the load was absorbed, BLIND:
    /// run inside the whole suite — the way CI runs it — a 120ms block injected into the pass
    /// passed, because on a loaded box the idle control reads whole seconds too and the ceiling it
    /// sets swallows the block. Every version of that comparison trades one for the other, because
    /// both halves are measuring the machine.
    ///
    /// A chunk that ran on the main thread is one whatever it cost, idle or loaded, and it is the
    /// thing the claim is actually about.
    ///
    /// A pass runs first and is not counted. The line box a face stands at is measured through a
    /// hosting ruler, which IS the main actor's, and a face is a fact about the process rather than
    /// about the document — so the first pass of a launch warms whatever faces it meets and every
    /// pass after it is the steady state this claim is about (`ProseWarmth`).
    @Test
    func `not one chunk of the pass runs on the main thread`() async {
        let stamp = Self.stamp(of: Self.rows)
        _ = await FeedMeasurePass.settle(stamp)

        // Called FROM the main actor, which is where the coordinator calls it from: a pass awaited
        // off it could be off the main thread for reasons that have nothing to do with the pass.
        let (ran, document) = await FeedMeasurePass.ran {
            await FeedMeasurePass.settle(stamp)
        }

        #expect(document?.count == Self.rows.count)
        // The counter really ran: a pass nobody counted reports zero of everything and passes.
        // Not `> 1`: how many chunks a document splits into is `activeProcessorCount`'s, and a
        // single-core runner would redden a gate about where the chunks RAN.
        #expect(ran.chunks > 0, "the counter must have seen the pass at all")
        #expect(ran.onMainThread == 0, "\(ran.onMainThread) of \(ran.chunks) chunks")
    }
}

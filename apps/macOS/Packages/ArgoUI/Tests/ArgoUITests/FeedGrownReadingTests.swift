import AppKit
@testable import ArgoUI
import Testing

/// A re-wrap over a reading that GREW while the reader was away (#1132).
///
/// The document that stands is kept through a width change, clipped and unreflowed, so the deck
/// does not blank on a drag frame (ADR-0030, Rule 6). The test for "still the same reading" was
/// exact equality over every row — and a live Session is never exactly what it was: it gains rows,
/// and it rewrites its last one as a call is answered. So for the sessions that matter the
/// document was surrendered every time.
///
/// What surrendering costs is not the measure. `surrenderDocument()` empties `shown`, and `shown`
/// is what `anchor()` reads — so the anchor comes back nil, the anchor-preserving landing is
/// structurally dead, and `show()` takes the branch it takes for a reading nobody has opened yet:
/// the tail. **The reader is thrown to the end of the session.** A surrender is indistinguishable
/// from a first open, and that is what the reader meets as "I clicked my session and it jumped to
/// the bottom".
@Suite("Feed over a grown reading")
@MainActor
struct FeedGrownReadingTests {
    private static let pane = CGSize(width: 620, height: 500)

    /// Narrower, and under `ArgoFeedRow.column`, so the width really does re-wrap the rows
    /// (`FeedRewrapMeasureTests`).
    private static let narrowed = CGSize(width: 430, height: 500)

    private static func reading(_ count: Int) -> [FeedRow] {
        (0 ..< count).map {
            FeedRow(id: $0, content: .message(
                "A line of prose long enough to wrap the reading measure, number \($0).",
            ))
        }
    }

    /// The claim: a reading that grew at its tail keeps the document it had, so the reader keeps
    /// their place.
    @Test
    func `a reading that grew keeps its document through a re-wrap`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture
            .laidOut(Self.reading(300), in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)
        let scroller = try #require(coordinator.scroller)

        // The reader is in the middle of the reading, not at either end.
        let parked = try #require(coordinator.geometry.settled).totalHeight / 2
        coordinator.settle(at: parked, over: nil)

        // The Session says one more thing, and the pane narrows — a re-wrap over a grown reading,
        // which is the whole of this case.
        coordinator.apply(FeedTableFixture.model(showing: Self.reading(301)))
        scroller.frame = NSRect(origin: .zero, size: Self.narrowed)
        coordinator.settleAfterResize()

        #expect(coordinator.geometry.isSettled, "the standing document must not be surrendered")
        #expect(coordinator.shown.isEmpty == false, "the rows the anchor is read from must stand")
    }

    /// And what that buys, said the way the reader meets it: they are not thrown to the end.
    @Test
    func `a reading that grew does not throw the reader to the end`() async throws {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture
            .laidOut(Self.reading(300), in: Self.pane, through: handle)
        await FeedTableFixture.settled(coordinator)
        let scroller = try #require(coordinator.scroller)

        let parked = try #require(coordinator.geometry.settled).totalHeight / 2
        coordinator.settle(at: parked, over: nil)

        coordinator.apply(FeedTableFixture.model(showing: Self.reading(301)))
        scroller.frame = NSRect(origin: .zero, size: Self.narrowed)
        coordinator.settleAfterResize()
        await FeedTableFixture.settled(coordinator)

        let landed = try #require(coordinator.offset())
        let end = try #require(coordinator.geometry.settled).totalHeight
            + scroller.contentInsets.bottom - scroller.contentView.bounds.height
        #expect(landed < end - 1, "the reader was thrown to the end of the reading")
    }
}

import AppKit
@testable import ArgoUI
import Testing

/// What a clip-view frame notification costs the feed.
///
/// `NSView` posts one for every `setFrame`, whether the size moved or not, so most of them carry no
/// resize at all — and a handler that computed on every one of them was the dominant interactive
/// cost in the cockpit (#955, ADR-0028 Rule 2). The counters these read are the DEBUG instrument
/// Rule 7 asks for: they say what the path COST, which no assertion on where the reading landed
/// can.
@Suite("Feed pane change")
@MainActor
struct FeedPaneChangeTests {
    private static let column = CGSize(width: 620, height: 480)

    private struct Feed {
        let table: FeedTableCoordinator
        let handle: FeedTableHandle
        let scroller: NSScrollView
    }

    private static func laidOut() throws -> Feed {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(FeedProjection.longRows, in: column, through: handle)
        return try Feed(table: table, handle: handle, scroller: #require(table.scroller))
    }

    /// The notification as AppKit posts it — the seam the handler is registered at.
    private static func postPaneChange(on scroller: NSScrollView) {
        NotificationCenter.default.post(
            name: NSView.frameDidChangeNotification, object: scroller.contentView,
        )
    }

    @Test
    func `a frame notification carrying no resize derives no geometry`() throws {
        let feed = try Self.laidOut()
        let derived = feed.table.paneDerivations

        for _ in 0 ..< 5 {
            Self.postPaneChange(on: feed.scroller)
        }

        #expect(feed.table.paneNotices >= 5)
        #expect(feed.table.paneDerivations == derived)
    }

    /// ADR-0028's acceptance line, as an assertion: a scroll over a document that did not change
    /// shape derives nothing at all.
    @Test
    func `scrolling a settled reading derives no pane geometry`() throws {
        let feed = try Self.laidOut()
        let derived = feed.table.paneDerivations

        for at in stride(from: CGFloat(0), to: 2000, by: 200) {
            feed.handle.settle(at: at, over: nil)
        }

        #expect(feed.table.paneDerivations == derived)
    }

    @Test
    func `a pane that genuinely resizes derives once`() throws {
        let feed = try Self.laidOut()
        let derived = feed.table.paneDerivations

        feed.scroller.frame = NSRect(x: 0, y: 0, width: 500, height: Self.column.height)
        feed.scroller.layoutSubtreeIfNeeded()

        #expect(feed.table.paneDerivations == derived + 1)
    }

    /// The loop #955 names, which only a real window shows: landing the reading forces a layout,
    /// that layout resizes the clip view, and the notification it posts arrives on the handler's
    /// own stack. The size it carries has to be answered — and answered a bounded number of times.
    @Test
    func `a mount whose own layout re-fires the notification settles in bounded passes`() throws {
        let feed = try Self.laidOut()
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Self.column),
            styleMask: [.titled, .resizable], backing: .buffered, defer: false,
        )
        let derived = feed.table.paneDerivations

        window.contentView = feed.scroller
        window.layoutIfNeeded()

        #expect(feed.table.paneDerivations - derived <= FeedTableCoordinator.panePasses)
    }

    /// A fix that made scrolling cheap by making resize wrong would be no fix at all.
    @Test
    func `a pane resize keeps a detached reading on the row the reader was on`() throws {
        let feed = try Self.laidOut()
        feed.handle.settle(at: 1200, over: nil)
        let held = try #require(feed.table.anchor()).row

        feed.scroller.frame = NSRect(x: 0, y: 0, width: 500, height: Self.column.height)
        feed.scroller.layoutSubtreeIfNeeded()

        #expect(try #require(feed.table.anchor()).row == held)
    }

    @Test
    func `a pane resize under a following reading keeps the newest line on screen`() throws {
        let feed = try Self.laidOut()
        #expect(feed.handle.isFollowing)

        feed.scroller.frame = NSRect(x: 0, y: 0, width: 500, height: Self.column.height)
        feed.scroller.layoutSubtreeIfNeeded()

        let reading = try #require(feed.table.table).frame.height
        let offset = try #require(feed.table.offset())
        #expect(offset + feed.scroller.contentView.bounds.height >= reading)
    }
}

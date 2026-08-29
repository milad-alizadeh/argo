import AppKit
@testable import ArgoUI
import Testing

/// What a clip-view frame notification costs the feed.
///
/// `NSView` posts one for every `setFrame`, whether the size moved or not, and a window's own
/// layout posts several per mount — so most of them carry no resize at all, and a handler that
/// computed on every one of them was the dominant interactive cost in the cockpit (#955,
/// ADR-0028 Rule 2). `FeedPaneCost` is the DEBUG instrument Rule 7 asks for: it says what the path
/// COST, which no assertion on where the reading landed can.
@Suite("Feed pane change")
@MainActor
struct FeedPaneChangeTests {
    private static let column = CGSize(width: 620, height: 480)
    /// How many notifications each claim posts. Stated here so the counts below are read against
    /// what the test did, not against a constant the code also uses.
    private static let posted = 5

    private struct Feed {
        let table: FeedTableCoordinator
        let handle: FeedTableHandle
        let scroller: NSScrollView
    }

    private static func laidOut() throws -> Feed {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(FeedProjection.longRows, in: column, through: handle)
        let scroller = try #require(table.scroller)
        // The fixture frames the scroller before the handle is attached, so the width it was built
        // at was nobody's decision. One notice with the handle in place is the mounted state every
        // claim below starts from.
        FeedTableFixture.postFrameChange(on: scroller.contentView)
        return Feed(table: table, handle: handle, scroller: scroller)
    }

    private static func resize(_ feed: Feed, to width: CGFloat) {
        feed.scroller.frame = NSRect(x: 0, y: 0, width: width, height: column.height)
        feed.scroller.layoutSubtreeIfNeeded()
    }

    @Test
    func `a frame notification carrying no resize derives no geometry`() throws {
        let feed = try Self.laidOut()
        let cost = feed.table.paneCost

        for _ in 0 ..< Self.posted {
            FeedTableFixture.postFrameChange(on: feed.scroller.contentView)
        }

        // Every one of them reached the handler, and not one of them reached the policy.
        #expect(feed.table.paneCost.notices == cost.notices + Self.posted)
        #expect(feed.table.paneCost.derivations == cost.derivations)
    }

    /// ADR-0028's acceptance line for the feed: a scroll over a settled reading re-measures
    /// nothing. Counted in measurements, one of which is a full SwiftUI layout pass.
    ///
    /// Not counted in `FeedPaneCost`, and deliberately: a scroll moves the clip view's BOUNDS, and
    /// `paneChanged` is registered for frame changes only, so no assertion about the pane path
    /// could fail here however broken that path became. What the pane path costs is
    /// `FeedPaneChangeTests`' other claims; what a scroll costs is this one.
    @Test
    func `a reader scrolling a settled reading re-measures nothing`() throws {
        let feed = try Self.laidOut()
        let measured = feed.table.measurements
        let clip = feed.scroller.contentView

        for at in stride(from: CGFloat(0), to: 2000, by: 200) {
            clip.scroll(to: NSPoint(x: 0, y: at))
            feed.scroller.reflectScrolledClipView(clip)
            // The notification a wheel or a flick posts, which is the seam the scroll is heard at.
            NotificationCenter.default.post(
                name: NSScrollView.didLiveScrollNotification, object: feed.scroller,
            )
        }

        #expect(feed.table.measurements == measured)
    }

    @Test
    func `a pane that genuinely resizes derives once`() throws {
        let feed = try Self.laidOut()
        let derived = feed.table.paneCost.derivations

        Self.resize(feed, to: 500)

        #expect(feed.table.paneCost.derivations == derived + 1)
    }

    /// The loop #955 names, which only a real window shows: landing the reading forces a layout,
    /// that layout resizes the clip view, and the notification it posts arrives on the handler's
    /// own stack. The first claim is the precondition — without a re-fire there is nothing to
    /// nest, and the second claim would pass over an empty set.
    @Test
    func `no derivation runs inside the layout that re-fired the notification`() throws {
        // Built rather than taken from `laidOut()`: a mount is precisely the case where no pane has
        // been laid out yet, and it is the first derivation whose forced layout re-fires.
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(
            FeedProjection.longRows, in: Self.column, through: handle,
        )
        let feed = try Feed(table: table, handle: handle, scroller: #require(table.scroller))
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Self.column),
            styleMask: [.titled, .resizable], backing: .buffered, defer: false,
        )

        window.contentView = feed.scroller
        window.layoutIfNeeded()

        #expect(feed.table.paneCost.reentrances > 0)
        #expect(feed.table.paneCost.nestings == 0)
        // And it converged: the reading stands laid out against the size the clip view ended at,
        // which is the fact a swallowed or abandoned size would break.
        #expect(feed.table.laidOutPane == feed.scroller.contentView.bounds.size)
    }

    /// Why a mid-drag width no longer forces a layout, as a claim rather than an assumption
    /// (#955). `noteHeightOfRows` asks the delegate for each noted height synchronously, so the
    /// table's row geometry is already square when the decision's landing reads `rect(ofRow:)` —
    /// and it has to be, because that landing is the row the reader was on.
    ///
    /// Asserted with no `layoutSubtreeIfNeeded` of its own: what is claimed is what the table knows
    /// the moment the notification's own work returns.
    @Test
    func `a width change squares up the rows on screen before anything lays out`() throws {
        let feed = try Self.laidOut()
        feed.handle.settle(at: 1200, over: nil)
        let table = try #require(feed.table.table)

        feed.scroller.frame = NSRect(x: 0, y: 0, width: 500, height: Self.column.height)

        let onScreen = feed.table.visibleRows()
        #expect(!onScreen.isEmpty)
        #expect(onScreen.allSatisfy {
            table.rect(ofRow: $0).height == feed.table.measuredHeight(at: $0, in: table)
        })
    }

    /// The coordinator holds its handle weakly — the deck owns it — so a resize can arrive with no
    /// policy to answer it. Recording that size as laid out would lose it: nothing would derive it
    /// when the deck came back, because the pane would already look answered.
    @Test
    func `a resize no policy answered is not remembered as laid out`() throws {
        let feed = try Self.laidOut()
        let held = feed.table.handle
        feed.table.handle = nil

        Self.resize(feed, to: 500)

        let pane = feed.scroller.contentView.bounds.size
        #expect(feed.table.laidOutPane != pane)
        // And it is still there to be derived once there is something to answer it.
        feed.table.handle = held
        let derived = feed.table.paneCost.derivations
        FeedTableFixture.postFrameChange(on: feed.scroller.contentView)
        #expect(feed.table.paneCost.derivations == derived + 1)
    }

    /// A fix that made scrolling cheap by making resize wrong would be no fix at all.
    @Test
    func `a pane resize keeps a detached reading on the row the reader was on`() throws {
        let feed = try Self.laidOut()
        feed.handle.settle(at: 1200, over: nil)
        let held = try #require(feed.table.anchor())

        Self.resize(feed, to: 500)

        // The row AND how far into it: a landing that read stale row geometry would put the
        // reading somewhere else inside the row it named.
        #expect(try #require(feed.table.anchor()) == held)
    }

    @Test
    func `a pane resize under a following reading keeps the newest line on screen`() throws {
        let feed = try Self.laidOut()
        #expect(feed.handle.isFollowing)

        Self.resize(feed, to: 500)

        let reading = try #require(feed.table.table).frame.height
        let offset = try #require(feed.table.offset())
        #expect(offset + feed.scroller.contentView.bounds.height >= reading)
    }
}

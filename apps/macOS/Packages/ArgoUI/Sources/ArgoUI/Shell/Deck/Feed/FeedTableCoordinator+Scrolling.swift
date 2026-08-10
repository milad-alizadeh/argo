import AppKit
import SwiftUI

// Where the reading sits and who moved it — the half of the coordinator that touches the offset.
//
// Three sources of movement, each with its own honest witness. The reader's hand posts
// live-scroll notifications; their keyboard reports through the table's own key handling; the
// pane changing shape posts a frame change. This object's own scrolls are the only other calls
// in the file.

extension FeedTableCoordinator {
    func watch(_ scroller: NSScrollView) {
        scroller.contentView.postsFrameChangedNotifications = true
        let center = NotificationCenter.default
        center.addObserver(
            self, selector: #selector(readerScrolled),
            name: NSScrollView.didLiveScrollNotification, object: scroller,
        )
        // The end of the gesture too: a flick settles after its last live frame, and a latch
        // read one frame early says the reader stopped short of an end they landed on.
        center.addObserver(
            self, selector: #selector(readerScrolled),
            name: NSScrollView.didEndLiveScrollNotification, object: scroller,
        )
        center.addObserver(
            self, selector: #selector(paneChanged),
            name: NSView.frameDidChangeNotification, object: scroller.contentView,
        )
    }

    /// Back to the end of the reading. `nil` pace lands instantly — the arriving-row case, where
    /// a feed easing once per line would be permanently in motion.
    func scrollToEnd(over pace: TimeInterval?) {
        guard let scroller, let reading = scroller.documentView else { return }
        scroller.layoutSubtreeIfNeeded()
        let clip = scroller.contentView
        let end = reading.frame.height + scroller.contentInsets.bottom - clip.bounds.height
        let y = max(end, -scroller.contentInsets.top)
        guard let pace else { return scroll(to: y) }
        NSAnimationContext.runAnimationGroup { motion in
            motion.duration = pace
            motion.allowsImplicitAnimation = true
            clip.animator().setBoundsOrigin(NSPoint(x: clip.bounds.origin.x, y: y))
            scroller.reflectScrolledClipView(clip)
        }
    }

    /// The opening scroll, once per reading. Deferred a runloop turn so the first layout exists
    /// to be scrolled, and re-aimed across a few more: the rows a scroll realises on its way to
    /// the landing replace their lazy heights on the NEXT turn, so a single pass lands a line or
    /// two short of the end it was aiming at. Each pass is one frame; the run is invisible —
    /// unless the reader scrolls inside it, which retires the remaining passes (`opening`):
    /// an open must never out-scroll a hand.
    func place() {
        guard !shown.isEmpty else {
            placed = false
            return
        }
        guard !placed else { return }
        placed = true
        let generation = opening
        DispatchQueue.main.async { [weak self] in self?.openReading(passes: 3, in: generation) }
    }

    /// The one full re-measure a live resize defers — run the moment the seam or the window
    /// lets go, when the width is finally a fact rather than a frame of a drag.
    func settleAfterResize() {
        rewrap(fully: true)
    }

    /// The reader moved the reading — by wheel, flick or key — so the follow latch is re-read.
    func reportFollowing() {
        opening += 1
        guard let scroller, let reading = scroller.documentView, let model else { return }
        let clip = scroller.contentView.bounds
        let following = FeedTail.isFollowing(
            offset: clip.origin.y,
            pane: clip.height,
            reading: reading.frame.height,
        )
        guard following != model.isFollowing else { return }
        // Local truth first: the report round-trips through SwiftUI state, and every live frame
        // in between would otherwise re-report the same edge.
        self.model?.isFollowing = following
        model.onReaderScroll(following)
    }

    private func openReading(passes: Int, in generation: Int) {
        guard opening == generation, let table, let model else { return }
        if let held = model.held, let index = shown.firstIndex(where: { $0.id == held }) {
            scroll(to: table.rect(ofRow: index).minY)
        } else {
            scrollToEnd(over: nil)
        }
        guard passes > 0 else { return }
        DispatchQueue.main.async { [weak self] in
            self?.openReading(passes: passes - 1, in: generation)
        }
    }

    @objc private func readerScrolled(_: Notification) {
        reportFollowing()
    }

    /// The pane changed shape. A new WIDTH re-wraps every paragraph, so the reading is
    /// re-anchored around it; a new height under a following reading just means the end moved.
    @objc private func paneChanged(_: Notification) {
        guard let scroller else { return }
        let width = scroller.contentView.bounds.width
        let known = paneWidth
        paneWidth = width
        if width != known, width > 0, !shown.isEmpty {
            if known == 0 {
                // The FIRST real width. Everything so far was answered with the estimate —
                // rows created before layout have no width to be measured against — and the
                // table has those answers cached. A reload retires them all at once, lazily
                // re-asked; left alone, every row stands at the estimate forever, short rows
                // over a gap and long ones clipped.
                table?.reloadData()
                if model?.isFollowing == true {
                    scrollToEnd(over: nil)
                }
            } else {
                rewrap(fully: !isMidResize)
            }
        } else if model?.isFollowing == true {
            scrollToEnd(over: nil)
        }
    }

    /// Whether the width is still a frame of a drag rather than a fact — the seam's flag rides
    /// the model; the window's own resize is AppKit's.
    private var isMidResize: Bool {
        model?.isResizing == true || table?.inLiveResize == true
    }

    /// Hold the reading still through a re-wrap: the end if following, the topmost row if not —
    /// a row id survives a remeasure because it is not a measurement.
    ///
    /// Mid-drag the re-measure is VISIBLE ROWS ONLY, off-screen rows riding their stale heights
    /// until `settleAfterResize` — the Telegram-macOS pattern, and Apple's own live-resize
    /// guidance: degrade during the drag, square up at its end. A full pass per frame re-asked
    /// the whole transcript per frame, which was the drag's jitter.
    private func rewrap(fully: Bool) {
        guard let table, let scroller else { return }
        let anchor = model?.isFollowing == true ? nil : anchorRow()
        let rows = fully ? IndexSet(shown.indices) : visibleRows()
        dropMeasuredHeights(fully ? nil : rows)
        NSAnimationContext.runAnimationGroup { pass in
            pass.duration = 0
            table.noteHeightOfRows(withIndexesChanged: rows)
        }
        scroller.layoutSubtreeIfNeeded()
        if let anchor {
            let bound = table.rect(ofRow: anchor.row)
            scroll(to: bound.minY + min(anchor.into, bound.height))
        } else {
            scrollToEnd(over: nil)
        }
    }

    /// The topmost visible row and how far the reading has scrolled into it.
    private func anchorRow() -> (row: Int, into: CGFloat)? {
        guard let table, let scroller else { return nil }
        let top = scroller.contentView.bounds.origin.y
        let row = table.row(at: NSPoint(x: 0, y: max(0, top)))
        guard row >= 0 else { return nil }
        return (row, top - table.rect(ofRow: row).minY)
    }

    private func scroll(to y: CGFloat) {
        guard let scroller else { return }
        let clip = scroller.contentView
        clip.scroll(to: NSPoint(x: clip.bounds.origin.x, y: y))
        scroller.reflectScrolledClipView(clip)
    }
}

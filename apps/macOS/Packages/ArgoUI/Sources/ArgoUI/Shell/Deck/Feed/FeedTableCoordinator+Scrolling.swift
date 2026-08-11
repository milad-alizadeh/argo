import AppKit
import SwiftUI

// Where the reading sits and who moved it — the half of the coordinator that touches the offset.
//
// Three witnesses to movement: the hand posts live-scroll notifications, the keyboard reports
// through the table's own key handling, and the pane changing shape posts a frame change.

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
    /// two short. A reader scrolling inside the run retires the remaining passes (`opening`).
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
        settling?.cancel()
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
                // The FIRST real width. Rows created before layout had no width to measure
                // against, and the table has those estimates cached; left alone every row
                // stands at the estimate forever. The measured cache goes with them — a row
                // measured against an interim launch width is cached too tall, and a reload
                // re-asking that cache re-seats every row on the stale answer.
                dropMeasuredHeights()
                table?.reloadData()
                if model?.isFollowing == true {
                    scrollToEnd(over: nil)
                }
            } else {
                // Degraded FIRST, squared up later — never trusting the flag alone: only the
                // seam's own drag carries `isResizing`, while the panel's reveal ANIMATES the
                // feed's width with no flag at all. Visible rows re-measure now; the full pass
                // waits for the burst to go quiet.
                rewrap(fully: false)
                settleSoon()
            }
        } else if model?.isFollowing == true {
            scrollToEnd(over: nil)
        }
    }

    /// One settle per burst: each width frame pushes the full pass back, and only the quiet
    /// after the last one runs it. `settleAfterResize` retires this timer.
    ///
    /// Quiet alone is not enough — a hand pauses mid-drag longer than any debounce, and a full
    /// re-measure fired into that pause lands UNDER the hand as hundreds of ms of freeze. So a
    /// live drag defers the settle for as long as it is live.
    private func settleSoon() {
        settling?.cancel()
        settling = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            if self?.model?.isResizing == true || self?.table?.inLiveResize == true {
                self?.settleSoon()
            } else {
                self?.settleAfterResize()
            }
        }
    }

    /// Hold the reading still through a re-wrap: the end if following, the topmost row if not —
    /// a row id survives a remeasure because it is not a measurement.
    ///
    /// Mid-drag the re-measure is VISIBLE ROWS ONLY, off-screen rows riding their stale heights
    /// until `settleAfterResize`: a full pass per frame re-asks the whole transcript per frame,
    /// which was the drag's jitter.
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

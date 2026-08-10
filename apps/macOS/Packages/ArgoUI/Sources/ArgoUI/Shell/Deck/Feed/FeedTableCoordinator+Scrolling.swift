import AppKit
import SwiftUI

// Where the reading sits and who moved it — the half of the coordinator that touches the offset.
//
// Three sources of movement, each with its own honest witness. The reader's hand posts
// live-scroll notifications and NOTHING else does, which retires the old feed's whole
// whose-scroll-was-that machinery. The pane changing shape posts a frame change. And this
// object's own scrolls are the only other calls in the file.

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
    /// two short of the end it was aiming at. Each pass is one frame; the run is invisible.
    func place() {
        guard !shown.isEmpty else {
            placed = false
            return
        }
        guard !placed else { return }
        placed = true
        DispatchQueue.main.async { [weak self] in self?.openReading(passes: 3) }
    }

    private func openReading(passes: Int) {
        guard let table, let model else { return }
        if let held = model.held, let index = shown.firstIndex(where: { $0.id == held }) {
            scroll(to: table.rect(ofRow: index).minY)
        } else {
            scrollToEnd(over: nil)
        }
        guard passes > 0 else { return }
        DispatchQueue.main.async { [weak self] in self?.openReading(passes: passes - 1) }
    }

    @objc private func readerScrolled(_: Notification) {
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

    /// The pane changed shape. A new WIDTH re-wraps every paragraph, so the reading is re-anchored
    /// around it; a new height under a following reading just means the end moved.
    @objc private func paneChanged(_: Notification) {
        guard let scroller else { return }
        let width = scroller.contentView.bounds.width
        defer { paneWidth = width }
        if width != paneWidth, paneWidth > 0 {
            rewrap(to: width)
        } else if model?.isFollowing == true {
            scrollToEnd(over: nil)
        }
    }

    /// Hold the reading still through a re-wrap: the end if following, the topmost row if not —
    /// a row id survives a remeasure because it is not a measurement.
    ///
    /// The invalidation is explicit. The column autoresizes with the table, so by the time this
    /// runs its width is already the new one and nothing height-shaped has noticed — rows kept
    /// their old heights while their text wrapped taller, which was the reading clipping its own
    /// last line whenever the panel opened.
    private func rewrap(to _: CGFloat) {
        guard let table, let scroller else { return }
        let anchor = model?.isFollowing == true ? nil : anchorRow()
        dropMeasuredHeights()
        NSAnimationContext.runAnimationGroup { pass in
            pass.duration = 0
            table.noteHeightOfRows(withIndexesChanged: IndexSet(shown.indices))
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

// The keyboard's row — arrows, and what Return does when it lands on one.

extension FeedTableCoordinator {
    func step(focusBy delta: Int) {
        guard let table, !shown.isEmpty else { return }
        let standing = focusedRow ?? table.rows(in: table.visibleRect).location
        let next = min(max(standing + delta, 0), shown.count - 1)
        focusedRow = next
        table.scrollRowToVisible(next)
    }

    func activateFocusedRow() -> Bool {
        guard let model, let index = focusedRow, shown.indices.contains(index) else { return false }
        let row = shown[index]
        return row.activate(selection: model.selection, isExpanded: model.unfolding(row.id))
    }

    /// The deck handing the keyboard back — `FeedRowSelection.close()` names a row, and the row
    /// is here now rather than in the deck's focus space.
    func focus(onto id: FeedRow.ID) {
        guard let table, let index = shown.firstIndex(where: { $0.id == id }) else { return }
        focusedRow = index
        table.scrollRowToVisible(index)
        table.window?.makeFirstResponder(table)
    }
}

import AppKit
import SwiftUI

// Where the reading sits and who moved it — the half of the coordinator that touches the offset.
// It decides none of it: each witness reports an event to `FeedScrollPolicy`, and what comes back
// is executed against the scroll view and the table.
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

    /// One event in, one decision out, executed. False when there was no policy to answer it, so
    /// a caller that records what it laid out cannot record a pass that laid out nothing.
    @discardableResult
    func decide(_ event: FeedScrollEvent) -> Bool {
        guard let decision = handle?.resolve(event) else { return false }
        execute(decision)
        return true
    }

    /// `pace` is the way-back control's animation. Every other landing is instant, because a feed
    /// easing once per arriving line would be permanently in motion.
    func execute(_ decision: FeedScrollDecision, over pace: TimeInterval? = nil) {
        insert(decision.delta)
        remeasure(decision.remeasure)
        land(decision.landing, over: pace)
        if decision.settle == .whenQuiet {
            settleWhenQuiet()
        }
    }

    /// The opening scroll, once per reading: claimed on the turn a settled document lands and
    /// landed on the next.
    ///
    /// ONE turn, where it used to be four. The re-aiming was for estimated heights — the rows a
    /// scroll realised on its way to the landing replaced theirs on the next turn, so a single pass
    /// landed a line or two short — and ADR-0030 leaves nothing to correct. What the turn is still
    /// for is `NSTableView`: `reloadData` marks its rows and defers, so the document has no height
    /// of its own until a layout has happened, and a scroll aimed before that lands at the top of a
    /// reading that opens at its tail.
    ///
    /// It is claimed on THIS turn because a fresh model may arrive before the deferred one runs,
    /// and a second claim would start a second scroll.
    func place() {
        guard let handle, handle.isOpeningOwed, placing == nil else { return }
        // ASKED here and executed a turn later, and the two halves are not interchangeable. Asked
        // now, because the policy is answering about a reading that has just been given its rows
        // and is still following it; asked after the layout below, it would be answering about a
        // reading parked at its head, and a reading that opens at its tail would open at its top.
        //
        // The decision held here is also the claim: `apply` may run again before the deferred turn,
        // and a second claim would start a second scroll.
        placing = handle.resolve(.readingOpened(held: model?.held))
        DispatchQueue.main.async { [weak self] in self?.openReading() }
    }

    /// The opening scroll landed, against a table that has been laid out.
    ///
    /// The turn is `NSTableView`'s: `reloadData` marks its rows and defers, so the document has no
    /// height of its own until a layout has happened — and the scroll is aimed at that height.
    private func openReading() {
        guard let decision = placing else { return }
        placing = nil
        scroller?.layoutSubtreeIfNeeded()
        execute(decision)
    }

    /// The one full re-measure a live resize defers — run the moment the seam or the window lets
    /// go, when the width is finally a fact rather than a frame of a drag.
    func settleAfterResize() {
        quieting?.cancel()
        finishedQuiet()
        decide(.resizeEnded(anchor: anchor()))
        settleIfOwed()
    }

    /// The reader moved the reading — by wheel, flick, key or overview lane.
    func reportFollowing() {
        guard let scroller, let reading = scroller.documentView else { return }
        let clip = scroller.contentView.bounds
        decide(.readerScrolled(
            offset: clip.origin.y, pane: clip.height, reading: reading.frame.height,
        ))
    }

    /// Back to the end of the reading.
    func scrollToEnd(over pace: TimeInterval?) {
        guard let scroller, let reading = scroller.documentView else { return }
        // The two geometries this needs — where the clip view sits, and how tall the reading is —
        // and NOT a full layout of the reading, which realises a screenful of cells at whatever
        // offset the reader is at BEFORE this moves them somewhere else. That screen is built,
        // laid out and thrown away: 19 cells and 22 ms of a 50 ms room switch (#963).
        scroller.tile()
        table?.tile()
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

    /// The topmost visible row and how far the reading has scrolled into it, read BEFORE the
    /// re-measure it is handed back with — a row id survives one because it is not a measurement.
    func anchor() -> FeedAnchor? {
        guard let table, let scroller else { return nil }
        let top = scroller.contentView.bounds.origin.y
        let index = table.row(at: NSPoint(x: 0, y: max(0, top)))
        guard shown.indices.contains(index) else { return nil }
        return FeedAnchor(row: shown[index].id, into: top - table.rect(ofRow: index).minY)
    }

    @objc private func readerScrolled(_: Notification) {
        reportFollowing()
    }

    /// A notification carrying no resize is not a pane change: `NSView` posts one for every
    /// `setFrame`, and a window's own layout posts several per mount (#955).
    ///
    /// The follow-on sizes are answered here rather than inside the derivation they interrupted —
    /// landing the reading forces a layout, that layout resizes the clip view, and the notification
    /// it posts arrives on this stack.
    @objc private func paneChanged(_: Notification) {
        notedPane()
        guard let scroller, !isDerivingPane else { return }
        var passes = Self.panePasses
        var pane = scroller.contentView.bounds.size
        while passes > 0, !hasLaidOut(pane) {
            derivingPane(at: pane) {
                decide(.paneChanged(width: pane.width, height: pane.height, anchor: anchor()))
            }
            passes -= 1
            pane = scroller.contentView.bounds.size
        }
        // The width the rows were measured across may have moved with the pane.
        settleIfOwed()
        // Out of passes with the clip still moving: nothing else will post for the size it is at
        // now, so the quiet wait is what lays the reading out against it.
        guard !hasLaidOut(pane) else { return }
        settleWhenQuiet()
    }

    /// What the quiet wait reports to the policy — the burst is over, at whatever width it ended
    /// on.
    func settleElapsed() {
        let live = model?.isResizing == true || table?.inLiveResize == true
        decide(.settleElapsed(stillLive: live, anchor: anchor()))
    }

    /// The rows the fresh reading added, and the ones it invalidated. Appends are the live case
    /// and stay appends — a reload would tear down every visible cell once per arriving row.
    private func insert(_ delta: FeedTableDelta?) {
        guard let table, case let .append(arrived, rewritten) = delta else { return }
        if !arrived.isEmpty {
            table.insertRows(at: IndexSet(integersIn: arrived), withAnimation: [])
        }
        if !rewritten.isEmpty {
            refresh(rows: rewritten)
        }
    }

    func land(_ landing: FeedLanding, over pace: TimeInterval?) {
        switch landing {
        case .stay:
            return
        case .end:
            scrollToEnd(over: pace)
        case let .row(id, into):
            guard let table, let index = shown.firstIndex(where: { $0.id == id }) else { return }
            let bound = table.rect(ofRow: index)
            scroll(to: bound.minY + min(into, bound.height))
        }
    }

    private func scroll(to y: CGFloat) {
        guard let scroller else { return }
        let clip = scroller.contentView
        clip.scroll(to: NSPoint(x: clip.bounds.origin.x, y: y))
        scroller.reflectScrolledClipView(clip)
    }
}

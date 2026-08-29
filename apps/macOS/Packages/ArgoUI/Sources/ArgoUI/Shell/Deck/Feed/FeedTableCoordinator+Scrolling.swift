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

    /// One event in, one decision out, executed.
    func decide(_ event: FeedScrollEvent) {
        guard let decision = handle?.resolve(event) else { return }
        execute(decision)
    }

    /// `pace` is the way-back control's animation. Every other landing is instant, because a feed
    /// easing once per arriving line would be permanently in motion.
    func execute(_ decision: FeedScrollDecision, over pace: TimeInterval? = nil) {
        insert(decision.delta)
        remeasure(decision.remeasure)
        land(decision.landing, over: pace)
        if decision.settle == .whenQuiet {
            settleSoon()
        }
    }

    /// The opening scroll, once per reading. Claimed now and landed a runloop turn later, then
    /// re-aimed across a few more: the rows a scroll realises on its way to the landing replace
    /// their lazy heights on the NEXT turn, so a single pass lands a line or two short. The first
    /// pass waits too, because there is no layout to scroll until `apply` returns.
    ///
    /// It is claimed on this turn because `apply` runs again before the deferred pass, and a second
    /// claim would start a second run.
    ///
    /// The pass count and the spacing are here and not in the policy because they are facts about
    /// `NSTableView`, not rules about where the reading goes.
    func place() {
        guard let handle, handle.isOpeningOwed else { return }
        _ = handle.resolve(.readingOpened(held: model?.held))
        DispatchQueue.main.async { [weak self] in self?.openReading(passes: 3) }
    }

    /// The one full re-measure a live resize defers — run the moment the seam or the window lets
    /// go, when the width is finally a fact rather than a frame of a drag.
    func settleAfterResize() {
        settling?.cancel()
        decide(.resizeEnded(anchor: anchor()))
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

    /// The topmost visible row and how far the reading has scrolled into it, read BEFORE the
    /// re-measure it is handed back with — a row id survives one because it is not a measurement.
    func anchor() -> FeedAnchor? {
        guard let table, let scroller else { return nil }
        let top = scroller.contentView.bounds.origin.y
        let index = table.row(at: NSPoint(x: 0, y: max(0, top)))
        guard shown.indices.contains(index) else { return nil }
        return FeedAnchor(row: shown[index].id, into: top - table.rect(ofRow: index).minY)
    }

    private func openReading(passes: Int) {
        let decision = handle?.resolve(.readingOpened(held: model?.held)) ?? .stay
        execute(decision)
        guard passes > 0, decision.landing != .stay else { return }
        DispatchQueue.main.async { [weak self] in self?.openReading(passes: passes - 1) }
    }

    @objc private func readerScrolled(_: Notification) {
        reportFollowing()
    }

    /// A notification carrying no resize is not a pane change. `NSView` posts one for every
    /// `setFrame`, and a window's own layout posts several per mount — each of which used to read
    /// the anchor and re-measure every row on screen (#955).
    ///
    /// The follow-on sizes are answered HERE rather than inside the derivation they interrupted:
    /// landing the reading forces a layout, that layout resizes the clip view, and the notification
    /// it posts arrives on this stack. Answering it in place derives the same reading twice.
    @objc private func paneChanged(_: Notification) {
        notedPane()
        // The re-entry check comes FIRST: a nested notice that recorded its size would leave the
        // loop below with nothing to answer, and the size it carried would never be laid out.
        guard let scroller, !isDerivingPane,
              resized(to: scroller.contentView.bounds.size) else { return }
        var passes = Self.panePasses
        repeat {
            derivingPane {
                let pane = scroller.contentView.bounds.size
                decide(.paneChanged(width: pane.width, height: pane.height, anchor: anchor()))
            }
            passes -= 1
        } while passes > 0 && resized(to: scroller.contentView.bounds.size)
    }

    /// One settle per burst: each width frame pushes the full pass back, and only the quiet after
    /// the last one runs it. `settleAfterResize` retires this timer.
    private func settleSoon() {
        settling?.cancel()
        settling = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled, let self else { return }
            let live = model?.isResizing == true || table?.inLiveResize == true
            decide(.settleElapsed(stillLive: live, anchor: anchor()))
        }
    }

    /// The rows the fresh reading added, and the ones it invalidated. Appends are the live case
    /// and stay appends — a reload would tear down every visible cell once per arriving row.
    private func insert(_ delta: FeedTableDelta?) {
        guard let table, case let .append(arrived, rewritten) = delta else { return }
        if !arrived.isEmpty {
            table.insertRows(at: IndexSet(integersIn: arrived), withAnimation: [])
        }
        if !rewritten.isEmpty {
            refresh(rows: rewritten, remeasuring: true)
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

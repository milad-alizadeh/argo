import AppKit

// What the lane does with a hand on it, and how it hears that the reading moved.
//
// Three ways in, one way out: every one of them ends at the feed's scroll view, which stays the
// single authority over the offset (#560).

extension MinimapLaneView {
    /// Watch the feed's scroller for movement and its reading for a change of shape.
    ///
    /// Retried for a few runloop turns while the feed has not built its scroller yet: the two views
    /// are siblings in one stack and nothing orders their creation. Bounded, because a lane beside
    /// no feed at all would otherwise spin the main thread forever — and giving up costs nothing,
    /// since the next update of the deck calls this again.
    func attach(to feed: FeedTableHandle, within turns: Int = 3) {
        self.feed = feed
        // Already watching this one. Deliberately no refresh: this runs on every update of the deck
        // above, a seam drag included, and re-reading the whole reading per frame is the cost the
        // feed's own coordinator learned to avoid. What the rects are drawn against changes only
        // when the reading reshapes or the lane resizes, and both post their own notification.
        guard watched !== feed.scroller else { return }
        guard let scroller = feed.scroller else {
            guard turns > 0 else { return }
            DispatchQueue.main.async { [weak self] in self?.attach(to: feed, within: turns - 1) }
            return
        }
        let centre = NotificationCenter.default
        centre.removeObserver(self)
        // The clip view's bounds are where the reading sits — this fires for a wheel, a flick, a
        // key and a programmatic scroll alike, which the feed's own live-scroll notification does
        // not. The document view's frame is the reading's shape: it changes when a row arrives or
        // a re-wrap re-measures, and at no other time.
        //
        // Not collapsible into the feed's own frame observer, which #955 asked about: that one
        // watches the CLIP view for the pane resizing, and a pane that did not move over a reading
        // that grew is the routine case. Two events, not one view of one event.
        centre.addObserver(
            self, selector: #selector(readingMoved),
            name: NSView.boundsDidChangeNotification, object: scroller.contentView,
        )
        centre.addObserver(
            self, selector: #selector(readingReshaped),
            name: NSView.frameDidChangeNotification, object: scroller.documentView,
        )
        watched = scroller
        refresh()
    }

    /// The pointer's own zone, re-cut whenever the lane is. Key-window only: a lane lighting up in
    /// a background window answers a hand that is not on it.
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas {
            removeTrackingArea(area)
        }
        addTrackingArea(NSTrackingArea(
            rect: bounds,
            // `mouseMoved` as well, because the Turn under the pointer is what an annotation
            // names, and entering the lane says only that there IS one (#382).
            options: [.mouseEnteredAndExited, .mouseMoved, .activeInKeyWindow],
            owner: self,
        ))
    }

    override func mouseEntered(with event: NSEvent) {
        pointedAt = laneY(of: event)
        readModifiers(event.modifierFlags)
        watchModifiers()
        light(true)
    }

    /// A scrub carried off the lane keeps it lit — the hand is still on the reading. The Turn's
    /// rect goes either way: it names a Turn under the pointer, and the pointer has left.
    override func mouseExited(with _: NSEvent) {
        pointedAt = nil
        holdsBothKeys = false
        stopWatchingModifiers()
        light(grab != nil)
        settleAnnotations()
    }

    /// The Turn under the pointer re-read. Only the annotation layer answers, and it does nothing
    /// at all while the pointer stays inside the Turn it is already naming.
    override func mouseMoved(with event: NSEvent) {
        pointedAt = laneY(of: event)
        settleAnnotations()
    }

    /// ⇧⌘ asks for every Turn's prompt at once, and only while the pointer is on the lane.
    ///
    /// A monitor rather than `flagsChanged`, which reaches the first responder alone — and the lane
    /// never is one. Taking key focus off the composer to read a modifier would be a far worse
    /// trade than watching for one while a pointer is actually here to use it.
    func watchModifiers() {
        guard modifierWatch == nil else { return }
        // Weak, because the monitor outlives a view torn down between an enter and an exit — a
        // deck closed under the pointer is exactly that — and a strong one would keep it alive.
        modifierWatch = NSEvent
            .addLocalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
                MainActor.assumeIsolated { self?.readModifiers(event.modifierFlags) }
                return event
            }
    }

    func stopWatchingModifiers() {
        modifierWatch.map(NSEvent.removeMonitor)
        modifierWatch = nil
    }

    /// Read off the keys as they are rather than latched, so letting go of either one puts the lane
    /// back whichever way it was released.
    func readModifiers(_ flags: NSEvent.ModifierFlags) {
        let wanted = flags.isSuperset(of: [.shift, .command])
        guard holdsBothKeys != wanted else { return }
        holdsBothKeys = wanted
        settleAnnotations()
    }

    /// A wheel over the lane scrolls the reading beside it, rather than nothing at all. The event
    /// is handed to the scroll view whole, so momentum and rubber-banding stay the platform's.
    override func scrollWheel(with event: NSEvent) {
        guard let scroller = feed?.scroller else {
            return super.scrollWheel(with: event)
        }
        scroller.scrollWheel(with: event)
    }

    /// A press on the rectangle picks it up where it was grabbed; a press anywhere else opens the
    /// Turn it landed in, in one short animated scroll, and picks the rectangle up where the hand
    /// now sits over it — so a drag that follows carries on rather than jumping.
    ///
    /// A lane with nothing to scroll answers nothing. It draws no rectangle either, and a press
    /// that silently issued a scroll on a surface showing no viewport is a press that lied.
    override func mouseDown(with event: NSEvent) {
        guard geometry.isScrollable else { return }
        let laneY = laneY(of: event)
        let band = viewportBand()
        guard !band.contains(laneY) else {
            grab = laneY - band.lowerBound
            return
        }
        let offset = openedOffset(at: laneY)
        grab = min(max(0, laneY - geometry.viewportY(at: offset)), geometry.viewportHeightInLane)
        settle(at: offset, over: pace)
    }

    /// Where a click takes the reading: the head of the Turn it landed in, at the top of the
    /// viewport. Past the end of the reading there is no Turn to open, so the click centres on the
    /// place it landed instead.
    private func openedOffset(at laneY: CGFloat) -> CGFloat {
        let slide = geometry.laneOffset(at: feed?.offset() ?? 0)
        guard let block = geometry.block(atMiniatureY: laneY + slide) else {
            return geometry.offset(centringLaneY: laneY)
        }
        return geometry.offset(forLaneY: block.y - slide)
    }

    /// The scrub. Instant, and mapped through the same one place-in-the-lane-is-a-place-in-the-
    /// reading function a click goes through — a drag is a click whose grab point is not the
    /// rectangle's centre, and nothing else.
    override func mouseDragged(with event: NSEvent) {
        guard let grab else { return }
        settle(at: geometry.offset(forLaneY: laneY(of: event) - grab), over: nil)
    }

    /// The hand off the lane. The geometry was frozen for the length of the scrub, so whatever
    /// arrived under it reflows the rects now.
    override func mouseUp(with event: NSEvent) {
        grab = nil
        isLit = bounds.contains(convert(event.locationInWindow, from: nil))
        refresh()
    }

    /// The lit range brightened or returned to rest. Only the colour moves, so nothing repaints.
    private func light(_ lit: Bool) {
        guard isLit != lit else { return }
        isLit = lit
        settleViewport()
    }

    /// Where the pointer is, in the lane's own space.
    private func laneY(of event: NSEvent) -> CGFloat {
        bounds.height - convert(event.locationInWindow, from: nil).y
    }

    /// Where the viewport rectangle stands right now, in lane space.
    private func viewportBand() -> ClosedRange<CGFloat> {
        let top = geometry.viewportY(at: feed?.offset() ?? 0)
        return top ... top + geometry.viewportHeightInLane
    }

    /// The reading put where the lane asked, and the rectangle put where the reading now is.
    private func settle(at offset: CGFloat, over pace: TimeInterval?) {
        feed?.settle(at: offset, over: pace)
        settleViewport()
    }

    @objc private func readingMoved(_: Notification) {
        settleViewport()
    }

    /// The reading changed shape — marked, never derived here. A reshape arrives in bursts out of
    /// the feed's measure tail, the one moment the geometry is known to be in flux, so the whole
    /// burst costs one derivation at the next layout pass (#955).
    ///
    /// `reshapedTo` is `refresh`'s to write: a height consumed here would be a reshape a bailed
    /// refresh could strand, with nothing left to re-arm it.
    @objc private func readingReshaped(_: Notification) {
        guard watched?.documentView?.frame.height != reshapedTo else { return }
        needsLayout = true
    }
}

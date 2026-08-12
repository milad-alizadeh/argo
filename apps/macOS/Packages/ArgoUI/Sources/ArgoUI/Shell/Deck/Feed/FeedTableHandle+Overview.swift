import AppKit

// The overview lane's half of the handle: what it reads off the feed beside it, and the one verb
// it has over it.

extension FeedTableHandle {
    /// The scroll view the reading lives in. The lane watches it for movement, and hands it every
    /// wheel event that lands on the lane instead.
    var scroller: NSScrollView? {
        coordinator?.scroller
    }

    /// The shape of the reading. Not where it sits — see `offset()` — because the lane holds the
    /// shape still for the length of a scrub and reads the position every frame of one.
    func reading() -> MinimapReading? {
        coordinator?.reading()
    }

    /// Where the reading currently sits.
    func offset() -> CGFloat? {
        coordinator?.offset()
    }

    /// The reading moved to a place the reader named on the lane.
    func settle(at offset: CGFloat, over pace: TimeInterval?) {
        coordinator?.settle(at: offset, over: pace)
    }
}

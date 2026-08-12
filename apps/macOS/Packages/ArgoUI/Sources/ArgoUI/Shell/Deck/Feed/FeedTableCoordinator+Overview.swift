import AppKit

// What the overview lane reads off the feed, and the one verb it has over it (#402).

extension FeedTableCoordinator {
    /// The shape of the reading — every row's measured height and the gutters around them.
    ///
    /// The heights are the table's OWN, not a second measure: a lane summing anything else would
    /// put a mark where the row it stands for is not.
    func reading() -> MinimapReading? {
        guard let table, let scroller else { return nil }
        return MinimapReading(
            rowHeights: shown.indices.map { measuredHeight(at: $0, in: table) },
            viewportHeight: scroller.contentView.bounds.height,
            topInset: scroller.contentInsets.top,
            bottomInset: scroller.contentInsets.bottom,
        )
    }

    /// Where the reading currently sits.
    func offset() -> CGFloat? {
        scroller?.contentView.bounds.origin.y
    }

    /// The reading put where the reader asked on the lane. `nil` pace lands it instantly, which is
    /// what a scrub takes — a scrub is a hand on the reading, and easing every frame of one would
    /// leave the reading arriving after the hand stopped.
    func settle(at offset: CGFloat, over pace: TimeInterval?) {
        guard let scroller else { return }
        let clip = scroller.contentView
        let landing = NSPoint(x: clip.bounds.origin.x, y: offset)
        if let pace {
            NSAnimationContext.runAnimationGroup { motion in
                motion.duration = pace
                motion.allowsImplicitAnimation = true
                clip.animator().setBoundsOrigin(landing)
                scroller.reflectScrolledClipView(clip)
            }
        } else {
            clip.scroll(to: landing)
            scroller.reflectScrolledClipView(clip)
        }
        // The lane is a hand on the reading like any other, so the follow latch is re-read: a
        // scrub away from the end that left the feed still following would be yanked back by the
        // next arriving row.
        reportFollowing()
    }
}

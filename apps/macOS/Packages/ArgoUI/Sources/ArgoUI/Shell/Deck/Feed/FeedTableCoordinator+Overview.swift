import AppKit

// What the overview lane reads off the feed, and the one verb it has over it (#402).

extension FeedTableCoordinator {
    /// The shape of the reading — every row's measured height and the gutters around them.
    ///
    /// The heights are the table's OWN, not a second measure: a lane summing anything else would
    /// put a mark where the row it stands for is not.
    func reading() -> MinimapReading? {
        guard let table, let scroller else { return nil }
        // This is the whole-document walk `ProseCache` derives its ceiling from: every prose row
        // below asks `ProseReading.structure(of:)`, so a store smaller than the reading would be
        // emptied before the walk reached its end and hit nothing on the next one.
        ProseReading.holding(rows: shown.count)
        return MinimapReading(
            rows: shown.indices.map { MinimapRow(
                shown[$0],
                height: measuredHeight(at: $0, in: table),
                under: $0 > 0 ? shown[$0 - 1] : nil,
                // The reader's own fold, which is the one state that changes a row's SHAPE rather
                // than only its height. Read off the model the cells are drawn from.
                isFolded: !(model?.unfolding(shown[$0].id).wrappedValue ?? false),
            ) },
            // What the rows are actually DRAWN across, which stops at the reading measure however
            // wide the zone gets — a miniature of the zone would keep compressing past the point
            // where the reading itself stopped widening. It is also the measure a row's shapes are
            // read against.
            columnWidth: min(table.bounds.width, ArgoFeedRow.column),
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
        // The lane is a hand on the reading like any other, so the follow latch is re-read: a scrub
        // away from the end that left the feed still following would be yanked back by the next
        // arriving row.
        reportFollowing()
    }
}

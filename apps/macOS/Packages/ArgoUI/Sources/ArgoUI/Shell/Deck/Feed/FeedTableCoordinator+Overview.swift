import AppKit
import ProseText

// What the overview lane reads off the feed, and the one verb it has over it (#402).

extension FeedTableCoordinator {
    /// What a reading would be taken AGAINST, without taking one — see `MinimapReadingStamp`.
    /// The lane asks this every pass and walks only when the answer moved.
    func readingStamp() -> MinimapReadingStamp? {
        guard let table, let scroller else { return nil }
        return MinimapReadingStamp(
            rows: shown,
            unfolded: model?.unfolded.wrappedValue ?? [],
            measurements: measurements,
            // What the rows are actually DRAWN across, which stops at the reading measure however
            // wide the zone gets — a miniature of the zone would keep compressing past the point
            // where the reading itself stopped widening. It is also the measure a row's shapes are
            // read against.
            columnWidth: min(table.bounds.width, ArgoFeedRow.column),
            viewportHeight: scroller.contentView.bounds.height,
            topInset: scroller.contentInsets.top,
            bottomInset: scroller.contentInsets.bottom,
            // The feed's own statement that its heights are not final — see `deferredPasses`.
            isProvisional: deferredPasses > 0,
        )
    }

    /// The reading changed shape, passed on to whoever is mapping it.
    ///
    /// The lane used to hear this as a frame observer of its own on the document view. Same
    /// decision, made in the same place — see `MinimapLaneView` — but reached over the handle, so
    /// the deck registers one frame observer rather than two (#971).
    func notedReshape() {
        handle?.readingReshaped?()
    }

    /// The shape of the reading — every row's measured height and the gutters around them.
    ///
    /// The heights are the table's OWN, not a second measure: a lane summing anything else would
    /// put a mark where the row it stands for is not.
    package func reading() -> MinimapReading? {
        readingStamp().flatMap(reading(at:))
    }

    /// The same reading, against a stamp the caller already holds — so a reader that decided to
    /// walk walks against the very facts it made the decision on.
    package func reading(at stamp: MinimapReadingStamp) -> MinimapReading? {
        guard let table else { return nil }
        // This is the whole-document walk `ProseCache` derives its ceiling from: every prose row
        // below asks `ProseReading.structure(of:)`, so a store smaller than the reading would be
        // emptied before the walk reached its end and hit nothing on the next one.
        ProseReading.holding(rows: stamp.rows.count)
        return MinimapReading(
            rows: stamp.rows.indices.map { MinimapRow(
                stamp.rows[$0],
                height: measuredHeight(at: $0, in: table),
                under: $0 > 0 ? stamp.rows[$0 - 1] : nil,
                // The reader's own fold, which is the one state that changes a row's SHAPE rather
                // than only its height. Off the stamp, which took it from the model the cells are
                // drawn from — a `Binding` per row was a closure pair per row for one `contains`.
                isFolded: !stamp.unfolded.contains(stamp.rows[$0].id),
            ) },
            columnWidth: stamp.columnWidth,
            viewportHeight: stamp.viewportHeight,
            topInset: stamp.topInset,
            bottomInset: stamp.bottomInset,
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

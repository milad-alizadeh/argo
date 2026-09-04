import ArgoDesign
import Foundation

// The coarse half of the lane: one mark a Turn, for the sessions a mark a row will not fit (#1173).
//
// A second SOURCE for the marks and not a second lane. The mapping is still linear in document
// points — a Turn's mark starts at its first row's `y` and stands as tall as its rows together — so
// the lit viewport rectangle, the click-to-scroll and the drag are the same arithmetic they were.
//
// Nothing here measures a glyph. A Turn's mark is its extent, its ink and its share, all of which
// the rows already reported, so the coarse lane costs a walk and no Core Text at all.

extension MinimapGeometry {
    /// The Turns' own marks inside a band of the miniature, at their true chronological positions.
    ///
    /// The low end is widened by one line for the same reason the rows' walk widens it: the floor
    /// under a mark can draw a short Turn a touch past its own extent, so a Turn ending just above
    /// the band can still reach it.
    func turnRects(in band: ClosedRange<CGFloat>) -> [MinimapRect] {
        guard !turns.isEmpty, scale > 0 else { return [] }
        let head = turn(holding: row(startingAtOrBefore: documentY(atMiniatureY: band.lowerBound
                - lineInLane)))
        let foot = turn(holding: row(startingAtOrBefore: documentY(atMiniatureY: band.upperBound)))
        var marks: [MinimapRect] = []
        marks.reserveCapacity(foot - head + 1)
        // One store for the walk rather than one a Turn: a coarsened band can be five hundred Turns
        // and every allocation here is paid on a paint.
        var weights = [CGFloat](repeating: 0, count: FeedInk.allCases.count)
        var lastY = -CGFloat.greatestFiniteMagnitude
        for at in head ... foot {
            let mark = turnRect(turns[at], weighing: &weights)
            // The same rule the rows are held to, at the new granularity (#658): a mark the scale
            // has squeezed under a mark and a gap of the one above it would draw as one smear with
            // it, so it is dropped and the reading reads as texture rather than as solid ink. The
            // grain is what bounds how often this fires — at most a quarter of the Turns, by the
            // same construction `shortTurnHeight` is a lower quartile.
            guard mark.y - lastY >= ArgoMinimapLane.rectMinimumHeight + ArgoMinimapLane.rectGap
            else { continue }
            lastY = mark.y
            marks.append(mark)
        }
        return marks
    }

    /// One Turn's mark: its first row's place, its rows' height together, the ink it is drawn in,
    /// and how far across it runs.
    ///
    /// A gap is taken off the foot rather than left to the drop above: two marks that met would be
    /// one mark however far apart their heads are.
    private func turnRect(_ turn: MinimapTurn, weighing weights: inout [CGFloat]) -> MinimapRect {
        let head = rectY(row: turn.rows.lowerBound)
        let foot = rectY(row: turn.rows.upperBound + 1)
        let drawn = drawn(turn, weighing: &weights)
        return MinimapRect(
            y: head,
            height: max(ArgoMinimapLane.rectMinimumHeight, foot - head - ArgoMinimapLane.rectGap),
            span: MinimapRect.span(0, drawn.share),
            ink: drawn.ink,
            shape: drawn.ink.shape,
        )
    }

    /// What a Turn is drawn as. Two facts about it, and they answer two different questions.
    ///
    /// The INK is the state the Turn carries if it carries one, and otherwise the ink most of its
    /// points are drawn in. The state comes first and that is the whole of the rule: a Turn is
    /// mostly its tool output, so by points alone a run of failures inside a long call would show
    /// as the quiet grey around it — and `FeedInk.failure` says why that is the one thing the lane
    /// may not do, since a reader scans an overview for exactly the two states the feed colours.
    ///
    /// The SHARE is how much of the Turn is its LARGEST part, whichever ink names the mark. Not the
    /// state's own share, which would draw a Turn holding one failed call as a hairline and hide
    /// the thing the state rule exists to show. So a Turn that is all one thing runs the whole way
    /// across and a mixed one runs as far as its largest part, and the lane keeps the ragged edge a
    /// mark a row has.
    private func drawn(
        _ turn: MinimapTurn,
        weighing weights: inout [CGFloat],
    )
        -> (ink: FeedInk, share: CGFloat) {
        for at in weights.indices {
            weights[at] = 0
        }
        var total: CGFloat = 0
        for at in turn.rows {
            let row = reading.rows[at]
            let extent = max(0, row.height - row.topStep)
            weights[row.shape.ink.rawValue] += extent
            total += extent
        }
        guard total > 0 else { return (.message, 1) }
        // Walked in `allCases` order rather than by comparing weights alone, so two inks worth the
        // same number of points resolve the same way every paint — a mark that changed colour
        // between two identical readings would rasterise the lane again for nothing.
        var loudest = FeedInk.message
        var most: CGFloat = 0
        for ink in FeedInk.allCases where weights[ink.rawValue] > most {
            most = weights[ink.rawValue]
            loudest = ink
        }
        let state = Self.states.first { weights[$0.rawValue] > 0 }
        return (state ?? loudest, most / total)
    }

    /// The inks that say a STATE rather than a rung, loudest first — `FeedInk.state(in:)`'s two,
    /// in the order a reader needs them: somebody is being waited on before something already
    /// failed.
    private static let states: [FeedInk] = [.attention, .failure]
}

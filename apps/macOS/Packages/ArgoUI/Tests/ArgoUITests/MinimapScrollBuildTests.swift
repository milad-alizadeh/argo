import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a scrolled frame costs the lane.
///
/// The lane hears every scroll on the clip view's bounds and answers by placing two layers. That
/// answer used to build the band's rects each time — 425 of them over the 301-row reading, 3.0 ms —
/// only to compare them with the identical set already on the layer and draw nothing. It was 3.1 ms
/// of an 8.0 ms scrolled frame, spent to prove nothing had changed (#963).
///
/// The rects are a function of the geometry alone, so the stamp `MinimapLaneView.derivation`
/// answers the same question for free. These claims are counts rather than budgets: a count says
/// the work did not happen, which no number of milliseconds can.
@Suite("Minimap scroll build")
@MainActor
struct MinimapScrollBuildTests {
    private static let rows = FeedProjection.longRows

    /// The band reaches several lane-heights past the viewport, so this whole travel stays inside
    /// the one already painted — which is the case a reader scrolling with a wheel is in.
    private static func scroll(_ mounted: MinimapLaneFixture.Mounted, through travel: CGFloat) {
        for at in stride(from: CGFloat(0), to: travel, by: 40) {
            mounted.feed.settle(at: at, over: nil)
        }
    }

    @Test
    func `a scroll inside the painted band builds no rects`() async {
        let mounted = await MinimapLaneFixture.mounted(over: Self.rows)
        let built = mounted.lane.rectBuilds
        let drawn = mounted.lane.rectRedraws

        Self.scroll(mounted, through: 600)

        // Not one build, and so not one rasterise either.
        #expect(mounted.lane.rectBuilds == built)
        #expect(mounted.lane.rectRedraws == drawn)
        // And the lane really did answer the scroll: the viewport rectangle moved with it.
        #expect(mounted.lane.viewportFrame.origin.y != mounted.lane.bounds.height)
    }

    /// The other half: skipping the build must not skip a repaint the reader needs. A reading that
    /// reshapes derives afresh, and the stamp no longer matches.
    @Test
    func `a reshaped reading builds again`() async {
        let mounted = await MinimapLaneFixture.mounted(over: Self.rows)
        let built = mounted.lane.rectBuilds

        mounted.lane.refresh()

        #expect(mounted.lane.rectBuilds == built + 1)
    }

    /// And a scroll far enough to leave the band paints a new one, which is the case the whole
    /// band mechanism exists for. Without this, a lane that built nothing ever would pass above.
    ///
    /// Over the DEEP session, because a reading the lane fits into itself has no band to leave —
    /// the miniature is the lane, it never slides, and nothing past its foot is ever painted
    /// (#1132). A fold to fall out of is what this case is about, so it takes a session that has
    /// one.
    @Test
    func `a scroll out of the painted band paints a new one`() async {
        let mounted = await MinimapLaneFixture.mounted(over: MinimapLaneFixture.deepRows)
        let drawn = mounted.lane.rectRedraws

        // Far enough to leave a band three lane-heights deep, at the grain's two points a row.
        Self.scroll(mounted, through: 60000)

        #expect(mounted.lane.rectRedraws > drawn)
    }
}

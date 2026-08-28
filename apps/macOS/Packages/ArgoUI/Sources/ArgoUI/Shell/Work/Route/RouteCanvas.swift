import SwiftUI

/// The Route's canvas: the NOW line, and every child of the parent placed against it.
///
/// The geometry is PROGRESS, left to right — closed children behind the line, the takeable set on
/// it, and blocked children in the column their remaining depth names. The line's position IS the
/// progress bar: at the start it stands at the left wall with everything ahead of it.
///
/// It WIDENS rather than compresses. The canvas is sized from the work in it and scrolls, so
/// legibility never degrades as a parent grows — #337 is where the step itself starts deriving from
/// real label widths instead of `ArgoRoute`'s fixed one.
///
/// An opaque Work-room surface, not glass and not a card (`cockpit-work-room.md`).
struct RouteCanvas: View {
    @Environment(\.argo) private var argo

    let route: WorkRoomProjection.Route

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            ZStack(alignment: .topLeading) {
                nowLine
                ForEach(route.stops) { stop in
                    RouteStop(stop: stop)
                        .offset(
                            x: ArgoRoute.x(inZone: stop.zone, column: stop.column),
                            y: ArgoRoute.y(atRow: stop.row),
                        )
                }
            }
            .frame(width: width, height: height, alignment: .topLeading)
        }
        // A `ScrollView` CENTRES content smaller than its viewport, which stood a short route's
        // line and dots in the middle of an empty deck. The anchor is what top-leads it; a
        // `maxHeight: .infinity` frame inside cannot, because a scrollable axis is proposed no
        // height for `.infinity` to reach for.
        .defaultScrollAnchor(.topLeading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Ion Blue as current position, at the indicator width the contract already spends on a
    /// selection edge. It reaches above the first row, where #339 writes its caption.
    private var nowLine: some View {
        Rectangle()
            .fill(argo.color.interaction.accent.color)
            .frame(width: ArgoStroke.indicator, height: height - lineTop)
            .offset(x: ArgoRoute.nowLineX, y: lineTop)
            .accessibilityHidden(true)
    }

    private var lineTop: CGFloat {
        ArgoRoute.originY - ArgoRoute.nowLineLift
    }

    /// As wide as the furthest column plus the label block standing in it. `.ahead` and not the
    /// zone of any particular stop: `reach` is `0` on a parent with nothing ahead, and the takeable
    /// column sits at exactly that x.
    private var width: CGFloat {
        ArgoRoute.x(inZone: .ahead, column: route.reach)
            + ArgoRoute.labelWidth + ArgoRoute.trailingPad
    }

    private var height: CGFloat {
        ArgoRoute.y(atRow: (route.stops.map(\.row).max() ?? 0) + 1) + ArgoRoute.bottomPad
    }
}

#Preview("Route canvas — a parent mid-flight") {
    if let route = WorkFixture.chartRoom.chart?.route {
        RouteCanvas(route: route)
            .frame(width: 1000, height: 420)
            .argoDeckSurface()
            .argoAppearance()
    }
}

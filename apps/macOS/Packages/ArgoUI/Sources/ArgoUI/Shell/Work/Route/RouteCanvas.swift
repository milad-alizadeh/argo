import SwiftUI

/// The Route's canvas: the NOW line, and every child of the parent placed against it.
///
/// Closed children behind the line, the takeable set on it, blocked children in the column their
/// remaining depth names. It widens rather than compresses, and scrolls.
struct RouteCanvas: View {
    @Environment(\.argo) private var argo

    let route: WorkRoomProjection.Route

    var body: some View {
        let geometry = RouteGeometry(route: route)

        ScrollView([.horizontal, .vertical]) {
            ZStack(alignment: .topLeading) {
                nowLine(geometry)
                ForEach(route.stops) { stop in
                    RouteStop(stop: stop)
                        .offset(x: geometry.x(of: stop), y: geometry.y(of: stop))
                }
            }
            .frame(width: geometry.width, height: geometry.height, alignment: .topLeading)
        }
        // A `ScrollView` centres content smaller than its viewport, which stood a short route's
        // line and dots in the middle of an empty deck. A `maxHeight: .infinity` frame inside
        // cannot fix it, because a scrollable axis is proposed no height for `.infinity` to reach.
        .defaultScrollAnchor(.topLeading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Ion Blue as current position, at the indicator width the contract spends on a selection
    /// edge.
    private func nowLine(_ geometry: RouteGeometry) -> some View {
        Rectangle()
            .fill(argo.color.interaction.accent.color)
            .frame(width: ArgoStroke.indicator, height: geometry.height - geometry.lineTop)
            .offset(x: geometry.nowLineX, y: geometry.lineTop)
            .accessibilityHidden(true)
    }
}

#Preview("Route canvas — a parent mid-flight") {
    RouteCanvasPreview(room: WorkFixture.chartRoom)
}

#Preview("Route canvas — day one, everything blocked") {
    RouteCanvasPreview(room: WorkFixture.dayOneChartRoom)
}

#Preview("Route canvas — resolved, the line past all the work") {
    RouteCanvasPreview(room: WorkFixture.resolvedChartRoom)
}

#Preview("Route canvas — a provider with no dependency edges") {
    RouteCanvasPreview(room: WorkFixture.edgelessChartRoom)
}

#Preview("Route canvas — closed work wrapped into a second column") {
    RouteCanvasPreview(room: WorkFixture.longTailChartRoom)
}

/// One canvas at the width the deck leaves it, or the reason there is none — so a fixture that
/// stops producing a Route fails loudly in a preview instead of rendering blank.
private struct RouteCanvasPreview: View {
    let room: WorkRoomProjection.Room

    var body: some View {
        Group {
            if let route = room.chart?.route {
                RouteCanvas(route: route)
            } else {
                Text("No Route — the fixture served no children")
                    .argoText(ArgoTypography.rowMeta)
            }
        }
        .frame(width: 1100, height: 460)
        .argoDeckSurface()
        .argoAppearance()
    }
}

import SwiftUI

/// The Route's canvas on its own, at the width the deck leaves it (#335).
///
/// The harness for the two states the shipping shell cannot be clicked into: a chart on day one
/// with every child blocked, and the same chart finished. Both are a whole backlog rewritten, so
/// neither is reachable from the one fixture the shell is fed.
struct RouteCanvasSpecimen: View {
    let room: WorkRoomProjection.Room

    var body: some View {
        if let route = room.chart?.route {
            RouteCanvas(route: route)
                .argoDeckSurface()
        }
    }
}

/// `Present as: Tree | Map` in both positions — a written union of two, and the one control the
/// Route adds to the room.
struct RoomPresentationSpecimen: View {
    @State private var tree = WorkPresentation.tree
    @State private var map = WorkPresentation.map

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.section) {
            RoomPresentation(presentation: $tree)
            RoomPresentation(presentation: $map)
        }
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
    }
}

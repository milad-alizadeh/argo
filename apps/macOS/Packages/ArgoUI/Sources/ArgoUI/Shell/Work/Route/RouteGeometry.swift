import SwiftUI

/// Where the canvas draws each stop, and how big the canvas is.
///
/// A value built from one `Route`, because every measure here depends on how much work stands
/// behind the line: the line's own position is the progress bar (#334), so the takeable column, the
/// columns ahead of it and the canvas width all move with the closed count.
struct RouteGeometry {
    let route: WorkRoomProjection.Route
    /// The columns the closed work occupies, and `0` with nothing closed — which is what stands the
    /// NOW line at the left wall on a parent nobody has finished anything on.
    let behindColumns: Int

    init(route: WorkRoomProjection.Route) {
        self.route = route
        let closed = route.stops(in: .behind).count
        self.behindColumns = (closed + ArgoRoute.behindRowCap - 1) / ArgoRoute.behindRowCap
    }

    func x(of stop: WorkRoomProjection.Route.Stop) -> CGFloat {
        switch stop.zone {
        case .behind: ArgoRoute.originX + step(stop.row / ArgoRoute.behindRowCap)
        case .now, .ahead: ArgoRoute.originX + step(behindColumns + stop.column)
        }
    }

    func y(of stop: WorkRoomProjection.Route.Stop) -> CGFloat {
        let row = stop.zone == .behind ? stop.row % ArgoRoute.behindRowCap : stop.row
        return ArgoRoute.originY + CGFloat(row) * ArgoRoute.rowPitch
    }

    /// Back off the takeable column's dots by half the clearance, so the line stands in the gutter
    /// between the last closed block and the takeable ones and cannot cross a label.
    var nowLineX: CGFloat {
        ArgoRoute.originX + step(behindColumns) - ArgoRoute.nowLineLead
    }

    var lineTop: CGFloat {
        ArgoRoute.originY - ArgoRoute.nowLineLift
    }

    var width: CGFloat {
        ArgoRoute.originX + step(behindColumns + route.reach)
            + ArgoRoute.labelWidth + ArgoRoute.trailingPad
    }

    var height: CGFloat {
        let rows = route.stops.map { stop in
            stop.zone == .behind ? stop.row % ArgoRoute.behindRowCap : stop.row
        }
        return ArgoRoute.originY
            + CGFloat((rows.max() ?? 0) + 1) * ArgoRoute.rowPitch
            + ArgoRoute.bottomPad
    }

    private func step(_ columns: Int) -> CGFloat {
        CGFloat(columns) * ArgoRoute.columnStep
    }
}

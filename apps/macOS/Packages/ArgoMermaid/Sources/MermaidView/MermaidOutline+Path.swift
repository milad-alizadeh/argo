import MermaidLayout
import SwiftUI

// Each node shape as the path that draws it. One figure per shape and no two alike, which is what
// lets a reader tell a decision from a step before reading either of them.
//
// Two shapes are drawn with a mark INSIDE their own silhouette — a subroutine's end bars, a
// cylinder's lid — so an outline says what is stroked and what is filled separately. Filling a path
// carrying a second subpath fills whatever that subpath encloses too, which is how a lid becomes a
// blot.

extension MermaidOutline {
    /// The outline as it is stroked, in the box the layout measured it into.
    func path(in rect: CGRect) -> Path {
        switch self {
        case .subroutine: Self.subroutine(in: rect)
        case .cylinder: Self.cylinder(in: rect, lidded: true)
        case .rect, .rounded, .enclosure, .capsule, .ellipse, .diamond, .hexagon, .flag,
             .bang, .cloud, .dot, .bar:
            ground(in: rect)
        }
    }

    /// The silhouette as it is filled — one closed shape, always.
    func ground(in rect: CGRect) -> Path {
        switch self {
        case .rect, .subroutine, .bar: Path(rect)
        case .rounded: Path(roundedRect: rect, cornerRadius: MermaidMeasure.nodeRadius)
        case .enclosure: Path(roundedRect: rect, cornerRadius: MermaidMeasure.groupRadius)
        case .capsule: Path(roundedRect: rect, cornerRadius: rect.height / 2)
        case .ellipse, .dot: Path(ellipseIn: rect)
        case .diamond: Self.diamond(in: rect)
        case .hexagon: Self.hexagon(in: rect)
        case .flag: Self.flag(in: rect)
        case .cylinder: Self.cylinder(in: rect, lidded: false)
        case .bang: Self.bang(in: rect)
        case .cloud: Self.cloud(in: rect)
        }
    }

    private static func diamond(in rect: CGRect) -> Path {
        MermaidPath.through([
            CGPoint(x: rect.midX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.midY),
            CGPoint(x: rect.midX, y: rect.maxY),
            CGPoint(x: rect.minX, y: rect.midY),
        ], closed: true)
    }

    private static func hexagon(in rect: CGRect) -> Path {
        let cut = min(MermaidMeasure.flagPoint, rect.width / 2)
        return MermaidPath.through([
            CGPoint(x: rect.minX + cut, y: rect.minY),
            CGPoint(x: rect.maxX - cut, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.midY),
            CGPoint(x: rect.maxX - cut, y: rect.maxY),
            CGPoint(x: rect.minX + cut, y: rect.maxY),
            CGPoint(x: rect.minX, y: rect.midY),
        ], closed: true)
    }

    /// A tag with its point on the leading edge, which is the way mermaid draws `>this]`.
    private static func flag(in rect: CGRect) -> Path {
        let cut = min(MermaidMeasure.flagPoint, rect.width / 2)
        return MermaidPath.through([
            CGPoint(x: rect.minX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.minY),
            CGPoint(x: rect.maxX, y: rect.maxY),
            CGPoint(x: rect.minX, y: rect.maxY),
            CGPoint(x: rect.minX + cut, y: rect.midY),
        ], closed: true)
    }

    /// A rect with a bar down each end, standing where the label's own inset already leaves room.
    private static func subroutine(in rect: CGRect) -> Path {
        let bar = min(MermaidMeasure.lidDepth, rect.width / 4)
        var path = Path(rect)
        for x in [rect.minX + bar, rect.maxX - bar] {
            path.addPath(MermaidPath.through([
                CGPoint(x: x, y: rect.minY), CGPoint(x: x, y: rect.maxY),
            ]))
        }
        return path
    }

    /// A drum standing on its end: two walls, a curved floor and a curved top. `lidded` adds the
    /// near half of the lid, which is the mark that says this is a drum rather than a soft box.
    private static func cylinder(in rect: CGRect, lidded: Bool) -> Path {
        let lid = min(MermaidMeasure.lidDepth, rect.height / 4)
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + lid))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY + lid),
            control: CGPoint(x: rect.midX, y: rect.minY - lid),
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - lid))
        path.addQuadCurve(
            to: CGPoint(x: rect.minX, y: rect.maxY - lid),
            control: CGPoint(x: rect.midX, y: rect.maxY + lid),
        )
        path.closeSubpath()
        guard lidded else { return path }
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + lid))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY + lid),
            control: CGPoint(x: rect.midX, y: rect.minY + lid * 3),
        )
        return path
    }
}

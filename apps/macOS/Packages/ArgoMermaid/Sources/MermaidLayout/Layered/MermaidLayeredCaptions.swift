import Foundation
import ProseText

// Where the pass's own words go: a node's label in its box, an edge's beside the line it belongs
// to, an enclosure's in the band along the top of its frame.
//
// Shared, because a caption that is placed the same way for two diagram types has to be placed by
// the same code — and because every one of these keeps its PLACE in the list even when it has no
// room to be drawn in. `MermaidLayout` pairs subviews to captions by position alone, so a caption
// dropped mid-list moves every label after it onto the wrong figure.

extension MermaidLayered {
    /// One caption per name, in the order given. A name that was never placed gets a caption with
    /// no room rather than no caption.
    func captions(_ labels: [MermaidLabel], on names: [String]) -> [MermaidCaption] {
        zip(labels, names).map { MermaidCaption(label: $0, rect: boxes[$1] ?? .zero) }
    }

    /// Each enclosure's title, in the band along the top of its own frame.
    func titles(_ labels: [MermaidLabel]) -> [MermaidCaption] {
        zip(labels, enclosures).map {
            MermaidCaption(label: $0, rect: $1?.title ?? .zero, alignment: .leading)
        }
    }

    /// The word on each edge that carries one — beside the middle of its line rather than on top of
    /// it, because the connector runs under a caption otherwise.
    ///
    /// `texts` is one entry per edge, `nil` for an edge with nothing written on it, so the two
    /// lists stay in step with `routes`.
    func words(_ texts: [String?]) -> [MermaidCaption] {
        placed(texts) { route, size in
            Self.aside(
                of: CGPoint(x: -route.run.y, y: route.run.x), from: route.mid, size: size,
            )
        }
    }

    /// The word written at one END of each route that carries one — back off the box's own face,
    /// clear of the terminal mark standing there, and square out from the line like any other word
    /// on it. A cardinality belongs to the box it stands against, so it is placed against it.
    func endWords(
        _ texts: [String?],
        at end: KeyPath<MermaidRoute, MermaidRoute.End>,
    )
        -> [MermaidCaption] {
        placed(texts) { route, size in
            let end = route[keyPath: end]
            let along = MermaidMeasure.endWordReach
                + (abs(end.run.x) * size.width + abs(end.run.y) * size.height) / 2
            // The OPPOSITE side of the line from the word written on it. Both ends and the middle
            // on one side would stack three words down one flank of a short connector.
            return Self.aside(
                of: Self.opposite(end.across, to: route),
                from: end.back(along),
                size: size,
            )
        }
    }

    /// One caption per text that has one, on the rect its own placement answers — and `.zero` for
    /// a route that was never drawn, which is a state no reader produces.
    private func placed(
        _ texts: [String?],
        at point: (MermaidRoute, CGSize) -> CGPoint,
    )
        -> [MermaidCaption] {
        zip(texts, routes).compactMap { text, route in
            guard let text else { return nil }
            let face = MermaidMeasure.edgeFace
            let size = CGSize(
                width: ceil(ProseMetrics.width(of: text, in: face)),
                height: ceil(face.lineBox),
            )
            return MermaidCaption(
                label: MermaidLabels.edge(text),
                rect: route.map { CGRect(origin: point($0, size), size: size) } ?? .zero,
            )
        }
    }

    /// The way square out from an end that faces AWAY from the side the route's own word is on.
    /// An end's own across points whichever way its run does, so the two ends of one route face
    /// opposite flanks unless one of them is turned.
    private static func opposite(_ across: CGPoint, to route: MermaidRoute) -> CGPoint {
        let mid = CGPoint(x: -route.run.y, y: route.run.x)
        guard across.x * mid.x + across.y * mid.y > 0 else { return across }
        return CGPoint(x: -across.x, y: -across.y)
    }

    /// Where a word of that size stands beside a point on a line: square out from it, far enough
    /// that the box clears the stroke whichever way the line was running.
    private static func aside(of across: CGPoint, from point: CGPoint, size: CGSize) -> CGPoint {
        let clear = abs(across.x) * size.width / 2 + abs(across.y) * size.height / 2
            + MermaidMeasure.wordGap
        return CGPoint(
            x: point.x + across.x * clear - size.width / 2,
            y: point.y + across.y * clear - size.height / 2,
        )
    }
}

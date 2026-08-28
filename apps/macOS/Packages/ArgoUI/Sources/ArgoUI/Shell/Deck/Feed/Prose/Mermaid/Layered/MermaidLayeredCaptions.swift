import Foundation

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
        zip(texts, routes).compactMap { text, route in
            guard let text else { return nil }
            let face = MermaidMeasure.edgeFace
            let size = CGSize(
                width: ceil(ProseMetrics.width(of: text, in: face)),
                height: ceil(face.lineBox),
            )
            return MermaidCaption(
                label: MermaidLabel(text: text, face: face, role: .note),
                rect: route.map { CGRect(origin: Self.beside($0, size: size), size: size) } ?? .zero,
            )
        }
    }

    /// Where a word of that size stands beside a route: square out from the line at its middle, far
    /// enough that the box clears the stroke whichever way the line was running.
    private static func beside(_ route: MermaidRoute, size: CGSize) -> CGPoint {
        let aside = CGPoint(x: -route.run.y, y: route.run.x)
        let clear = abs(aside.x) * size.width / 2 + abs(aside.y) * size.height / 2
            + MermaidMeasure.wordGap
        return CGPoint(
            x: route.mid.x + aside.x * clear - size.width / 2,
            y: route.mid.y + aside.y * clear - size.height / 2,
        )
    }
}

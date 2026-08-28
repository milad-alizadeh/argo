import Foundation

/// A graph run through the layered pass: every node's box, every edge routed, every enclosure
/// framed, and the room it all stands in.
///
/// THE seam a diagram type joins the layered layout at. Rank the nodes, order each rank to cross as
/// few edges as possible, put the boxes down, then route the edges between the rank boundaries —
/// four passes, stated once, whatever the reader that stated the graph (#861, #863).
///
/// The result is INDEPENDENT of the measure it is asked for. A layered diagram is as wide as its
/// widest rank and no column can change that, so one too wide for the prose it sits in is scrolled
/// rather than reflowed — which also means the renderer and the lane read one geometry whatever
/// width either of them happens to ask at.
@MainActor
struct MermaidLayered {
    let boxes: [String: CGRect]
    /// One per `graph.edges`, in that order. `nil` where an end was never placed; the place is kept
    /// because a caption dropped mid-list slides every later caption along `MermaidPlan.captions`.
    let routes: [MermaidRoute?]
    /// One per `graph.groups`, in that order, on the same terms.
    let enclosures: [MermaidEnclosure?]
    let size: CGSize
}

extension MermaidLayered {
    static func of(_ graph: MermaidGraph) -> Self {
        let ranked = graph.ranking()
        let rows = MermaidOrdering.rows(of: graph, ranked: ranked)
        let placement = MermaidPlacement.of(graph, rows: rows)
        let routing = MermaidRouting(placement: placement, reversed: ranked.reversed)
        return MermaidLayered(
            boxes: placement.boxes,
            routes: graph.edges.enumerated().map { routing.drawn($1, at: $0) },
            enclosures: graph.groups.map { MermaidEnclosure.around($0, in: placement.boxes) },
            size: placement.size,
        )
    }

    /// Every mark the pass itself draws, in the order they have to be painted: a frame UNDER the
    /// boxes it is drawn around, and the connectors over both.
    var frames: [MermaidFigure] {
        enclosures.compactMap { $0?.figure }
    }

    var connectors: [MermaidFigure] {
        routes.compactMap(\.self).flatMap(\.figures)
    }
}

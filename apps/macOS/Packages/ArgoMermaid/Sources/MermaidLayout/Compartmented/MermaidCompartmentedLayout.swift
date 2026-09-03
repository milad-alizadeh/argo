import Foundation
import ProseText

// A compartmented diagram placed. The four passes are `MermaidLayered`'s and are not spelled here
// — this states the graph, draws the compartments the pass measured room for, and finishes each
// line with the terminal the source asked for (#865).

extension MermaidCompartmented {
    var laid: MermaidPlan {
        let laid = MermaidLayered.of(graph)
        return MermaidPlan(
            figures: boxes.flatMap { $0.compartments.marks(in: laid.boxes[$0.name] ?? .zero) }
                + laid.connectors
                + terminals(on: laid.routes),
            captions: boxes.flatMap { $0.compartments.captions(in: laid.boxes[$0.name] ?? .zero) }
                + laid.words(relations.map(\.label))
                + laid.endWords(relations.map(\.tailWord), at: \.tail)
                + laid.endWords(relations.map(\.headWord), at: \.head),
            size: laid.size,
        ).normalised
    }

    /// The diagram as the layered pass sees it: boxes already measured, and each end asking for the
    /// room its own terminal mark needs.
    var graph: MermaidGraph {
        MermaidGraph(
            direction: direction,
            nodes: boxes.map {
                // A compartmented box IS a rect, so an end may stand anywhere along its face —
                // which is what lets two differently-marked ends on one box both be seen (#920).
                MermaidGraph.Node(name: $0.name, size: $0.compartments.size, fillsBox: true)
            },
            edges: relations.map {
                MermaidGraph.Edge(
                    from: $0.from, to: $0.to, line: $0.line,
                    head: .mark($0.head.room), tail: .mark($0.tail.room),
                )
            },
            groups: [],
            lane: lane,
        )
    }

    /// The room the relationships need in the lane between one rank and the next: what each end
    /// reaches, twice over, ON TOP of the gap the pass already keeps.
    ///
    /// On top and not instead. Both ends reach into the one lane, so a gap of exactly twice the
    /// reach leaves the two cardinalities of a relationship touching in the middle of it — they
    /// then read as one stacked pair rather than as a word against each of the two boxes.
    private var lane: CGFloat {
        reach * 2
    }

    /// How far one end of a relationship really reaches off the box it stands at: its own terminal
    /// mark, or the word standing behind that mark where one is written.
    ///
    /// The larger of the two and not whichever applies, because the two are measured off different
    /// things — shrink `endWordReach` or grow `footLength` and the mark would otherwise overrun the
    /// lane into the next rank's boxes with nothing to catch it.
    private var reach: CGFloat {
        max(
            relations.map { max($0.tail.depth, $0.head.depth) }.max() ?? 0,
            wordReach,
        )
    }

    /// How far the longest word written AT an end reaches, measured along the rank axis — its own
    /// height where the ranks grow down the page, its width where they grow across it.
    private var wordReach: CGFloat {
        let words = relations.flatMap { [$0.tailWord, $0.headWord] }.compactMap(\.self)
        guard !words.isEmpty else { return 0 }
        let face = MermaidMeasure.edgeFace
        return MermaidMeasure.endWordReach + ceil(
            MermaidGrain(direction: direction, depth: 0).isVertical
                ? face.lineBox
                : words.map { ProseMetrics.width(of: $0, in: face) }.max() ?? 0,
        )
    }

    /// What stands at each end of each relationship, in the room the graph asked the pass to leave.
    private func terminals(on routes: [MermaidRoute?]) -> [MermaidFigure] {
        zip(relations, routes).flatMap { relation, route -> [MermaidFigure] in
            guard let route else { return [] }
            return relation.tail.marks(at: route.tail) + relation.head.marks(at: route.head)
        }
    }
}

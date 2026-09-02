import Foundation

// A state machine placed. The four passes are `MermaidLayered`'s and are not spelled here — this
// states the graph, names the figures a machine is drawn with, and hands the pass's own placements
// back as one plan (#863).

@MainActor
extension MermaidState {
    var laid: MermaidPlan {
        let laid = MermaidLayered.of(graph)
        let words = captions
        return MermaidPlan(
            // Frames first, so a composite sits UNDER the states it is drawn around.
            figures: laid.frames
                + nodes.flatMap { node in
                    laid.boxes[node.name].map { node.figure.marks(in: $0) } ?? []
                }
                + laid.connectors,
            captions: laid.captions(words.nodes, on: names)
                + laid.words(transitions.map(\.label))
                + laid.titles(words.groups),
            size: laid.size,
        ).normalised
    }

    /// The machine as the layered pass sees it.
    var graph: MermaidGraph {
        MermaidGraph(
            direction: direction,
            nodes: nodes.map {
                MermaidGraph.Node(
                    name: $0.name,
                    size: $0.figure.box(of: $0.label, on: direction),
                    fillsBox: $0.figure.fillsBox,
                )
            },
            edges: transitions.map {
                MermaidGraph.Edge(
                    from: inside($0.from, at: \.last),
                    to: inside($0.to, at: \.first),
                    line: $0.kind == .attachment ? .dotted : .solid,
                    head: $0.kind == .transition ? .arrow : .none,
                )
            },
            groups: composites.map(\.members),
        )
    }

    /// The state a transition naming a COMPOSITE really joins: its first member where the
    /// transition arrives, its last where it leaves. Leaving by the way IN would rank whatever
    /// follows beside the states inside, and the frame would then close over a stranger.
    ///
    /// It attaches to a member's own box and not to the frame, so `[*] --> Working` draws a dot
    /// arrowing at the dot inside rather than at the enclosure. Routing to a frame is a change
    /// behind this same seam, like `MermaidRouting`'s box avoidance (#863).
    ///
    /// A composite is never empty here — `MermaidState.read` refuses one that is — so the fallback
    /// is for a name that is no composite at all.
    private func inside(_ name: String, at end: KeyPath<[String], String?>) -> String {
        composites.first { $0.name == name }?.members[keyPath: end] ?? name
    }
}

extension MermaidState.Figure {
    /// The marks this figure draws in the box it was placed in. An end is TWO — a ring, and a
    /// filled centre — because one path carrying both fills the gap between them.
    func marks(in box: CGRect) -> [MermaidFigure] {
        guard self == .end else {
            return [MermaidFigure(form: .shape(outline, box), role: role)]
        }
        return [
            MermaidFigure(form: .shape(.ellipse, box), role: .node),
            MermaidFigure(
                form: .shape(
                    .dot,
                    box.insetBy(dx: MermaidMeasure.ringGap, dy: MermaidMeasure.ringGap),
                ),
                role: .node,
            ),
        ]
    }

    private var outline: MermaidOutline {
        switch self {
        case .state: .rounded
        case .start, .end: .dot
        case .choice: .diamond
        case .fork: .bar
        case .note: .rect
        }
    }

    /// A state, a note and a fork bar are the box they are drawn in; a dot and a choice diamond
    /// touch it at the middle of a face and nowhere else, so nothing may be fanned along theirs
    /// (#920). The bar above all: a fork exists to be the point many transitions leave from.
    var fillsBox: Bool {
        self == .state || self == .note || self == .fork
    }

    /// A note is said ABOUT the machine rather than in it, so it takes the quiet role every
    /// diagram's asides take.
    private var role: MermaidRole {
        self == .note ? .note : .node
    }
}

extension MermaidState.Figure {
    /// How much room this figure needs. Only a figure that carries words is measured; the marks
    /// are the size the measure sheet says.
    @MainActor func box(of label: String, on direction: MermaidDirection) -> CGSize {
        switch self {
        case .state: MermaidWords.box(of: label)
        case .note: MermaidWords.box(of: label, in: MermaidMeasure.edgeFace)
        case .start, .end: Self.square(MermaidMeasure.dotSide)
        case .choice: Self.square(MermaidMeasure.choiceSide)
        case .fork: Self.bar(on: direction)
        }
    }

    private static func square(_ side: CGFloat) -> CGSize {
        CGSize(width: side, height: side)
    }

    /// A bar stands ACROSS the ranks, so it reads as the line the transitions fan out from.
    private static func bar(on direction: MermaidDirection) -> CGSize {
        let length = MermaidMeasure.barLength
        let depth = MermaidMeasure.barDepth
        guard MermaidGrain(direction: direction, depth: 0).isVertical else {
            return CGSize(width: depth, height: length)
        }
        return CGSize(width: length, height: depth)
    }
}

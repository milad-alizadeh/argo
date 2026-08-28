import Foundation

// A state machine placed. The four passes are `MermaidLayered`'s and are not spelled here — this
// states the graph, names the figures a machine is drawn with, and hands the pass's own placements
// back as one plan (#863).

@MainActor
extension MermaidState {
    var laid: MermaidPlan {
        let laid = MermaidLayered.of(graph)
        return MermaidPlan(
            // Frames first, so a composite sits UNDER the states it is drawn around.
            figures: laid.frames
                + nodes.flatMap { node in
                    laid.boxes[node.name].map { node.figure.marks(in: $0) } ?? []
                }
                + laid.connectors,
            captions: laid.captions(nodeLabels, on: names)
                + laid.words(transitions.map(\.label))
                + laid.titles(compositeLabels),
            size: laid.size,
        ).normalised
    }

    /// The machine as the layered pass sees it.
    ///
    /// A transition naming a COMPOSITE is retargeted to a state inside it — its FIRST member
    /// where the transition arrives, its LAST where the transition leaves. Both ends matter: a
    /// machine leaving a composite by its own way in would rank whatever follows beside the states
    /// inside it, and the frame drawn round them would then close over a stranger.
    ///
    /// The alternative is dropping the transition, and a machine missing an arrow reads wrongly
    /// rather than merely oddly.
    var graph: MermaidGraph {
        MermaidGraph(
            direction: direction,
            nodes: nodes.map {
                MermaidGraph.Node(name: $0.name, size: $0.figure.box(of: $0.label, on: direction))
            },
            edges: transitions.map {
                MermaidGraph.Edge(
                    from: inside($0.from, at: \.last),
                    to: inside($0.to, at: \.first),
                    line: $0.kind == .attachment ? .dotted : .solid,
                    hasHead: $0.kind == .transition,
                )
            },
            groups: composites.map(\.members),
        )
    }

    private func inside(_ name: String, at end: KeyPath<[String], String?>) -> String {
        composites.first { $0.name == name }?.members[keyPath: end] ?? name
    }
}

extension MermaidState.Figure {
    /// The marks this figure draws in the box it was placed in.
    ///
    /// An end is TWO: a ring, and a filled centre inside it. Drawn as a pair rather than as an
    /// outline of its own, because a ring with a solid middle is one shape stroked and another
    /// filled, and a single path carrying both fills the gap between them.
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

    /// A note is said ABOUT the machine rather than in it, so it takes the quiet role every
    /// diagram's asides take.
    private var role: MermaidRole {
        self == .note ? .note : .node
    }
}

extension MermaidState.Figure {
    /// How much room this figure needs. Only a state and a note have words to measure; the marks
    /// are the size the measure sheet says, and a bar stands ACROSS the ranks whichever way they
    /// run.
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

    /// A bar stands ACROSS the ranks whichever way they run, so it reads as the line the
    /// transitions through it fan out from.
    private static func bar(on direction: MermaidDirection) -> CGSize {
        let length = MermaidMeasure.barLength
        let depth = MermaidMeasure.barDepth
        guard MermaidAxis(direction: direction, depth: 0).isVertical else {
            return CGSize(width: depth, height: length)
        }
        return CGSize(width: length, height: depth)
    }
}

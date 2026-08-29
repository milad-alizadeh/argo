import Foundation

/// What the layered pass lays out: named boxes of a known size, the edges between them, and the
/// enclosures drawn round them.
///
/// The pass's own vocabulary rather than any one reader's. A flowchart states it and so does a
/// state machine, and neither can see the other's shapes, strokes or keywords from in here — which
/// is what lets ONE ranking, ordering, placement and routing serve both (#861, #863).
///
/// A node arrives already MEASURED. What a figure has to be to hold its words is the reader's own
/// answer — a diamond is wider than its label, a start dot has none at all — and a pass that asked
/// would have to know every shape every reader will ever draw.
struct MermaidGraph: Equatable, Sendable {
    let direction: MermaidDirection
    /// Every node, in the order the source first named one. That order IS the layout's tie-break,
    /// so a diagram read twice lays out twice the same.
    let nodes: [Node]
    let edges: [Edge]
    /// The enclosures, in the order they were opened, each carrying the names it holds — a nested
    /// block's members included, so the outer frame really does contain the inner one.
    let groups: [[String]]
    /// Extra room every rank gap keeps, over and above the pass's own.
    ///
    /// The gap between ranks is the lane every connector is drawn in, and what has to FIT there is
    /// the reader's answer, exactly as a node's size is: a bare arrow needs nothing, and a class
    /// relationship carrying a diamond and a cardinality at each end needs both of them twice over.
    /// Stated once for the graph and not per edge, because one lane holds them all (#865).
    var lane: CGFloat = 0

    struct Node: Equatable, Sendable {
        let name: String
        let size: CGSize
        /// Whether the figure drawn in this box really reaches the whole of it.
        ///
        /// The pass places every end on a box's own FACE and never sees the figure inside it, so
        /// this is the reader's answer to the one question that costs: a diamond and a circle
        /// touch their box at the middle of each face and nowhere else, and an end fanned off that
        /// middle would stand in the air beside the shape. A box that is not filled keeps the
        /// midpoint for every end, which is what every box did before there was a fan (#920).
        ///
        /// `false` by default on the model's own terms — a reader that has not answered gets the
        /// quieter drawing rather than a stem hanging off nothing.
        var fillsBox = false
    }

    /// One connector. How it is stroked and what finishes each of its ends, because the pass draws
    /// the line — but never what it SAYS, because a word is a caption and captions are the
    /// reader's.
    struct Edge: Equatable, Sendable {
        let from: String
        let to: String
        var line: MermaidFigure.Line = .solid
        var head: Cap = .arrow
        var tail: Cap = .none
    }

    /// What stands at one end of a connector.
    ///
    /// `room` is the same claim `Node.size` makes, at the other end of the line: a class diagram's
    /// six terminal markers and an entity's crow's foot are the READER's figures, so the pass
    /// leaves
    /// the gap they asked for and says where the line arrived and which way it was running (#865).
    enum Cap: Equatable, Sendable {
        /// Nothing: the stroke runs right up to the box's own face.
        case none
        /// The pass's own arrowhead, at the measure sheet's size.
        ///
        /// Drawn at the HEAD only. `MermaidRouting` trims both ends but heads only the one, so a
        /// tail asking for an arrow gets a stroke stopping short of its box with nothing standing
        /// in the gap. Nothing wants a tail arrow yet; a bidirectional message would, and that is
        /// a change to `MermaidRouting.head`, not a spelling here.
        case arrow
        /// Room for a mark the reader draws, that far back off the face.
        case mark(CGFloat)

        /// How much of the stroke this cap takes off the end it stands at.
        var room: CGFloat {
            switch self {
            case .none: 0
            case .arrow: MermaidMeasure.arrowLength
            case let .mark(room): room
            }
        }
    }

    var names: [String] {
        nodes.map(\.name)
    }
}

import SwiftUI

/// What a drawn diagram is measured at — `ArgoFeedRow`'s sibling for `MermaidPlan`, so no layout
/// and no view spells a number. Every GAP names a step of `ArgoSpacing`; a bare number is a content
/// MEASURE and carries its reason here.
enum MermaidMeasure {
    /// The breathing room inside a node's box, around its label.
    static let nodeInsetX: CGFloat = ArgoSpacing.comfortable
    static let nodeInsetY: CGFloat = ArgoSpacing.snug
    /// Between one rank of nodes and the next — the lane a connector and its head are drawn in.
    static let rankGap: CGFloat = ArgoSpacing.section
    /// Between two nodes of the same rank.
    static let nodeGap: CGFloat = ArgoSpacing.loose
    /// Between a `subgraph`'s enclosure and the nodes inside it, and the room that enclosure asks
    /// of the gaps around it so it does not close over the node next door.
    static let groupInset: CGFloat = ArgoSpacing.comfortable
    /// How far out of the ranks a back edge runs to get around them.
    static let backLane: CGFloat = ArgoSpacing.comfortable
    /// The corner a node's box is drawn with, and the line its edge and its connectors are drawn
    /// at.
    static let nodeRadius: CGFloat = ArgoRadius.control
    static let groupRadius: CGFloat = ArgoRadius.popover
    static let stroke: CGFloat = ArgoStroke.border
    /// A thick link, which has to read as heavier than a plain one across a whole diagram.
    static let thickStroke: CGFloat = ArgoStroke.indicator
    /// The dash a dotted link is drawn with: on for `dash`, off for the same again, so it reads as
    /// dotted at the one width every other line here is drawn at.
    static let dash: CGFloat = ArgoStroke.dash

    /// How far a connector's head runs back from its tip, and how wide it stands there. Measures
    /// and not steps: this is the size of a mark that reads as a smear much under six points, and
    /// it must stay well inside `rankGap`.
    static let arrowLength: CGFloat = 7
    static let arrowWidth: CGFloat = 6

    /// The narrowest a node's box is drawn, so a one-letter node is still a box rather than a chip.
    static let nodeMinWidth: CGFloat = 44

    /// What a flag's point and a cylinder's lid take off the box they are drawn in. Measures: both
    /// are the size of a mark rather than a step of the rhythm, and both must stay a fraction of
    /// the narrowest box above.
    static let flagPoint: CGFloat = 10
    static let lidDepth: CGFloat = 5

    /// How much bigger a diamond stands than the words in it. A ratio and not a step: a label
    /// inscribed in a rhombus clears the sloping sides only where the box around it is half again
    /// as big, because the shape is at its full width on ONE line and narrows from there.
    static let diamondScale: CGFloat = 1.5

    /// What a bang and a cloud are built from. Ratios and counts rather than steps: both are
    /// silhouettes around a label, and both have to read as themselves at the size the words set
    /// them. Few enough spikes that each is a spike, deep enough a notch that it is not a circle.
    static let bangSpikes = 11
    static let bangNotch: CGFloat = 0.82
    static let cloudBumps = 9
    static let cloudBody: CGFloat = 0.84

    /// How much wider a bang or a cloud stands than the words in it — the same argument as
    /// `diamondScale`, at the gentler ratio a round silhouette needs.
    ///
    /// √2 is the figure for a bare rect inscribed in an ellipse, and it is NOT the figure here: the
    /// box being scaled is the words box, which already carries `nodeInsetX` and `nodeInsetY`
    /// around the glyphs, so the corner that has to stay inside is the GLYPH corner well within it.
    /// Rendered at the worst case — the widest label over two lines, `feedMermaidMindmapShapes` —
    /// both silhouettes clear the text at every corner with room to spare. Raising this to √2 would
    /// only make a bang half again the size of the branch it hangs off.
    static let blobScale: CGFloat = 1.25

    /// How far an edge's word stands off the line it belongs to. Clear of the stroke and still
    /// obviously attached to it.
    static let wordGap: CGFloat = ArgoSpacing.tight

    /// The narrowest a sequence diagram sets one lifeline from the next, before any message's own
    /// word widens the gap.
    static let lifelineGap: CGFloat = ArgoSpacing.section
    /// Between a participant's box and the head of its lifeline, and past the last event before its
    /// foot — so the line reads as running on rather than stopping at what happened last.
    static let lifelineTail: CGFloat = ArgoSpacing.loose
    /// From a message's own word down to the line it names, and under that line before the next
    /// event.
    static let messageDrop: CGFloat = ArgoSpacing.snug
    static let messageGap: CGFloat = ArgoSpacing.comfortable
    /// How far a self-message loops out of its own lifeline, and how deep it drops doing it. Both
    /// measures: the loop has to clear the bar on the lifeline and still stay well inside the gap
    /// to the next one.
    static let loopOut: CGFloat = 28
    static let loopDrop: CGFloat = ArgoSpacing.loose

    /// How wide an activation bar stands on its lifeline. A measure: much narrower and it reads as
    /// a thick line rather than as a bar, and it has to stay far inside `nodeMinWidth`.
    static let activationWidth: CGFloat = 10

    /// How wide a chart's circle is drawn. A measure: at much under this a slice worth a
    /// twentieth of the whole comes out a sliver rather than a wedge.
    static let chartDiameter: CGFloat = 168
    /// The mark in a legend row standing for the wedge it names. A measure: big enough to read a
    /// hue off, and it has to stay well under the line it is set beside.
    static let swatchSize: CGFloat = 10

    /// The face a chart's own title is set in — the loudest word a diagram writes, and still at
    /// the rhythm of the prose around it.
    static let titleFace = ProseFace(rung: .body, isBold: true)
    /// How big a state machine's start and end marks stand, and the room a ringed end keeps
    /// between its ring and its own centre. Measures: a dot is the size of a MARK, and it has to
    /// read as a full stop beside a state rather than as a state of its own.
    static let dotSide: CGFloat = 14
    static let ringGap: CGFloat = 3
    /// A choice's diamond. Sized rather than measured, because it carries no words to measure.
    static let choiceSide: CGFloat = 26
    /// How far a fork or a join bar stands across its rank, and how thick it is along it. A bar
    /// has to read as a bar at a glance, which needs both a length and a real weight.
    static let barLength: CGFloat = 64
    static let barDepth: CGFloat = 6
    /// The narrowest a quadrant chart's field is drawn, before a corner's own words widen it, and
    /// how big a point plotted on it is marked. Both measures: a field much under this cannot hold
    /// four corner labels and the points between them, and a mark much under that reads as dirt.
    static let fieldSide: CGFloat = 260
    static let pointRadius: CGFloat = 4

    /// The face an edge's own word is set in, and the face a `subgraph`'s title takes. Quieter than
    /// the prose the nodes are set in, because both are said ABOUT the diagram rather than in it.
    static let edgeFace = ProseFace(rung: .footnote)
    static let groupFace = ProseFace(rung: .footnote, isBold: true)
}

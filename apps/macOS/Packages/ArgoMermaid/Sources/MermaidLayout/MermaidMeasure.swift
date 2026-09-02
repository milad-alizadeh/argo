import ArgoDesign
import Foundation
import ProseText

/// What a drawn diagram is measured at — the feed row's sibling for `MermaidPlan`, so no layout
/// and no view spells a number. Every GAP names a step of `ArgoSpacing`; a bare number is a content
/// MEASURE and carries its reason here.
public enum MermaidMeasure {
    /// The breathing room inside a node's box, around its label.
    package static let nodeInsetX: CGFloat = ArgoSpacing.comfortable
    package static let nodeInsetY: CGFloat = ArgoSpacing.snug
    /// Between one rank of nodes and the next — the lane a connector and its head are drawn in.
    package static let rankGap: CGFloat = ArgoSpacing.section
    /// Between two nodes of the same rank.
    package static let nodeGap: CGFloat = ArgoSpacing.loose
    /// Between a `subgraph`'s enclosure and the nodes inside it, and the room that enclosure asks
    /// of the gaps around it so it does not close over the node next door.
    package static let groupInset: CGFloat = ArgoSpacing.comfortable
    /// How far out of the ranks a back edge runs to get around them.
    package static let backLane: CGFloat = ArgoSpacing.comfortable
    /// The corner a node's box is drawn with, and the line its edge and its connectors are drawn
    /// at.
    package static let nodeRadius: CGFloat = ArgoRadius.control
    package static let groupRadius: CGFloat = ArgoRadius.popover
    public static let stroke: CGFloat = ArgoStroke.border
    /// A thick link, which has to read as heavier than a plain one across a whole diagram.
    package static let thickStroke: CGFloat = ArgoStroke.indicator
    /// The dash a dotted link is drawn with: on for `dash`, off for the same again, so it reads as
    /// dotted at the one width every other line here is drawn at.
    package static let dash: CGFloat = ArgoStroke.dash

    /// How far a connector's head runs back from its tip, and how wide it stands there. Measures
    /// and not steps: this is the size of a mark that reads as a smear much under six points, and
    /// it must stay well inside `rankGap`.
    package static let arrowLength: CGFloat = 7
    package static let arrowWidth: CGFloat = 6

    /// The narrowest a node's box is drawn, so a one-letter node is still a box rather than a chip.
    package static let nodeMinWidth: CGFloat = 44

    /// What a flag's point and a cylinder's lid take off the box they are drawn in. Measures: both
    /// are the size of a mark rather than a step of the rhythm, and both must stay a fraction of
    /// the narrowest box above.
    package static let flagPoint: CGFloat = 10
    package static let lidDepth: CGFloat = 5

    /// How much bigger a diamond stands than the words in it. A ratio and not a step: a label
    /// inscribed in a rhombus clears the sloping sides only where the box around it is half again
    /// as big, because the shape is at its full width on ONE line and narrows from there.
    package static let diamondScale: CGFloat = 1.5

    /// What a bang and a cloud are built from. Ratios and counts rather than steps: both are
    /// silhouettes around a label, and both have to read as themselves at the size the words set
    /// them. Few enough spikes that each is a spike, deep enough a notch that it is not a circle.
    package static let bangSpikes = 11
    package static let bangNotch: CGFloat = 0.82
    package static let cloudBumps = 9
    package static let cloudBody: CGFloat = 0.84

    /// How much wider a bang or a cloud stands than the words in it — the same argument as
    /// `diamondScale`, at the gentler ratio a round silhouette needs.
    ///
    /// √2 is the figure for a bare rect inscribed in an ellipse, and it is NOT the figure here: the
    /// box being scaled is the words box, which already carries `nodeInsetX` and `nodeInsetY`
    /// around the glyphs, so the corner that has to stay inside is the GLYPH corner well within it.
    /// Rendered at the worst case — the widest label over two lines, `feedMermaidMindmapShapes` —
    /// both silhouettes clear the text at every corner with room to spare. Raising this to √2 would
    /// only make a bang half again the size of the branch it hangs off.
    package static let blobScale: CGFloat = 1.25

    /// How far back off a box's own face a class relationship's terminal marker runs, and how wide
    /// it stands across the line there. Measures, on `arrowLength`'s terms: a hollow triangle and a
    /// diamond must both read as their own figure at a glance and both stay well inside `rankGap`.
    package static let markLength: CGFloat = 12
    package static let markWidth: CGFloat = 10
    /// A diamond runs longer and stands narrower than the triangle beside it, which is the whole
    /// difference between a composition and an inheritance at a glance.
    package static let diamondLength: CGFloat = 16
    package static let diamondWidth: CGFloat = 9

    /// A crow's foot: how far the fork reaches back off the entity it stands at, how wide it opens
    /// there, how far behind it the minimum mark sits, and how big that mark is. Measures: the pair
    /// has to be read as two marks rather than one, at the size of a mark.
    package static let footLength: CGFloat = 10
    package static let footWidth: CGFloat = 12
    package static let footStep: CGFloat = 7
    package static let footDot: CGFloat = 6

    /// How far apart two edges leaving one box by the same face stand. A measure: two terminal
    /// marks at those points have to read as two marks, so it is the widest mark this file draws
    /// across a line — a crow's foot's bar — with air either side of it.
    package static let exitFan: CGFloat = footWidth + ArgoSpacing.tight

    /// How far back off the face a word written at an END of a relationship stands: clear of the
    /// longest terminal mark drawn there, which is the diamond.
    package static let endWordReach: CGFloat = diamondLength + ArgoSpacing.tight

    /// How far an edge's word stands off the line it belongs to. Clear of the stroke and still
    /// obviously attached to it.
    package static let wordGap: CGFloat = ArgoSpacing.tight

    /// The narrowest a sequence diagram sets one lifeline from the next, before any message's own
    /// word widens the gap.
    package static let lifelineGap: CGFloat = ArgoSpacing.section
    /// Between a participant's box and the head of its lifeline, and past the last event before its
    /// foot — so the line reads as running on rather than stopping at what happened last.
    package static let lifelineTail: CGFloat = ArgoSpacing.loose
    /// From a message's own word down to the line it names, and under that line before the next
    /// event.
    package static let messageDrop: CGFloat = ArgoSpacing.snug
    package static let messageGap: CGFloat = ArgoSpacing.comfortable
    /// How far a self-message loops out of its own lifeline, and how deep it drops doing it. Both
    /// measures: the loop has to clear the bar on the lifeline and still stay well inside the gap
    /// to the next one.
    package static let loopOut: CGFloat = 28
    package static let loopDrop: CGFloat = ArgoSpacing.loose

    /// How wide an activation bar stands on its lifeline. A measure: much narrower and it reads as
    /// a thick line rather than as a bar, and it has to stay far inside `nodeMinWidth`.
    package static let activationWidth: CGFloat = 10

    /// How wide a chart's circle is drawn. A measure: at much under this a slice worth a
    /// twentieth of the whole comes out a sliver rather than a wedge.
    package static let chartDiameter: CGFloat = 168
    /// The mark in a legend row standing for the wedge it names. A measure: big enough to read a
    /// hue off, and it has to stay well under the line it is set beside.
    package static let swatchSize: CGFloat = 10

    /// Between one row of a banded diagram and the next — under a column's heading, and under the
    /// rating before the rows stacked below it.
    package static let bandStep: CGFloat = ArgoSpacing.base

    /// One step of a journey's rating, and the gap between two of them. A measure: this is the
    /// length of a mark rather than a step of the rhythm, and five of them plus their gaps have to
    /// stay near the narrowest box a task's own words set.
    package static let ratingStep: CGFloat = 14
    package static let ratingGap: CGFloat = ArgoSpacing.tight

    /// The face a chart's own title is set in — the loudest word a diagram writes, and still at
    /// the rhythm of the prose around it.
    package static let titleFace = ProseFace(rung: .body, isBold: true)
    /// How big a state machine's start and end marks stand, and the room a ringed end keeps
    /// between its ring and its own centre. Measures: a dot is the size of a MARK, and it has to
    /// read as a full stop beside a state rather than as a state of its own.
    package static let dotSide: CGFloat = 14
    package static let ringGap: CGFloat = 3
    /// A choice's diamond. Sized rather than measured, because it carries no words to measure.
    package static let choiceSide: CGFloat = 26
    /// How far a fork or a join bar stands across its rank, and how thick it is along it. A bar
    /// has to read as a bar at a glance, which needs both a length and a real weight.
    package static let barLength: CGFloat = 64
    package static let barDepth: CGFloat = 6
    /// The narrowest a quadrant chart's field is drawn, before a corner's own words widen it, and
    /// how big a point plotted on it is marked. Both measures: a field much under this cannot hold
    /// four corner labels and the points between them, and a mark much under that reads as dirt.
    package static let fieldSide: CGFloat = 260
    package static let pointRadius: CGFloat = 4

    /// How wide a Gantt chart's time axis is drawn. The chart's OWN width and never one handed
    /// down — a diagram is as big as the thing it draws and is scrolled rather than reflowed
    /// (#861) — so it is also the width its ticks are chosen to fit. A measure: much narrower and
    /// a fortnight cannot carry its own dates.
    package static let axisWidth: CGFloat = 420
    /// Between one tick's words and the next's: the least that reads as two dates and not one run.
    package static let tickGap: CGFloat = ArgoSpacing.comfortable
    /// The least a bar stands, so a task of no length is still a mark rather than nothing.
    package static let barMinWidth: CGFloat = 3

    /// The face an edge's own word is set in, and the face a `subgraph`'s title takes. Quieter than
    /// the prose the nodes are set in, because both are said ABOUT the diagram rather than in it.
    package static let edgeFace = ProseFace(rung: .footnote)
    package static let groupFace = ProseFace(rung: .footnote, isBold: true)
}

import Foundation
import ProseText

/// Where each participant stands across a sequence diagram: the box at the head of its lifeline,
/// and the line's own x.
///
/// The gaps are NOT uniform, and that is the whole of this file. A message's word is written along
/// the arrow that carries it, so two lifelines a long word joins have to stand at least that far
/// apart or the word is drawn over the lifeline next door. A column's place is settled by what is
/// drawn across it rather than by a step of the rhythm.
@MainActor
struct MermaidColumns {
    /// One per participant, in the order the diagram names them.
    let centres: [CGFloat]
    let boxes: [CGRect]

    /// How tall the band of participant boxes stands — where every lifeline starts.
    var headerHeight: CGFloat {
        boxes.first?.height ?? 0
    }

    /// How far the columns reach altogether. A note or a self-message may still stand outside this;
    /// `MermaidPlan.normalised` is what settles the diagram's real measure.
    var width: CGFloat {
        boxes.map(\.maxX).max() ?? 0
    }

    func centre(_ column: Int) -> CGFloat {
        column < centres.count ? centres[column] : 0
    }
}

extension MermaidColumns {
    static func of(_ diagram: MermaidSequence) -> MermaidColumns {
        let sizes = diagram.participants.map(box(of:))
        let spans = spans(of: diagram)
        let height = sizes.map(\.height).max() ?? 0
        var centres: [CGFloat] = []
        var x: CGFloat = 0
        for (at, size) in sizes.enumerated() {
            // Far enough that the boxes clear each other, and far enough for whatever is drawn
            // across the gap — whichever of the two asks for more.
            if at == 0 {
                x = size.width / 2
            } else {
                let clear: CGFloat = sizes[at - 1].width / 2 + size.width / 2
                    + MermaidMeasure.nodeGap
                x += max(clear, spans[at - 1])
            }
            centres.append(x)
        }
        return MermaidColumns(
            centres: centres,
            boxes: zip(centres, sizes).map {
                CGRect(x: $0 - $1.width / 2, y: 0, width: $1.width, height: height)
            },
        )
    }

    /// One participant's box: its label at the feed's own prose metrics, plus the room around it —
    /// the very measure a flowchart's node takes, so a diagram of either kind sets at one rhythm.
    static func box(of participant: MermaidSequence.Participant) -> CGSize {
        CGSize(
            width: max(
                MermaidMeasure.nodeMinWidth,
                ceil(ProseMetrics.width(of: participant.label)) + MermaidMeasure.nodeInsetX * 2,
            ),
            height: ceil(ProseFace.body.lineBox) + MermaidMeasure.nodeInsetY * 2,
        )
    }

    /// How wide a note's own box stands.
    static func box(of note: MermaidSequence.Note) -> CGFloat {
        ceil(ProseMetrics.width(of: note.text, in: MermaidMeasure.edgeFace))
            + MermaidMeasure.nodeInsetX * 2
    }

    /// The clearance each gap has to keep. One entry per participant, the last of which is the room
    /// past the final lifeline rather than a gap between two.
    private static func spans(of diagram: MermaidSequence) -> [CGFloat] {
        var spans = [CGFloat](
            repeating: MermaidMeasure.lifelineGap,
            count: max(1, diagram.participants.count),
        )
        for demand in demands(of: diagram) where spans.indices.contains(demand.gap) {
            spans[demand.gap] = max(spans[demand.gap], demand.width)
        }
        return spans
    }

    private static func demands(of diagram: MermaidSequence) -> [(gap: Int, width: CGFloat)] {
        diagram.events.flatMap { event -> [(gap: Int, width: CGFloat)] in
            switch event {
            case let .message(message): demands(of: message, in: diagram)
            case let .note(note): demands(of: note, in: diagram)
            case .activate, .deactivate, .opens, .divides, .closes: []
            }
        }
    }

    /// What a message asks of the gap it is drawn across. A message spanning more than one gap asks
    /// nothing: it already has two gaps and everything between them to write its word in.
    private static func demands(
        of message: MermaidSequence.Message,
        in diagram: MermaidSequence,
    )
        -> [(gap: Int, width: CGFloat)] {
        guard let from = diagram.column(of: message.from),
              let to = diagram.column(of: message.to)
        else { return [] }
        let words = ceil(ProseMetrics.width(of: message.text, in: MermaidMeasure.edgeFace))
        guard from != to else {
            return [(from, MermaidMeasure.loopOut + words + MermaidMeasure.wordGap)]
        }
        guard abs(from - to) == 1 else { return [] }
        // Clear of BOTH lifelines and not merely between them: a word is set over the arrow, and
        // the dotted line it ends on would otherwise run through its last letter.
        return [(min(from, to), words + MermaidMeasure.nodeGap * 2)]
    }

    /// What a note asks of the gaps beside it. A note over one participant reaches half its width
    /// into the gap on either side; a note beside one reaches its whole width into the one it
    /// stands in.
    private static func demands(
        of note: MermaidSequence.Note,
        in diagram: MermaidSequence,
    )
        -> [(gap: Int, width: CGFloat)] {
        let columns = note.over.compactMap { diagram.column(of: $0) }
        guard let first = columns.min(), let last = columns.max() else { return [] }
        let width = box(of: note)
        // Room on BOTH sides: the note stands one gap off its own lifeline, and the same again
        // clear of the one on its far side rather than up against it.
        let clear = width + MermaidMeasure.nodeGap * 2
        switch note.placement {
        case .left: return [(first - 1, clear)]
        case .right: return [(first, clear)]
        case .over where first == last:
            let half = width / 2 + MermaidMeasure.nodeGap
            return [(first - 1, half), (first, half)]
        case .over: return last - first == 1 ? [(first, width)] : []
        }
    }
}

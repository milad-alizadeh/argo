import Foundation
import ProseText

/// What a banded diagram measures: one height per row of the whole figure, and one width per
/// column and per band.
///
/// Every column's heading stands at the SAME height and every row beneath it at the same height
/// again, whichever band they are in. That is what makes the headings read across the axis as one
/// line and the rows under them as one stack, and it is what makes a row's box independent of what
/// its neighbour wrote — so two rows of one column cannot overlap by arithmetic.
@MainActor
struct MermaidBandsMetrics {
    let bands: MermaidBands

    /// What the title takes off the top, its own gap included. Zero where there is no title.
    var titleHeight: CGFloat {
        bands.title.isEmpty
            ? 0
            : ceil(MermaidMeasure.titleFace.lineBox) + MermaidMeasure.messageGap
    }

    /// How tall a band's own strip is drawn. Zero where the source named no band at all, so an
    /// unsectioned timeline starts at its periods rather than under a blank strip.
    var stripBox: CGFloat {
        guard bands.sections.contains(where: { !$0.name.isEmpty }) else { return 0 }
        return ceil(MermaidMeasure.groupFace.lineBox) + MermaidMeasure.nodeInsetY * 2
    }

    var headingTop: CGFloat {
        titleHeight + (stripBox > 0 ? stripBox + MermaidMeasure.messageGap : 0)
    }

    var headingHeight: CGFloat {
        columns.map { MermaidWords.box(of: $0.heading).height }.max() ?? 0
    }

    /// What the rating takes, its own gap above included. Zero for a diagram that rates nothing —
    /// a timeline pays nothing for a gauge it never draws.
    var gaugeHeight: CGFloat {
        columns.contains { $0.score != nil }
            ? MermaidBandsGauge.height + MermaidMeasure.bandStep
            : 0
    }

    var noteHeight: CGFloat {
        notes.map { MermaidWords.box(of: $0.text, in: MermaidMeasure.edgeFace).height }.max() ?? 0
    }

    /// The deepest stack any one column carries. Every column reserves it, so the diagram's foot
    /// is one line rather than a ragged edge.
    var noteRows: Int {
        columns.map(\.notes.count).max() ?? 0
    }

    /// Where the nth row under a heading stands, counted from the top of the whole figure.
    func noteTop(_ row: Int) -> CGFloat {
        headingTop + headingHeight + gaugeHeight + MermaidMeasure.bandStep
            + CGFloat(row) * (noteHeight + MermaidMeasure.wordGap)
    }

    var gaugeTop: CGFloat {
        headingTop + headingHeight + MermaidMeasure.bandStep
    }

    func width(of column: MermaidBands.Column) -> CGFloat {
        let words = [MermaidWords.box(of: column.heading).width]
            + column.notes.map { MermaidWords.box(of: $0.text, in: MermaidMeasure.edgeFace).width }
        return max(words.max() ?? 0, column.score == nil ? 0 : MermaidBandsGauge.width)
    }

    /// A band is as wide as the columns it holds, or as wide as its own name needs — whichever
    /// asks for more, so a strip never cuts the words off it.
    func width(of section: MermaidBands.Section) -> CGFloat {
        let columns = section.columns.map(width(of:))
        let stacked = columns.reduce(0, +)
            + MermaidMeasure.nodeGap * CGFloat(max(columns.count - 1, 0))
        let name = ceil(ProseMetrics.width(of: section.name, in: MermaidMeasure.groupFace))
        return max(stacked, section.name.isEmpty ? 0 : name + MermaidMeasure.nodeInsetX * 2)
    }

    /// As wide as the bands stand, or as wide as the title is written — a title is never clipped
    /// to the figure it names.
    var width: CGFloat {
        let bandsWidth = bands.sections.map(width(of:)).reduce(0, +)
            + MermaidMeasure.rankGap * CGFloat(max(bands.sections.count - 1, 0))
        let title = ProseMetrics.width(of: bands.title, in: MermaidMeasure.titleFace)
        return max(bandsWidth, ceil(title))
    }

    var height: CGFloat {
        headingTop + headingHeight + gaugeHeight + notesHeight
    }

    /// What the stack under the headings takes, its own gap above included. `n` boxes and `n - 1`
    /// gaps between them, so the last row adds no trailing space.
    private var notesHeight: CGFloat {
        guard noteRows > 0 else { return 0 }
        return MermaidMeasure.bandStep + CGFloat(noteRows) * noteHeight
            + CGFloat(noteRows - 1) * MermaidMeasure.wordGap
    }

    private var columns: [MermaidBands.Column] {
        bands.sections.flatMap(\.columns)
    }

    private var notes: [MermaidBands.Note] {
        columns.flatMap(\.notes)
    }
}

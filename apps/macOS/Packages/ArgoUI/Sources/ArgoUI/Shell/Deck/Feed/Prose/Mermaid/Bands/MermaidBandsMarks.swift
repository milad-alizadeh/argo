import Foundation

/// A banded diagram's figures and captions, gathered in one walk of its bands.
///
/// One walk rather than a pass per kind of mark, because the captions are paired with
/// `MermaidBands.labels` BY POSITION: a second pass appending them in its own order is one edit
/// away from naming a band with a task's own words.
@MainActor
struct MermaidBandsMarks {
    private let metrics: MermaidBandsMetrics
    private(set) var figures: [MermaidFigure] = []
    private(set) var captions: [MermaidCaption] = []

    init(_ metrics: MermaidBandsMetrics) {
        self.metrics = metrics
        place()
    }

    private mutating func place() {
        if let title = metrics.bands.titleLabel {
            captions.append(MermaidCaption(label: title, rect: CGRect(
                x: 0,
                y: 0,
                width: metrics.width,
                height: ceil(MermaidMeasure.titleFace.lineBox),
            )))
        }
        var x: CGFloat = 0
        for section in metrics.bands.sections {
            place(section, at: x)
            x += metrics.width(of: section) + MermaidMeasure.rankGap
        }
    }

    /// One band: the strip that names it, then the columns standing under it.
    private mutating func place(_ section: MermaidBands.Section, at x: CGFloat) {
        if !section.name.isEmpty {
            let strip = CGRect(
                x: x,
                y: metrics.titleHeight,
                width: metrics.width(of: section),
                height: metrics.stripBox,
            )
            figures.append(MermaidFigure(form: .shape(.rounded, strip), role: section.role))
            captions.append(MermaidCaption(label: MermaidBands.label(of: section), rect: strip))
        }
        var columnX = x
        for column in section.columns {
            place(column, at: columnX)
            columnX += metrics.width(of: column) + MermaidMeasure.nodeGap
        }
    }

    /// One column: its heading, the rating under it where the diagram rates anything, and its own
    /// rows stacked below on the heights every column reserves.
    private mutating func place(_ column: MermaidBands.Column, at x: CGFloat) {
        let heading = CGRect(
            x: x,
            y: metrics.headingTop,
            width: metrics.width(of: column),
            height: metrics.headingHeight,
        )
        figures.append(MermaidFigure(form: .shape(.rounded, heading)))
        captions.append(MermaidCaption(
            label: MermaidBands.label(heading: column.heading),
            rect: heading,
        ))
        if let score = column.score {
            figures += MermaidBandsGauge.steps(score, at: CGPoint(
                x: heading.midX - MermaidBandsGauge.width / 2,
                y: metrics.gaugeTop,
            ))
        }
        place(column.notes, across: heading)
    }

    private mutating func place(_ notes: [MermaidBands.Note], across heading: CGRect) {
        for (row, note) in notes.enumerated() {
            let rect = CGRect(
                x: heading.minX,
                y: metrics.noteTop(row),
                width: heading.width,
                height: metrics.noteHeight,
            )
            figures.append(MermaidFigure(form: .shape(.rounded, rect), role: note.role))
            captions.append(MermaidCaption(label: MermaidBands.label(of: note), rect: rect))
        }
    }
}

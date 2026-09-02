import ArgoDesign
import Foundation

/// The legend beside a pie: one row per slice — a swatch in the slice's own hue, the name it was
/// written under, and the reading of what it is worth.
///
/// One value rather than four measurements threaded through the layout, and the place the rows'
/// arithmetic is done ONCE — the swatch, the name and the reading of a row are placed against one
/// geometry rather than three that have to agree.
@MainActor
struct MermaidPieLegend {
    /// One row's words, held together rather than as two lists indexed alike: a name and the
    /// reading beside it ARE one row, and two lists are one off-by-one away from naming the wrong
    /// wedge.
    private struct Row {
        let name: String
        let reading: String
    }

    private let rows: [Row]
    private let nameWidth: CGFloat
    private let readingWidth: CGFloat

    init(_ pie: MermaidPie) {
        let rows = zip(pie.slices, pie.readings).map { Row(name: $0.label, reading: $1) }
        self.rows = rows
        self.nameWidth = Self.widest(rows.map(\.name))
        self.readingWidth = Self.widest(rows.map(\.reading))
    }

    /// The swatch, the names under one edge and the readings under another — a column each, so a
    /// run of shares reads down rather than ragged.
    var width: CGFloat {
        MermaidMeasure.swatchSize + MermaidMeasure.wordGap + nameWidth
            + MermaidMeasure.nodeGap + readingWidth
    }

    var height: CGFloat {
        Self.rowHeight * CGFloat(rows.count)
    }

    /// How tall one row stands: its own line, plus the room that keeps two names off each other.
    static var rowHeight: CGFloat {
        ceil(MermaidMeasure.edgeFace.lineBox) + ArgoSpacing.tight
    }

    /// One swatch per row, in the slice's own hue — the mark that ties a name to a wedge.
    func swatches(from origin: CGPoint) -> [MermaidFigure] {
        rows.indices.map { at in
            let row = row(at, from: origin)
            return MermaidFigure(
                form: .shape(.rounded, CGRect(
                    x: row.minX,
                    y: row.midY - MermaidMeasure.swatchSize / 2,
                    width: MermaidMeasure.swatchSize,
                    height: MermaidMeasure.swatchSize,
                )),
                role: .series(at),
            )
        }
    }

    func nameCaptions(from origin: CGPoint) -> [MermaidCaption] {
        rows.enumerated().map { at, row in
            MermaidCaption(
                label: MermaidLabel(text: row.name, face: MermaidMeasure.edgeFace),
                rect: column(at, from: origin, width: nameWidth),
                alignment: .leading,
            )
        }
    }

    func readingCaptions(from origin: CGPoint) -> [MermaidCaption] {
        rows.enumerated().map { at, words in
            let row = row(at, from: origin)
            return MermaidCaption(
                label: MermaidLabel(
                    text: words.reading,
                    face: MermaidMeasure.edgeFace,
                    role: .note,
                ),
                rect: CGRect(
                    x: row.maxX - readingWidth,
                    y: row.minY,
                    width: readingWidth,
                    height: row.height,
                ),
                alignment: .trailing,
            )
        }
    }

    /// The names' column on one row, which is where the leading column starts and how far it runs.
    private func column(_ at: Int, from origin: CGPoint, width: CGFloat) -> CGRect {
        let row = row(at, from: origin)
        return CGRect(
            x: row.minX + MermaidMeasure.swatchSize + MermaidMeasure.wordGap,
            y: row.minY,
            width: width,
            height: row.height,
        )
    }

    private func row(_ at: Int, from origin: CGPoint) -> CGRect {
        CGRect(
            x: origin.x,
            y: origin.y + Self.rowHeight * CGFloat(at),
            width: width,
            height: Self.rowHeight,
        )
    }

    private static func widest(_ words: [String]) -> CGFloat {
        words.map { ceil(ProseMetrics.width(of: $0, in: MermaidMeasure.edgeFace)) }.max() ?? 0
    }
}

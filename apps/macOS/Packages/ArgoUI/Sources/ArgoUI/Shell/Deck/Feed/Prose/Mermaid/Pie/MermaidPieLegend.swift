import Foundation

/// The legend beside a pie: one row per slice — a swatch in the slice's own hue, the name it was
/// written under, and the reading of what it is worth.
///
/// One value rather than four measurements threaded through the layout, and the place the rows'
/// arithmetic is done ONCE: the swatches, the names and the readings are three lists that have to
/// land on the same rows or a name is read against the wrong wedge.
@MainActor
struct MermaidPieLegend {
    private let names: [String]
    private let readings: [String]
    private let nameWidth: CGFloat
    private let readingWidth: CGFloat

    init(_ pie: MermaidPie) {
        self.names = pie.slices.map(\.label)
        self.readings = pie.readings
        self.nameWidth = Self.widest(names)
        self.readingWidth = Self.widest(readings)
    }

    /// The swatch, the names under one edge and the readings under another — a column each, so a
    /// run of shares reads down rather than ragged.
    var width: CGFloat {
        MermaidMeasure.swatch + MermaidMeasure.wordGap + nameWidth
            + MermaidMeasure.nodeGap + readingWidth
    }

    var height: CGFloat {
        Self.rowHeight * CGFloat(names.count)
    }

    /// How tall one row stands: its own line, plus the room that keeps two names off each other.
    static var rowHeight: CGFloat {
        ceil(MermaidMeasure.edgeFace.lineBox) + ArgoSpacing.tight
    }

    /// One swatch per row, in the slice's own hue — the mark that ties a name to a wedge.
    func swatches(from origin: CGPoint) -> [MermaidFigure] {
        names.indices.map { at in
            let row = row(at, from: origin)
            return MermaidFigure(
                form: .shape(.rounded, CGRect(
                    x: row.minX,
                    y: row.midY - MermaidMeasure.swatch / 2,
                    width: MermaidMeasure.swatch,
                    height: MermaidMeasure.swatch,
                )),
                role: .series(at),
            )
        }
    }

    func nameCaptions(from origin: CGPoint) -> [MermaidCaption] {
        names.enumerated().map { at, name in
            MermaidCaption(
                label: MermaidLabel(text: name, face: MermaidMeasure.edgeFace),
                rect: column(at, from: origin, width: nameWidth),
                alignment: .leading,
            )
        }
    }

    func readingCaptions(from origin: CGPoint) -> [MermaidCaption] {
        readings.enumerated().map { at, reading in
            let row = row(at, from: origin)
            return MermaidCaption(
                label: MermaidLabel(
                    text: reading,
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
            x: row.minX + MermaidMeasure.swatch + MermaidMeasure.wordGap,
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

import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

@MainActor
@Suite("ZZ probe")
struct ZZProbeTests {
    private static let named: [(String, ProseFace)] = [
        ("body", .body),
        ("machine", .machine),
        ("header", .header),
        ("h1", .heading(level: 1)),
        ("h2", .heading(level: 2)),
        ("h3", .heading(level: 3)),
        ("label", ProseFace(rung: ArgoTypography.sectionLabel.rung)),
    ]

    private static func drawn(_ face: ProseFace, lines: Int) -> CGFloat {
        let words = Array(repeating: "A", count: lines).joined(separator: "\n")
        let leading = face.isMachine
            ? ArgoFeedRow.machineLineSpacing
            : ArgoFeedRow.proseLineSpacing
        let ruler = NSHostingController(rootView: AnyView(
            Text(words)
                .argoText(face.rung, face.isBold ? .semibold : nil)
                .lineSpacing(leading),
        ))
        ruler.sizingOptions = []
        let height = ruler.sizeThatFits(
            in: NSSize(width: 400, height: CGFloat.greatestFiniteMagnitude),
        ).height
        ruler.rootView = AnyView(EmptyView())
        return height
    }

    @Test
    func faces() {
        for (name, face) in Self.named {
            let font = ProseFace(rung: face.rung, isBold: face.isBold).font
            print(
                "PROBE face=\(name) size=\(font.pointSize) asc=\(font.ascender) "
                    + "desc=\(font.descender) leading=\(font.leading) "
                    + "box=\(face.lineBox(under: .fractional)) step=\(face.step) "
                    + "chose=\(face.lineBox)",
            )
            for lines in [1, 2, 3, 8] {
                print(
                    "PROBE face=\(name) lines=\(lines) drawn=\(Self.drawn(face, lines: lines)) "
                        + "frac=\(face.height(ofLines: lines, under: .fractional)) "
                        + "snap=\(face.height(ofLines: lines, under: .wholePoint))",
                )
            }
        }
    }

    @Test
    func rows() {
        let rows = FeedTypesetHeightTests.rows()
        let model = FeedTableFixture.model(showing: rows)
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        let width: CGFloat = 460
        let measure = FeedRowMeasure.measure(atWidth: width)
        for at in rows.indices {
            guard let typeset = FeedRowMeasure.height(
                of: rows[at].content,
                chip: FeedCopy.drawsChip(of: rows, at: at),
                across: measure,
            ) else { continue }
            ruler.rootView = model.content(at: at)
            let drawn = ruler.sizeThatFits(
                in: NSSize(width: width, height: CGFloat.greatestFiniteMagnitude),
            ).height
            let step = FeedRow.step(to: rows[at], from: at > 0 ? rows[at - 1] : nil)
            guard ceil(step + typeset) != ceil(drawn) else { continue }
            var blocks: [String] = []
            if case let .message(words) = rows[at].content {
                for block in ProseReading.structure(of: words) {
                    let laid = block.laid(ink: .message, across: measure)
                    blocks.append("[\(block.kindName) raw=\(laid.height)]")
                }
            }
            print(
                "PROBE row \(at) step=\(step) typeset=\(typeset) drawn=\(drawn) "
                    + "chip=\(FeedCopy.drawsChip(of: rows, at: at)) "
                    + blocks.joined(separator: " "),
            )
        }
    }
}

extension MinimapProseBlock {
    var kindName: String {
        switch self {
        case let .prose(words): "prose chars=\(words.text.count)"
        case let .fence(lines, info): "fence lines=\(lines) info=\(info)"
        case .table: "table"
        case .diagram: "diagram"
        }
    }
}

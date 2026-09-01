import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

@MainActor
@Suite("ZZ probe")
struct ZZProbeTests {
    @Test
    func metrics() {
        for face in [ProseFace.body, ProseFace.machine, ProseFace.heading(level: 2)] {
            let font = face.font
            print(
                "PROBE face rung=\(face.rung) bold=\(face.isBold) machine=\(face.isMachine) "
                    + "name=\(font.fontName) size=\(font.pointSize) asc=\(font.ascender) "
                    + "desc=\(font.descender) leading=\(font.leading) "
                    + "capH=\(font.capHeight) xH=\(font.xHeight) "
                    + "boundingRect=\(font.boundingRectForFont) lineBox=\(face.lineBox)",
            )
        }
        print("PROBE engine \(ProseEngine.inForce)")
        for engine in [ProseEngine.fractional, .wholePoint] {
            let face = ProseFace.body
            print(
                "PROBE under \(engine) box=\(face.lineBox(under: engine)) "
                    + "step=\(face.step) "
                    + "three=\(face.height(ofLines: 3, under: engine))",
            )
        }
        print(
            "PROBE spacing prose=\(ArgoFeedRow.proseLineSpacing) "
                + "machine=\(ArgoFeedRow.machineLineSpacing) "
                + "blockStep=\(ArgoFeedRow.blockStep) chipSide=\(ArgoFeedRow.copyChipSide) "
                + "chipStep=\(ArgoFeedRow.copyChipStep) flush=\(ArgoSpacing.flush) "
                + "rungSize=\(ArgoFeedRow.proseRung.size) "
                + "ratio=\(ArgoTypeScale.naturalLineHeightRatio)",
        )
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
                in: NSSize(width: width, height: .greatestFiniteMagnitude),
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
        case let .prose(words): "prose lines=\(words.text.count)"
        case let .fence(lines, info): "fence lines=\(lines) info=\(info)"
        case .table: "table"
        case .diagram: "diagram"
        }
    }
}

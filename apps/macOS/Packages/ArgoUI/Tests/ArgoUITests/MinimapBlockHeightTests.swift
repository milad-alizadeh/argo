import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// Every markdown block, as the lane REPORTS it against what SwiftUI actually DRAWS it at.
///
/// The suite that would have caught all of it. Both numbers come from the shipping code and neither
/// is a fixture: the drawn one is `FeedMarkdown` measured through a hosting controller exactly as
/// the feed table measures a row, and the reported one is what the lane maps. A block that
/// disagrees here is a block the lane will draw at the wrong height, and nothing downstream can
/// tell that from a bug.
///
/// The drawn number is bracketed rather than given a tolerance, because SwiftUI does not lay text
/// out to the same sub-point on every machine. Two engines are in the wild and this suite has met
/// both: one keeps the font's own fractional metrics, so the block comes out at the reported height
/// rounded up; the other puts baselines on whole points, so each run pays `ceil` on its ascent, on
/// its descent and on every line advance after the first. So the drawn number is bracketed by the
/// reported one and the reported one plus that rounding, and a block has to land between them.
///
/// A `### h3` reported at 19.67 draws at 20 on one and 21 on the other, and a paragraph is 2.36
/// points under it — so no tolerance in points can hold both engines and still tell the two apart.
@MainActor
@Suite("Minimap block heights")
struct MinimapBlockHeightTests {
    private static let measure: CGFloat = 620 - ArgoFeedRow.inset * 2

    /// One block of each kind the feed draws, at each rung a heading takes.
    nonisolated static let blocks = [
        "A plain paragraph of words long enough to wrap at least twice across the measure the feed "
            + "gives it, ending short of the last line.",
        "One line and no more.",
        "# A title at level one",
        "## A title at level two",
        "### A title at level three",
        "###### The deepest level, which is the paragraph's own size at a heavier weight",
        "- a bullet",
        "1. a numbered item",
        "- a bullet long enough that its words wrap and have to stay inside their own column "
            + "rather than running back under the marker",
        "```swift\nlet a = 1\nlet b = 2\n```",
        "```\nlet a = 1\n```",
        "| a | b |\n|---|---|\n| 1 | 2 |",
        "```mermaid\ngraph TD\n  Reader --> Layout\n  Reader --> Plan\n```",
        "```mermaid\nC4Context\n  Person(dev, \"Nothing here can read this\")\n```",
        "| Rule | Where it is spelled |\n|---|---|\n| A column is as wide as its widest cell wants "
            + "to be, which takes more than one line to say | `FeedMarkdownTable` |",
    ]

    /// What SwiftUI lays the block out at, measured the way `FeedTableCoordinator` measures a row.
    private static func drawn(_ text: String, in ruler: NSHostingController<AnyView>) -> CGFloat {
        ruler.rootView = AnyView(
            FeedMarkdown(text: text).frame(width: measure).argoAppearance(),
        )
        return ruler.sizeThatFits(
            in: NSSize(width: measure, height: .greatestFiniteMagnitude),
        ).height
    }

    private static func reported(_ text: String) -> CGFloat {
        ProseReading.structure(of: text)
            .map { $0.laid(ink: .message, across: measure).height }
            .reduce(0, +)
    }

    /// How much taller than the REPORTED height a snapping engine can draw the same words. Its
    /// lines, its faces, and nothing about how tall the lane thinks they stand: a table adds
    /// nothing because it sizes itself, and a fence's padding is whole points already.
    ///
    /// Added to the lane's own height rather than to a second model of it, so a block the lane
    /// under-reports carries the under-report into its own upper bound and fails there. A bound
    /// built from a parallel model would move away from the lane exactly when the lane broke.
    private static func snapping(_ text: String) -> CGFloat {
        ProseReading.structure(of: text).map { block in
            switch block {
            case let .prose(words):
                words.face.snapping(ofLines: ProseMetrics.lay(
                    out: words.text, across: measure - words.indent, in: words.face,
                ).lines)
            case let .fence(lines, hasInfo):
                ProseFace(rung: ArgoTypography.sectionLabel.rung)
                    .snapping(ofLines: hasInfo ? 1 : 0)
                    + ProseFace.machine.snapping(ofLines: lines)
            // A table and a diagram both size themselves, so neither pays for a snapped baseline.
            case .table, .diagram:
                0
            }
        }
        .reduce(0, +)
    }

    @Test(arguments: blocks)
    func `a block reports the height the feed draws it at`(text: String) {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        defer { ruler.rootView = AnyView(EmptyView()) }
        let drawn = Self.drawn(text, in: ruler)
        let reported = Self.reported(text)
        #expect(reported <= drawn)
        #expect(drawn <= ceil(reported + Self.snapping(text)))
    }
}

private extension ProseFace {
    /// What snapping every baseline onto a whole point adds to `height(ofLines:)`: the line box
    /// rounded OUT at both ends, and every advance under the first rounded up.
    ///
    /// Off the rung's own face even for the mono, for the reason `lineBox` gives.
    @MainActor func snapping(ofLines lines: Int) -> CGFloat {
        guard lines > 0 else { return 0 }
        let font = ProseFace(rung: rung, isBold: isBold).font
        return ceil(font.ascender) - floor(font.descender) - lineBox
            + CGFloat(lines - 1) * (ceil(step) - step)
    }
}

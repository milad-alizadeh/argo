import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A typeset height against the height SwiftUI lays the same row out at, at zero tolerance.
///
/// This is the whole correctness of `FeedRowMeasure`. A row measured a point short leaves a gap
/// under its last line; a point long overlaps the row below it, and nothing downstream can tell
/// either from a bug. So both numbers come from the shipping code and neither is a fixture: the
/// drawn one is `FeedTableModel.content(at:)` through a hosting controller exactly as the table
/// measures a row, and the typeset one is what `FeedRowMeasure` answers.
///
/// Zero tolerance and not a bracket, unlike `MinimapBlockHeightTests`: that suite holds the lane's
/// FRACTIONAL height against what two text engines draw, and this one holds the whole point the row
/// is measured at, which both engines agree on because `Text` sizes itself to whole points.
@MainActor
@Suite("Feed typeset heights")
struct FeedTypesetHeightTests {
    /// Two widths: one narrower than the feed's column cap and one wider, so the cap is exercised
    /// rather than assumed.
    nonisolated static let widths: [CGFloat] = [460, 1000]

    /// Real prose, and the shapes of it that break a naive measure.
    nonisolated static let prose = [
        "Done.",
        "",
        "   ",
        "A plain paragraph of words long enough to wrap at least twice across the measure the feed "
            + "gives it, ending short of the last line.",
        String(repeating: "The row grew, and by more than one line. ", count: 12),
        "One.\nTwo, on its own line.\n\nThree, after a blank one.",
        "Trailing space   \nand a hard break.",
        // CJK, which wraps between characters rather than at spaces.
        "日本語のテキストは折り返しの規則が違うので、幅の計算も違います。これは折り返すだけの長さがある段落です。",
        "混排 English and 日本語 in one paragraph, long enough that the line has to break somewhere "
            + "inside the run of Han characters 一二三四五六七八九十.",
        // Emoji, including a ZWJ sequence and a regional-indicator pair.
        "Emoji 🎉 and a family 👨‍👩‍👧‍👦 plus a flag 🇯🇵 in one line of prose that goes on long "
            + "enough to wrap across the measure.",
        "🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉",
        // One unbroken token far wider than the measure.
        String(repeating: "a", count: 300),
        "A paragraph before /Users/milad/Developer/argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/"
            + "Shell/Deck/Feed/FeedTableCoordinator.swift and after it.",
        // Markdown: every block kind Core Text is asked to answer for.
        "## What I found\n\nThe ramp had drifted navy. Two things caused it:\n\n"
            + "1. `surface.base` was sampled from the old study.\n"
            + "2. The selected wash carried the brand hue.\n\n"
            + "```swift\npublic static let inset: CGFloat = ArgoSpacing.section\n```\n\n"
            + "- The contract suite is green again.\n- No view changed.",
        "# One\n## Two\n### Three\n###### Six",
        "```\nno info string\nand two lines\n```",
        // A blank line inside a fence is a real line, and a trailing one is too.
        "```swift\nlet a = 1\n\nlet b = 2\n```",
        "```swift\nlet a = 1\n\n```",
        "Words, then a fence with no blank line before it:\n```swift\nlet a = 1\n```",
        "- a bullet long enough that its words wrap and have to stay inside their own column "
            + "rather than running back under the marker",
        // The blocks that used to be declined and reach the ruler instead (ADR-0030 Rule 1): the
        // two that size themselves, and the fence whose empty body collapses onto another box.
        "| a | b |\n|---|---|\n| 1 | 2 |",
        "Words above the table.\n\n| a | b |\n|---|---|\n| 1 | 2 |",
        "| Rule | Where it is spelled |\n|---|---|\n| A column is as wide as its widest cell wants "
            + "to be, which takes more than one line to say | `FeedMarkdownTable` |",
        "```mermaid\ngraph TD\n  Reader --> Layout\n  Reader --> Plan\n```",
        "Words, then a diagram:\n\n```mermaid\ngraph TD\n  A --> B\n```",
        "```text\n\n```",
        "```\n```",
        "Words, and then an empty fence.\n\n```swift\n\n```",
        "**Bold** and *italic* and `code` and [a link](https://example.com) in one paragraph long "
            + "enough to wrap, because an inline mark changes the face a run is set in.",
    ]

    /// The rows the claim is made over: every prose text above as a message and again as a thought,
    /// with a prompt between them so the Turn rule has boundaries to find.
    static func rows() -> [FeedRow] {
        var rows: [FeedRow] = []
        for text in prose {
            rows.append(FeedRow(id: rows.count, content: .prompt(text: "ask", shots: [])))
            rows.append(FeedRow(id: rows.count, content: .message(text)))
            rows.append(FeedRow(id: rows.count, content: .thought(text)))
            rows.append(FeedRow(id: rows.count, content: .message(text)))
        }
        return rows
    }

    @Test(arguments: widths)
    func `a typeset prose row stands where SwiftUI lays it out`(width: CGFloat) {
        let rows = Self.rows()
        let model = FeedTableFixture.model(showing: rows)
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        var typesetRows = 0
        for at in rows.indices where rows[at].kind.isProse && !rows[at].kind.isPrompt {
            let typeset = FeedRowMeasure.height(
                ofProse: rows[at].kind.words ?? "",
                chip: FeedCopy.drawsChip(of: rows, at: at),
                across: FeedRowMeasure.measure(atWidth: width),
            )
            typesetRows += 1
            ruler.rootView = model.content(at: at)
            let drawn = ruler.sizeThatFits(
                in: NSSize(width: width, height: .greatestFiniteMagnitude),
            ).height
            let step = FeedRow.step(to: rows[at], from: at > 0 ? rows[at - 1] : nil)
            #expect(
                ceil(step + typeset) == ceil(drawn),
                "row \(at) at \(width): typeset \(step + typeset), drawn \(drawn)",
            )
        }
        // The claim is worthless if the routing quietly answered for nothing.
        #expect(typesetRows == Self.prose.count * 3)
    }

    /// The blocks a naive typeset declines, and the claim ADR-0030 Rule 1 turned that into: a
    /// prose row is answered whatever it holds. A table and a diagram size THEMSELVES, so each is
    /// taken at the height its own layout gives it rather than rounded like a run of glyphs, and a
    /// fence with an empty body is taken at the box its `Text("")` really collapses onto.
    ///
    /// They were the last rows in the feed reaching a ruler. Held at the same zero tolerance as
    /// every other prose row, at the same widths, by the case above — this one is here to say the
    /// corpus really does carry them, because a claim over a corpus that quietly lost its hard
    /// cases is a claim about nothing.
    @Test
    func `the blocks that used to decline are in the corpus`() {
        let held = [
            "| a | b |\n|---|---|\n| 1 | 2 |",
            "```mermaid\ngraph TD\n  A --> B\n```",
            "```text\n\n```",
        ]
        for block in held {
            #expect(Self.prose.contains { $0.contains(block) }, "the corpus lost \(block)")
        }
    }
}

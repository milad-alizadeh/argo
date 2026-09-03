import AppKit
import ArgoDesign
@testable import ArgoUI
import ProseText
import SwiftUI
import Testing

/// What a prose row DRAWS, against what it was measured at (ADR-0030, Rule 2).
///
/// The claim the lane exists to make. It is not the ruler comparison `FeedTypesetHeightTests`
/// makes — that one holds the row's total against SwiftUI. This one opens the frame the surface
/// inks and asks whether every block it draws lands inside the height the table was given, because
/// a block drawn past its row's foot is drawn over the row below and nothing downstream can tell
/// that from a bug.
@MainActor
@Suite("Prose surface")
struct ProseSurfaceTests {
    private static let measure = FeedRowMeasure.measure(atWidth: 620)

    /// The blocks a prose row is made of, each in its own fixture and then mixed — the corpus the
    /// ticket names: plain paragraphs, lists, fenced code, mermaid, and all of it together.
    nonisolated static let prose = [
        "Done.",
        "A plain paragraph of words long enough to wrap at least twice across the measure the feed "
            + "gives it, ending short of the last line.",
        "One.\nTwo, on its own line.\n\nThree, after a blank one.",
        "# One\n## Two\n### Three\n###### Six",
        "- a bullet long enough that its words wrap and have to stay inside their own column "
            + "rather than running back under the marker\n- and a second one",
        "1. The first\n2. The second\n10. The tenth, so the marker column is exercised",
        "```swift\nlet a = 1\nlet b = 2\n```",
        "```\nno info string\n```",
        "```text\n\n```",
        "```mermaid\ngraph TD\n  Reader --> Layout\n  Reader --> Plan\n```",
        "| a | b |\n|---|---|\n| 1 | 2 |",
        "**Bold** and *italic* and `code` and [a link](https://example.com) in one paragraph long "
            + "enough to wrap, because an inline mark changes the face a run is set in.",
        "## What landed\n\nThe ramp had drifted navy:\n\n1. `surface.base` was sampled old.\n\n"
            + "```swift\nlet inset = 24\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n"
            + "- The suite is green.\n\n```mermaid\ngraph TD\n  A --> B\n```",
    ]

    @Test(arguments: prose)
    func `every block a row draws lands inside the height it was measured at`(text: String) {
        let placed = ProseReading.frame(of: text, across: Self.measure)
        #expect(placed.height == FeedRowMeasure.height(
            ofProse: text, chip: false, across: Self.measure,
        ))
        for part in placed.parts {
            #expect(part.rect.minY >= 0, "block above the row's top in \(text.prefix(24))")
            #expect(
                part.rect.maxY <= placed.height + 0.01,
                "block past the row's foot in \(text.prefix(24))",
            )
        }
    }

    /// The drawn extent, not the placement: a run of words inks `lines.count` lines at its own
    /// rhythm, and the last of them has to sit inside the block it was placed in.
    @Test(arguments: prose)
    func `the lines a block inks stand no taller than the block`(text: String) {
        for part in ProseReading.frame(of: text, across: Self.measure).parts {
            guard case let .words(run, _, _) = part.part else { continue }
            #expect(
                run.height <= part.rect.height + 0.01,
                "run of \(run.lines.count) lines over its block in \(text.prefix(24))",
            )
        }
    }

    /// One typeset, asked twice. The count the height is worked out from and the lines the surface
    /// inks are the same pass, so a wrap cannot be answered two ways.
    @Test
    func `the lines the measure counted are the lines the surface inks`() {
        let words = String(repeating: "The row grew, and by more than one line. ", count: 6)
        let run = ProseMetrics.run(of: words, across: Self.measure)
        #expect(run.lines.count == ProseMetrics.lay(out: words, across: Self.measure).lines)
        #expect(run.lines.count > 1)
    }
}

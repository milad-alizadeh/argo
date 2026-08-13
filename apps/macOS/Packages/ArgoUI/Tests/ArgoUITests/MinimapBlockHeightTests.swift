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
/// The tolerance is one point because a `Text` reports an integral height: the drawn number is the
/// reported one rounded up.
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

    @Test(arguments: blocks)
    func `a block reports the height the feed draws it at`(text: String) {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        defer { ruler.rootView = AnyView(EmptyView()) }
        let drawn = Self.drawn(text, in: ruler)
        let reported = Self.reported(text)
        #expect(reported <= drawn)
        #expect(drawn - reported < 1)
    }
}

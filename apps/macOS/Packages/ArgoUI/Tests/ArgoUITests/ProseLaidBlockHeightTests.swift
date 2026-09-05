import AppKit
import ArgoDesign
@testable import ArgoUI
import ProseText
import SwiftUI
import Testing

/// The frame a self-laying block is HOSTED at, against what SwiftUI lays that block out at.
///
/// The one place the lane's by-construction argument does not reach. A run of words is drawn by the
/// frame that measured it, so its height cannot drift; a fence, a pipe table and a diagram are
/// still SwiftUI, hosted at a rectangle arithmetic decided (`FeedProseFrame.standing`) with
/// `sizingOptions = []` — so a disagreement between the formula and the layout clips or gaps in
/// silence, and this is the suite that looks.
///
/// The ruler is the oracle it has been since ADR-0030 Rule 1: `FeedProseLaidBlock` through a
/// hosting controller, which is the very view `ProseSurface` hosts.
///
/// Driven from the named list of block kinds, so a fourth self-laying block without a formula fails
/// the build here rather than escaping the claim.
@MainActor
@Suite("Prose laid-block heights")
struct ProseLaidBlockHeightTests {
    /// Narrower than the feed's column cap and wider, so the cap is exercised rather than assumed.
    nonisolated static let widths: [CGFloat] = [460, 1000]

    /// One fixture per self-laying kind, and the hard cases inside each: a fence with and without a
    /// language, an empty one, a table whose cell wraps, and both a diagram Argo reads and a fence
    /// declaring `mermaid` that it cannot.
    nonisolated static let blocks = [
        "```swift\nlet a = 1\nlet b = 2\n```",
        "```\nno info string\nand two lines\n```",
        "```swift\nlet a = 1\n\nlet b = 2\n```",
        "```text\n\n```",
        "```\n```",
        "| a | b |\n|---|---|\n| 1 | 2 |",
        "| Rule | Where it is spelled |\n|---|---|\n| A column is as wide as its widest cell wants "
            + "to be, which takes more than one line to say | `FeedMarkdownTable` |",
        "```mermaid\ngraph TD\n  Reader --> Layout\n  Reader --> Plan\n```",
        "```mermaid\nC4Context\n  Person(dev, \"Nothing here can read this\")\n```",
        // A picture nothing fetches under test, which is the state that must still stand at the
        // fixed box: the alt text is drawn INSIDE the plate, never in place of it.
        "![Atlas shading](https://example.invalid/a.png)",
    ]

    @Test(arguments: widths)
    func `a hosted block is given the frame SwiftUI draws it at`(width: CGFloat) throws {
        let measure = FeedRowMeasure.measure(atWidth: width)
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        var hosted = 0
        for text in Self.blocks {
            let placed = ProseReading.frame(of: text, across: measure)
            let part = try #require(placed.parts.first)
            guard case let .laid(block) = part.part else {
                Issue.record("\(text.prefix(20)) is not a hosted block")
                continue
            }
            hosted += 1
            ruler.rootView = AnyView(
                FeedProseLaidBlock(block: block).frame(width: measure).argoAppearance(),
            )
            let drawn = ruler.sizeThatFits(
                in: NSSize(width: measure, height: .greatestFiniteMagnitude),
            ).height
            #expect(
                ceil(part.rect.height) == ceil(drawn),
                "\(text.prefix(20)) at \(width): hosted at \(part.rect.height), draws \(drawn)",
            )
        }
        // The claim is worthless if the routing quietly answered for nothing.
        #expect(hosted == Self.blocks.count)
    }

    /// Every kind that lays itself out has a fixture above. A fourth one — a block list that grew a
    /// case — fails here rather than being hosted at a rectangle nothing ever checked.
    @Test
    func `every self-laying block kind is in the corpus`() {
        var kinds: Set<String> = []
        for text in Self.blocks {
            for block in ProseReading.blocks(in: text) {
                switch block {
                case .fenced: kinds.insert("fenced")
                case .table: kinds.insert("table")
                case .diagram: kinds.insert("diagram")
                case .picture: kinds.insert("picture")
                // Words, which the surface inks itself — no frame is handed to anything.
                case .paragraph, .heading, .bullet, .numbered: break
                }
            }
        }
        #expect(kinds == ["fenced", "table", "diagram", "picture"])
    }
}

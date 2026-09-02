import ArgoDesign
import MermaidView
import SwiftUI

/// A message's markdown, drawn with the shape the agent gave it.
///
/// The blocks are found by `MarkdownBlock` and drawn here — nothing is reworded on either side of
/// that line.
package struct FeedMarkdown: View {
    @Environment(\.argo) private var argo

    let text: String

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
            ForEach(Array(ProseReading.blocks(in: text).enumerated()), id: \.offset) { _, block in
                FeedMarkdownBlock(block: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(text: String) {
        self.text = text
    }
}

/// One block. Each arm decides only a role and a shape — the words are `FeedProseText`'s, so the
/// inline marks inside a heading or a list item are read the same way they are inside a paragraph.
private struct FeedMarkdownBlock: View {
    @Environment(\.argo) private var argo

    let block: MarkdownBlock

    var body: some View {
        switch block {
        case let .paragraph(text):
            FeedProseText(text: text, rung: ArgoFeedRow.proseRung)
                .fixedSize(horizontal: false, vertical: true)
        case let .heading(level, text):
            // Three rungs for six levels, and the deepest of them is the prose's own size at a
            // heavier weight — never smaller than the paragraph under it.
            FeedProseText(text: text, rung: headingRung(level), weight: .semibold)
                .foregroundStyle(argo.color.text.primary)
                .fixedSize(horizontal: false, vertical: true)
        case let .bullet(text):
            item(marker: "•", text: text)
        case let .numbered(marker, text):
            item(marker: marker, text: text)
        case let .fenced(code, info):
            FeedMarkdownFence(code: code, info: info)
        case let .diagram(diagram):
            MermaidView(diagram: diagram)
        case let .table(table):
            FeedMarkdownTable(table: table)
        }
    }

    private func headingRung(_ level: Int) -> ArgoTypeScale {
        switch level {
        case 1: .title1
        case 2: .title2
        default: .title3
        }
    }

    /// A marker in a column of its own, so list words line up and a wrapped item stays inside its
    /// own words rather than running back under its marker.
    private func item(marker: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
            FeedMarker(text: marker)
            FeedProseText(text: text, rung: ArgoFeedRow.proseRung)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

#Preview("Feed markdown — the shape a turn's answer arrives in") {
    FeedMarkdown(text: """
    ## What I found

    The ramp had drifted navy. Two things caused it:

    1. `surface.base` was sampled from the old study.
    2. The selected wash carried the brand hue.

    ```swift
    public static let inset: CGFloat = ArgoSpacing.section
    ```

    - The contract suite is green again.
    - No view changed.
    """)
    .padding(ArgoFeedRow.inset)
    .frame(width: 620)
    .argoDeckSurface()
    .argoAppearance()
}

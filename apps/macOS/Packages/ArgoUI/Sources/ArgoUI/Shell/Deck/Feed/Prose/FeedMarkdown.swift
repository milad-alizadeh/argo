import SwiftUI

/// A message's markdown, drawn with the shape the agent gave it.
///
/// The blocks are found by `MarkdownBlock` and drawn here — nothing is reworded on either side of
/// that line. What changes is that an outline reads as an outline: a heading is a heading rather
/// than two hashes at paragraph size, and a fenced block sits on a ground instead of between rows
/// of backticks.
struct FeedMarkdown: View {
    @Environment(\.argo) private var argo

    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
            ForEach(Array(MarkdownBlock.blocks(in: text).enumerated()), id: \.offset) { _, block in
                FeedMarkdownBlock(block: block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
            // heavier weight. A size per level is how a scale grows six rungs nobody can tell
            // apart,
            // and a level-four heading smaller than the paragraph under it would be an outline
            // upside down.
            FeedProseText(text: text, rung: headingRung(level), weight: .semibold)
                .foregroundStyle(argo.color.text.primary)
                .fixedSize(horizontal: false, vertical: true)
        case let .bullet(text):
            item(marker: "•", text: text)
        case let .numbered(marker, text):
            item(marker: marker, text: text)
        case let .fenced(code, info):
            FeedMarkdownFence(code: code, info: info)
        }
    }

    private func headingRung(_ level: Int) -> ArgoTypeScale {
        switch level {
        case 1: .title1
        case 2: .title2
        default: .title3
        }
    }

    /// A marker in a column of its own, so the words of a list line up whether the markers are
    /// bullets or numbers — and so a wrapped item stays inside its own words rather than running
    /// back under its marker.
    private func item(marker: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
            Text(marker)
                .argoText(ArgoFeedRow.proseRung)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoFeedRow.markerWidth, alignment: .trailing)
            FeedProseText(text: text, rung: ArgoFeedRow.proseRung)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A fenced block: the agent's characters, on a ground, at the machine role.
///
/// The language it declared is drawn as a label rather than used to colour anything. Syntax
/// highlighting would be Argo reading the code; the label is the agent saying what it wrote.
private struct FeedMarkdownFence: View {
    @Environment(\.argo) private var argo

    let code: String
    let info: String?

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            if let info {
                Text(info)
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            Text(code)
                .argoMono(.body)
                .foregroundStyle(argo.color.text.secondary)
                .textSelection(.enabled)
                .lineSpacing(ArgoFeedRow.machineLineSpacing)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(ArgoSpacing.base)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.control))
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

import SwiftUI

/// A block of what the agent produced, at a reading measure.
///
/// One view for both prose kinds rather than two near-identical ones: a message and a thought are
/// the same shape, and the whole point of the distinction is that only the ink and the label move.
/// Two files would let them drift apart, which is the moment reasoning starts looking like an
/// answer.
struct FeedProse: View {
    /// Whose voice the block is in. Carries the label and the ink together, so a row cannot be
    /// given one without the other.
    enum Voice {
        case message
        case thought

        /// A message needs no label — it is what the feed is FOR, and a name over every one of
        /// them would be chrome. Reasoning is labelled because a quieter ink alone is a difference
        /// a reader has to already know how to read.
        var label: String? {
            switch self {
            case .message: nil
            case .thought: "Thought"
            }
        }
    }

    @Environment(\.argo) private var argo

    let text: String
    let voice: Voice

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.stepBeforeProse) {
            if let label = voice.label {
                Text(label)
                    .argoText(ArgoTypography.sectionLabel)
                    .textCase(.uppercase)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            prose
        }
        // The column, and nothing narrower. Prose used to stop at a reading measure while the call
        // lines under it ran the full width — which reads as a block that failed to lay out rather
        // than as a considered measure, because the thing it is measured against is right there
        // beside it. The COLUMN is the measure now, and the reader sets it with the seam.
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(voice.label.map { "\($0): \(text)" } ?? text)
    }

    /// Selectable: this is the record, so the reader gets to take it away as the agent wrote it.
    private var prose: some View {
        FeedMarkdown(text: text)
            .foregroundStyle(ink)
            .textSelection(.enabled)
    }

    private var ink: ArgoColor {
        switch voice {
        case .message: argo.color.text.primary
        case .thought: argo.color.text.tertiary
        }
    }
}

#Preview("Feed prose — a message and the reasoning behind it") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        FeedProse(
            text: "The neutral ramp had drifted navy. I pulled the blue back out of the "
                + "surfaces and the contract suite is green again.",
            voice: .message,
        )
        FeedProse(
            text: "Same words, quieter ink: this is what the turn was thinking, not what it "
                + "answered.",
            voice: .thought,
        )
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prose — a wide deck must not widen the line") {
    FeedProse(
        text: String(repeating: "A line of prose that keeps going. ", count: 12),
        voice: .message,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 1400)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Feed prose — a single word") {
    FeedProse(text: "Done.", voice: .message)
        .padding(ArgoFeedRow.inset)
        .frame(width: 520)
        .argoDeckSurface()
        .argoAppearance()
}

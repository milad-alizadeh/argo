import SwiftUI

/// A block of what the agent produced, at a reading measure.
///
/// One view for both prose kinds rather than two near-identical ones: a message and a thought are
/// the same shape, and the whole point of the distinction is that only the ink moves. Two files
/// would let them drift apart, which is the moment reasoning starts looking like an answer.
struct FeedProse: View {
    /// Whose voice the block is in. Carries the ink and the spoken name together, so a row cannot
    /// be given one without the other.
    enum Voice {
        case message
        case thought

        /// What a screen reader is told this block is. On screen the quieter ink carries it and no
        /// title is drawn — a word standing over every stretch of reasoning is chrome once a reader
        /// has met the ink twice. A screen reader has no ink to read it from, which is why the
        /// distinction survives here rather than being dropped with the title.
        var spokenAs: String? {
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
        prose
            // The column, and nothing narrower. Prose used to stop at a reading measure while the
            // call lines under it ran the full width — which reads as a block that failed to lay
            // out rather than as a considered measure, because the thing it is measured against is
            // right there beside it. The COLUMN is the measure now, and the reader sets it with the
            // seam.
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(voice.spokenAs.map { "\($0): \(text)" } ?? text)
    }

    /// Selectable: this is the record, so the reader gets to take it away as the agent wrote it.
    private var prose: some View {
        FeedMarkdown(text: text)
            .foregroundStyle(ink)
            // The same ink again, and not a duplication: `foregroundStyle` is what DRAWS the
            // words and nothing can read it back, so a span inside the block has no way to ask
            // what it is inheriting. This is the readable copy, and the only thing that consumes
            // it is the marked-span floor.
            .environment(\.proseVoice, ink)
            .textSelection(.enabled)
    }

    private var ink: ArgoColor {
        switch voice {
        case .message: argo.color.text.primary
        case .thought: argo.color.text.tertiary
        }
    }
}

public extension EnvironmentValues {
    /// The ink the prose of the current block is set in.
    ///
    /// Only a marked `code` span reads it, and only to find out whether inheriting would put it
    /// under the contrast floor on its own ground. `nil` means nobody has claimed a voice, which
    /// is the case for every surface that draws prose at the primary ink and never needed to say
    /// so — a span there inherits and the floor never engages.
    @Entry var proseVoice: ArgoColor?
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

import ArgoDesign
import SwiftUI

/// A block of what the agent produced, at a reading measure.
///
/// One view for both prose kinds: a message and a thought are the same shape, and only the ink
/// moves.
struct FeedProse: View {
    /// Whose voice the block is in. Carries the ink and the spoken name together, so a row cannot
    /// be given one without the other.
    enum Voice {
        case message
        case thought

        /// What a screen reader is told this block is. On screen the quieter ink carries it and no
        /// title is drawn; a screen reader has no ink to read it from.
        var spokenAs: String? {
            switch self {
            case .message: nil
            case .thought: "Thought"
            }
        }
    }

    @Environment(\.argo) private var argo
    /// Which links in this block are Tickets — see `FeedTicketLinks`.
    @Environment(\.argoFeedTickets) private var tickets

    let text: String
    let voice: Voice

    var body: some View {
        prose
            // The column is the measure, and nothing narrower — the reader sets it with the seam.
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(voice.spokenAs.map { "\($0): \(words)" } ?? words)
    }

    /// The block's words as they are DRAWN: the record's own, with every link Argo can address
    /// said the way Argo says a Ticket (#1178).
    ///
    /// The one place this view reads them, so the glyphs, the accessibility label and the height
    /// `FeedShapeHeight` took cannot come apart. The label is the block's markdown, as it has
    /// always been; what says `#1175` to a reader who is not looking is the link element the
    /// surface publishes (`ProseSurface.accessibilityChildren()`).
    private var words: String {
        FeedTicketProse.worded(text, as: tickets)
    }

    /// The voice, readable rather than drawn: the surface inks every glyph itself off the frame
    /// that measured it, so the ink is a value it is handed and not a style it inherits.
    ///
    /// Not selectable, and deliberately: ADR-0030 Rule 8 makes selection a LAYER over the table
    /// rather than a property of a cell, and the frame this row exposes is what that layer will
    /// hit-test. What a reader can still take away whole is the Turn, through its copy chip.
    private var prose: some View {
        FeedMarkdown(text: words, tickets: tickets)
            .environment(\.proseVoice, ink)
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
    /// under the contrast floor on its own ground. `nil` means nobody claimed a voice: a span
    /// there inherits and the floor never engages.
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

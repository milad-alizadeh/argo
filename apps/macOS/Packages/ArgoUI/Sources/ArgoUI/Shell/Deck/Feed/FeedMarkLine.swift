import SwiftUI

/// A mark, drawn as a rule with its words let into it.
///
/// The only hairlines in the feed are here. A rule under an ordinary row is a box being drawn round
/// something that is already a paragraph in a column; a rule ACROSS the column says the reading
/// changed shape at this point, which is the one thing these three rows have in common.
///
/// The words are machine type for the same reason: they are the record talking about itself — a
/// stop reason is the host's own word, and a token count is a number — not the agent talking.
///
/// A mark with nothing to say is the rule alone, running the whole column. That is the ordinary end
/// of a turn: it happens at every turn boundary in the feed, and words repeated that often stop
/// being read and start being the ground they are drawn on.
struct FeedMarkLine: View {
    @Environment(\.argo) private var argo
    /// How this row reaches another Session. From the environment rather than threaded through the
    /// four views between here and the shell, exactly as `deckIsResizing` is: none of them has any
    /// business carrying a navigation nothing else in the deck performs.
    @Environment(\.argoOpenSession) private var openSession

    let mark: FeedMark

    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            rule
            if let handoff = mark.handoff {
                link(to: handoff)
                rule
            } else if let words = mark.words {
                caption(words)
                rule
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(mark.spoken)
    }

    /// The one mark that is a way out of the reading: the same words as any other, made pressable
    /// and given the ink this app spends on every other link (`FeedProseText`'s markdown links take
    /// it too, so a reader learns one colour and not two).
    ///
    /// A caption-sized arrow rather than an underline: the row is machine type let into a hairline,
    /// and an underline at this size closes up against the descenders.
    private func link(to handoff: FeedHandoff) -> some View {
        Button { openSession(handoff.sessionID) } label: {
            HStack(spacing: ArgoSpacing.tight) {
                caption(mark.words ?? handoff.title, in: argo.color.interaction.accent)
                ArgoGlyph(ArgoSymbol.handedOff, .inline)
                    .foregroundStyle(argo.color.interaction.accent)
            }
        }
        .buttonStyle(.plain)
        .help("Open \(handoff.title), the Session this work was handed to")
    }

    private func caption(_ text: String, in ink: ArgoColor? = nil) -> some View {
        Text(text)
            .argoText(ArgoTypography.machineCaption)
            .monospacedDigit()
            .foregroundStyle(ink ?? argo.color.text.tertiary)
            .lineLimit(1)
            .fixedSize()
    }

    private var rule: some View {
        Rectangle()
            .fill(argo.color.edge.hairline)
            .frame(height: ArgoStroke.hairline)
    }
}

#Preview("Marks — every one the preview transcript punctuates its reading with") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewMarks.enumerated()), id: \.offset) { _, mark in
            FeedMarkLine(mark: mark)
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

// A stop reason outside the vocabulary reads `unknown` rather than the nearest guess, and that is
// the one mark a real transcript is least likely to carry — so it gets a render of its own.
#Preview("Marks — a turn that ended for a reason nothing could read") {
    FeedMarkLine(mark: .turnEnded(.unknown))
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
}

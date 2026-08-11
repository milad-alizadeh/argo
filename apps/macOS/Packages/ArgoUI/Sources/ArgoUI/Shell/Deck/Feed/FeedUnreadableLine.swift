import SwiftUI

/// A stretch of the record nothing could parse, drawn as one quiet line the reader can open.
///
/// The same anatomy as a call and a survey — a mark, then words. Quiet rather than loud: the
/// agent's work did not go wrong here, the READING did.
///
/// The raw text is behind a disclosure rather than on the line — it is malformed JSON, worth
/// keeping and never worth reading by accident.
struct FeedUnreadableLine: View {
    @Environment(\.argo) private var argo

    let unreadable: FeedUnreadable
    /// Held by the feed, not here: the projection hands the feed a fresh copy of every row as the
    /// transcript grows, and a fold that lived in the row would quietly re-close behind the reader.
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
            Button { isExpanded.toggle() } label: {
                sentence
            }
            .buttonStyle(FeedRowButtonStyle(isOpen: isExpanded))
            .accessibilityElement(children: .combine)
            .accessibilityLabel(unreadable.label)
            .accessibilityHint("Shows the text that could not be read")
            if isExpanded {
                raw
            }
        }
    }

    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(unreadable.label)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.tertiary)
            ArgoGlyph(ArgoSymbol.disclosureTrailing, .inline)
                .foregroundStyle(
                    isExpanded ? argo.color.interaction.accent : argo.color.text.disabled,
                )
        }
        .lineLimit(1)
    }

    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay { ArgoGlyph(ArgoSymbol.unreadable, .inline) }
            .foregroundStyle(argo.color.text.disabled)
    }

    /// Verbatim, selectable, and wrapped rather than cut — half a malformed line diagnoses nothing.
    private var raw: some View {
        Text(unreadable.raw)
            .argoMono(.body)
            .foregroundStyle(argo.color.text.tertiary)
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap)
            .accessibilityLabel("The text that could not be read")
    }
}

#Preview("Unreadable line — one truncated record") {
    @Previewable @State var isExpanded = false

    FeedUnreadableLine(
        unreadable: FeedUnreadable(lines: ["{\"type\":\"assistant\",\"message\":"]),
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Unreadable line — a run of them, opened") {
    @Previewable @State var isExpanded = true

    FeedUnreadableLine(
        unreadable: FeedUnreadable(lines: ["{", "[\"content\"", "\"role\": \"assist"]),
        isExpanded: $isExpanded,
    )
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

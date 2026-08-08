import SwiftUI

/// A run of looking, drawn as one quiet line.
///
/// The same anatomy as a call line — a mark, then words, then the chevron — so a folded run reads
/// as one more thing that happened rather than as a summary bolted over the feed. Quieter than a
/// call throughout: it is the row you skim past on the way to the work, and the only reason it is
/// on screen at all is that the work is easier to find with the traffic counted than deleted.
struct FeedSurveyLine: View {
    @Environment(\.argo) private var argo

    let survey: FeedSurvey
    let isOpen: Bool
    let open: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
            Button(action: open) {
                sentence
            }
            .buttonStyle(FeedRowButtonStyle(isOpen: isOpen))
            .disabled(survey.disclosure == .none)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(survey.spoken)
            .accessibilityHint(
                survey.disclosure == .available ? "Opens what these calls produced" : "",
            )
            if isOpen {
                looked
            }
        }
    }

    /// What the run actually looked at, listed under the count — but only while this is the row the
    /// panel is open on.
    ///
    /// The fold is what the feed is for; the names are what you want the moment you stop skimming
    /// and pick one line to read. Showing them on every survey would put the nine rows back, and
    /// showing them on hover would make them a thing you find by accident, so they answer to the
    /// same state the panel does: one row at a time, the one you chose.
    private var looked: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            ForEach(Array(survey.calls.enumerated()), id: \.offset) { _, call in
                Text(call.subject.captioned)
                    .argoText(ArgoFeedRow.proseRung)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                    .truncationMode(.head)
            }
        }
        .padding(.leading, ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What this run looked at")
    }

    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(survey.label)
                .argoText(ArgoTypography.body)
                .foregroundStyle(isOpen ? argo.color.text.secondary : argo.color.text.tertiary)
            disclosure
        }
        .lineLimit(1)
    }

    /// One mark for the run and not one per kind. The line already names the kinds in words, and a
    /// row that opened with two glyphs would be the only row in the feed that did.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay { ArgoGlyph(ArgoSymbol.looked, .inline) }
            .foregroundStyle(argo.color.text.disabled)
    }

    @ViewBuilder private var disclosure: some View {
        if survey.disclosure == .available {
            ArgoGlyph(ArgoSymbol.disclosureTrailing, .inline)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }
}

#Preview("Survey line — the run of looking a turn opens with") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewRows) { row in
            if case let .survey(survey) = row.content {
                FeedSurveyLine(survey: survey, isOpen: false, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

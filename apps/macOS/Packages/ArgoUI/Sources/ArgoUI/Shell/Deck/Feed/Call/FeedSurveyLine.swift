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
    /// Go to what one of the listed calls produced, by its place in the run. Inert by default so a
    /// specimen draws the list without a panel to send anybody to.
    var look: (Int) -> Void = { _ in }
    /// Which step of the panel is being shown, where this row is the open one. The name that points
    /// at it is marked, so a reader who has scrolled the pane can still see which of nine files
    /// they are looking at.
    var current: Int?

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
            ForEach(Array(survey.calls.enumerated()), id: \.offset) { position, call in
                name(of: call, at: position)
            }
        }
        .padding(.leading, ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What this run looked at")
    }

    /// One name in that list, and a way into the pane beside it.
    ///
    /// A control and not a caption: the panel is a column of files and this list is its contents,
    /// so the name a reader wants is the thing they press to get there. A call the record answered
    /// with nothing is still listed — it happened — and is inert, for the reason its own row would
    /// be: there is nothing behind it to go to.
    private func name(of call: FeedCall, at position: Int) -> some View {
        Button { look(position) } label: {
            Text(call.subject.captioned)
                .argoText(ArgoFeedRow.proseRung)
                .foregroundStyle(ink(at: position))
                .lineLimit(1)
                .truncationMode(.head)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .disabled(survey.step(of: position) == nil)
        .accessibilityHint(survey.step(of: position) == nil ? "" : "Shows what this call produced")
    }

    /// The name pointing at what the pane is showing is lit, exactly as the row that opened the
    /// pane is. Everything else stays as quiet as the count above it.
    private func ink(at position: Int) -> ArgoColor {
        isOpen && survey.step(of: position) == current
            ? argo.color.interaction.accentBright
            : argo.color.text.tertiary
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

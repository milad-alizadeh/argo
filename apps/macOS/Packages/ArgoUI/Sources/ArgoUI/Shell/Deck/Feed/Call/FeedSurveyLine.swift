import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A run of looking, drawn as one quiet line.
///
/// The same anatomy as a call line — a mark, then words, then the chevron — and quieter than one
/// throughout.
package struct FeedSurveyLine: View {
    @Environment(\.argo) private var argo

    let survey: FeedSurvey
    let isOpen: Bool
    let open: () -> Void
    /// Go to what one of the listed calls produced, by its place in the run. Inert by default so a
    /// specimen draws the list without a panel to send anybody to.
    var look: (Int) -> Void = { _ in }
    /// Which step of the panel is being shown, where this row is the open one. The name that points
    /// at it is the current one.
    var current: Int?

    package var body: some View {
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
    /// A call the record answered with nothing is still listed — it happened — and is inert:
    /// there is nothing behind it to go to.
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

    /// One mark for the run and not one per kind — the line already names the kinds in words.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay { ArgoGlyph(ArgoSymbol.looked, .inline) }
            .foregroundStyle(argo.color.text.disabled)
    }

    @ViewBuilder private var disclosure: some View {
        if survey.disclosure == .available {
            ArgoDisclosure(.beside)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        survey: FeedSurvey,
        isOpen: Bool,
        open: @escaping () -> Void,
        look: @escaping (Int) -> Void = { _ in },
        current: Int? = nil,
    ) {
        self.survey = survey
        self.isOpen = isOpen
        self.open = open
        self.look = look
        self.current = current
    }
}

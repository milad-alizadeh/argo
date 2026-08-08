import ArgoEngine
import SwiftUI

/// A call, drawn as one line of type with a mark on it.
///
/// One line at any window width, and one line WHATEVER happened: a failure is marked rather than
/// explained here, because a feed that prints what went wrong stops being a feed the moment a
/// stack trace lands in it. What went wrong is the panel's, whole and verbatim.
struct FeedCallLine: View {
    @Environment(\.argo) private var argo

    let call: FeedCall
    /// Whether this row's evidence is what the panel is showing. The row that was opened stays
    /// marked, or a reader with a panel full of output has nothing saying which line it came from.
    let isOpen: Bool
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            sentence
        }
        .buttonStyle(FeedCallButtonStyle(isOpen: isOpen))
        .disabled(call.disclosure == .none)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
        .accessibilityHint(call.disclosure == .available ? "Opens what this call produced" : "")
    }

    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(call.kind.verb)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.tertiary)
            FeedCallSubject(
                subject: call.subject,
                destination: call.kind.destination,
                isOpen: isOpen,
            )
            churn
            outcome
            disclosure
        }
        .lineLimit(1)
    }

    /// The mark takes the failure ink, which is how a failed call announces itself: the words stay
    /// the words, and a red verb would read as a different verb. The column is drawn as an empty
    /// one where there is no mark, not skipped — a run of calls reads as one piece of work because
    /// every verb starts on the same vertical.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoTypography.body.glyphSize)
            .overlay {
                if let symbol = markSymbol {
                    ArgoGlyph(symbol, ArgoTypography.body)
                }
            }
            .foregroundStyle(
                call.ending.hasFailed ? argo.color.state.failure : argo.color.text.disabled,
            )
    }

    /// A failure takes its OWN mark rather than a tinted version of its kind's. Colour alone is
    /// not a reading: it is the one difference a reader who cannot see it would lose entirely, and
    /// this row's whole account of the failure is now the mark and one word.
    private var markSymbol: String? {
        call.ending.hasFailed ? ArgoSymbol.callFailed : call.kind.symbol
    }

    @ViewBuilder private var churn: some View {
        if let churn = call.churn, !churn.isSilent {
            HStack(spacing: ArgoSpacing.tight) {
                if churn.added > 0 {
                    Text("+\(churn.added)").foregroundStyle(argo.color.diff.added)
                }
                if churn.removed > 0 {
                    Text("−\(churn.removed)").foregroundStyle(argo.color.diff.removed)
                }
            }
            .argoText(ArgoTypography.machine)
            .monospacedDigit()
        }
    }

    /// What the call produced, reduced to one line of its own output — the last line a command
    /// printed, or the host's exit line where it failed. In the failure ink when it failed, so the
    /// row says so twice and never only in colour.
    @ViewBuilder private var outcome: some View {
        if let outcome = call.ending.outcome {
            Text(outcome)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(
                    call.ending.hasFailed ? argo.color.state.failure : argo.color.text.tertiary,
                )
        }
    }

    @ViewBuilder private var disclosure: some View {
        if call.disclosure == .available {
            ArgoGlyph(indicator: ArgoSymbol.disclosureTrailing, height: ArgoLayout.disclosureHeight)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    private var spoken: String {
        [call.kind.verb, call.subject.spoken, call.ending.outcome]
            .compactMap(\.self)
            .joined(separator: " ")
    }
}

/// A row that opens something, drawn as a line of prose rather than as a control.
///
/// The whole line is the target and not just the filename in it: at this density a word-sized hit
/// area is a row you have to aim at, and every part of the sentence is about the same call anyway.
private struct FeedCallButtonStyle: ButtonStyle {
    @Environment(\.argo) private var argo
    @Environment(\.isEnabled) private var isEnabled

    let isOpen: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, ArgoSpacing.snug)
            .padding(.vertical, ArgoSpacing.hair)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                ground(configuration.isPressed),
                in: .rect(cornerRadius: ArgoRadius.control),
            )
            // Back out the inset the ground needs, so a row with evidence and one without still
            // start on the same vertical. The highlight is drawn around the line, not beside it.
            .padding(.horizontal, -ArgoSpacing.snug)
            .contentShape(.rect)
    }

    private func ground(_ isPressed: Bool) -> ArgoColor {
        guard isEnabled else { return .transparent }
        if isOpen {
            return argo.color.surface.selected
        }
        return isPressed ? argo.color.surface.selected : .transparent
    }
}

#Preview("Call lines — every kind the preview transcript makes") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallLine(call: call, isOpen: false, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Call lines — the row whose evidence is open") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallLine(call: call, isOpen: call.ending.hasFailed, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

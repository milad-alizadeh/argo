import ArgoEngine
import SwiftUI

/// A call, drawn as one line of type with a mark on it.
///
/// One line at any window width, and one line WHATEVER happened. How it went is said in the ink of
/// the whole line and a mark after it — never in words. The record's own account of a failure is
/// the panel's, whole.
///
/// Every part of the sentence is set on ONE rung, interface and mono alike.
struct FeedCallLine: View {
    @Environment(\.argo) private var argo

    let call: FeedCall
    /// Whether this row's evidence is what the panel is showing. The opened row stays marked, so a
    /// panel full of output still says which line it came from.
    let isOpen: Bool
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            sentence
        }
        .buttonStyle(FeedRowButtonStyle(isOpen: isOpen))
        .disabled(call.disclosure == .none)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(call.spoken)
        .accessibilityHint(call.disclosure == .available ? "Opens what this call produced" : "")
    }

    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(call.kind.verb)
                .argoText(ArgoTypography.body)
                .foregroundStyle(verdict ?? argo.color.text.tertiary)
            FeedCallSubject(subject: call.subject, tint: verdict, isOpen: isOpen)
            repeats
            churn
            printed
            disclosure
        }
        .lineLimit(1)
    }

    /// The kind's own mark, always — a failure recolours the line rather than replacing what it
    /// says happened. The column is drawn empty where there is no mark, not skipped, so every
    /// verb in a run of calls starts on the same vertical.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoIconSize.inline.rawValue)
            .overlay {
                if let symbol = call.kind.symbol {
                    ArgoGlyph(symbol, .inline)
                }
            }
            .foregroundStyle(verdict ?? argo.color.text.disabled)
    }

    /// How many calls this line stands for, where it stands for more than one.
    @ViewBuilder private var repeats: some View {
        if call.repeats > 1 {
            Text("×\(call.repeats)")
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
        }
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
            .argoMono(.body)
            .monospacedDigit()
        }
    }

    /// How much the command printed, where that is worth saying — the stream itself is behind the
    /// chevron.
    @ViewBuilder private var printed: some View {
        if let drawn = call.printed?.drawn {
            Text(drawn)
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
        }
    }

    @ViewBuilder private var disclosure: some View {
        if call.disclosure == .available {
            ArgoGlyph(ArgoSymbol.disclosureTrailing, .inline)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    /// The ink the whole line takes, or `nil` for everything that did not fail.
    ///
    /// A failure is the ONLY outcome with a colour. For a reader who cannot see the red, the
    /// failure is carried by the accessibility label instead.
    private var verdict: ArgoColor? {
        call.ending.hasFailed ? argo.color.state.failure : nil
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

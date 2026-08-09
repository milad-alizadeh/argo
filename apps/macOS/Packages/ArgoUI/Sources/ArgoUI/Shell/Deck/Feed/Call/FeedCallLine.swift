import ArgoEngine
import SwiftUI

/// A call, drawn as one line of type with a mark on it.
///
/// One line at any window width, and one line WHATEVER happened. How it went is said in the ink of
/// the whole line and a mark after it — never in words: a feed that prints what a command said
/// stops being a feed the moment a stack trace lands in it, and "Error" is Argo talking over a
/// record that already has its own account of the failure. That account is the panel's, whole.
///
/// Every part of the sentence is set on ONE rung, interface and mono alike. It was assembled from
/// four — a 13pt verb, an 11pt qualifier, an 11.5pt command and a 10.5pt outcome — which is a line
/// that looks made out of leftovers however carefully each piece was chosen.
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
            disclosure
        }
        .lineLimit(1)
    }

    /// The kind's own mark, always — a failure recolours the line rather than replacing what it
    /// says happened. The column is drawn as an empty one where there is no mark, not skipped: a
    /// run of calls reads as one piece of work because every verb starts on the same vertical.
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

    /// How many calls this line stands for, where it stands for more than one. `×3` and not "3
    /// edits": the verb already said what they were.
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

    @ViewBuilder private var disclosure: some View {
        if call.disclosure == .available {
            ArgoGlyph(ArgoSymbol.disclosureTrailing, .inline)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    /// The ink the whole line takes, or `nil` for everything that did not fail.
    ///
    /// A failure is the ONLY outcome with a colour. A tick beside every successful call and a green
    /// line under it is a feed where the fourteen ordinary rows shout as loudly as the one that
    /// broke — success is the default a feed can assume, and marking it says nothing. What a
    /// failure says instead, for a reader who cannot see the red, is its accessibility label.
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

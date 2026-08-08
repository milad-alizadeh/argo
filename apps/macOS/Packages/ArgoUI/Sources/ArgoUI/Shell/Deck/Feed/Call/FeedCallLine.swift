import ArgoEngine
import SwiftUI

/// A call, drawn as one line of type with a mark on it.
///
/// One line at any window width, which is what the filename-only subject buys: nothing here wraps,
/// nothing is elided to fit a column, and the only thing that ever adds a second line is a failure
/// with something to say.
struct FeedCallLine: View {
    @Environment(\.argo) private var argo

    let call: FeedCall

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.stepBeforeProse) {
            sentence
            if let diagnostic = call.failure?.diagnostic {
                FeedDiagnostic(text: diagnostic)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var sentence: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            mark
            Text(call.kind.verb)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.tertiary)
            FeedCallSubject(subject: call.subject, destination: call.kind.destination)
            churn
            exitStatus
            disclosure
        }
        .lineLimit(1)
    }

    /// The mark takes the failure ink, which is the whole of how a failed call announces itself on
    /// its own line — the words stay the words, and a red verb would read as a different verb.
    /// The column is drawn as an empty one where there is no mark, not skipped: a run of calls
    /// reads as one piece of work because every verb starts on the same vertical, and an
    /// unclassified row that closed the gap up would be the only line stepping out of it.
    private var mark: some View {
        Color.clear
            .frame(width: ArgoFeedRow.callSymbolWidth, height: ArgoTypography.body.glyphSize)
            .overlay {
                if let symbol = call.kind.symbol {
                    ArgoGlyph(symbol, ArgoTypography.body)
                }
            }
            .foregroundStyle(
                call.failure == nil ? argo.color.text.disabled : argo.color.state.failure,
            )
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

    /// A successful call reduces to its one line; a failed one keeps the host's own exit line,
    /// which is the whole outcome where the command printed nothing else worth showing.
    @ViewBuilder private var exitStatus: some View {
        if let status = call.failure?.status {
            Text(status)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }

    @ViewBuilder private var disclosure: some View {
        if call.disclosure == .available {
            ArgoGlyph(indicator: ArgoSymbol.disclosure, height: ArgoLayout.disclosureHeight)
                .foregroundStyle(argo.color.text.disabled)
        }
    }
}

/// The one line a failure earns, verbatim from the record and never interpreted.
///
/// One line, hard: a feed that spills a stack trace stops being a feed, and the rest of the output
/// is behind the row's own disclosure. It sits under the words rather than under the mark, so it
/// reads as the call's second line and not as a row of its own.
private struct FeedDiagnostic: View {
    @Environment(\.argo) private var argo

    let text: String

    var body: some View {
        Text(text)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.state.failure)
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.leading, ArgoFeedRow.diagnosticIndent)
            .frame(maxWidth: ArgoFeedRow.measure, alignment: .leading)
    }
}

#Preview("Call lines — every kind the preview transcript makes") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewRows) { row in
            if case let .call(call) = row.content {
                FeedCallLine(call: call)
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

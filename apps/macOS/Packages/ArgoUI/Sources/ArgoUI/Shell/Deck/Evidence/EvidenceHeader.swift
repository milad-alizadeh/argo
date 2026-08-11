import ArgoEngine
import SwiftUI

/// What the panel is open ON: a mark for the kind of thing that happened, the verb the row said,
/// what it counted where it counted, and how it went.
///
/// No address: the panel shows one result or eight, from one file or four, so a path up here is a
/// claim true of at most one. Addresses are drawn in the body (`EvidenceStepHeader`).
struct EvidenceHeader: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    /// How the panel is reading its patches. Bound rather than owned: the control lives up here
    /// and what it changes is drawn below the separator.
    @Binding var reading: EvidenceReading
    let dismiss: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            ArgoGlyph(evidence.symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            Text(evidence.verb)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.primary)
            count
            Spacer(minLength: ArgoSpacing.snug)
            outcome
            readingToggle
            Button(action: dismiss) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(argo.color.text.tertiary)
            .accessibilityLabel("Close evidence")
        }
        .lineLimit(1)
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.base)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(spoken)
    }

    /// What a folded run counted, quieter than the verb it qualifies. A single call counts nothing
    /// and draws nothing — its addresses are in the body, one per result.
    @ViewBuilder private var count: some View {
        if let label = evidence.label {
            Text(label)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// How it went, in a word, and only where there is anything to say — success is silent, as on
    /// the row.
    @ViewBuilder private var outcome: some View {
        if let spoken = evidence.ending.spoken {
            Text(spoken)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(
                    evidence.ending.hasFailed
                        ? argo.color.state.failure
                        : argo.color.text.tertiary,
                )
        }
    }

    /// The one control, and only for the one language that has two readings. It carries the mark
    /// of where it GOES rather than of where it is.
    @ViewBuilder private var readingToggle: some View {
        if evidence.offersProse {
            Button { reading = reading == .prose ? .source : .prose } label: {
                ArgoGlyph(destination.symbol, .inline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(argo.color.text.tertiary)
            .help(destination.invitation)
            .accessibilityLabel(destination.invitation)
        }
    }

    private var destination: EvidenceReading {
        reading == .prose ? .source : .prose
    }

    private var spoken: String {
        [evidence.verb, evidence.label, evidence.ending.spoken]
            .compactMap(\.self)
            .joined(separator: " ")
    }
}

/// The header's states, side by side: a call that succeeded, a command that failed, and a folded
/// run of looking, which is the only one carrying a count.
private struct EvidenceHeaderSpecimen: View {
    @State private var reading = EvidenceReading.source

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            EvidenceHeader(evidence: edited, reading: $reading, dismiss: {})
            EvidenceHeader(evidence: ran, reading: $reading, dismiss: {})
            EvidenceHeader(evidence: looked, reading: $reading, dismiss: {})
        }
    }

    private var edited: FeedEvidence {
        FeedEvidence(
            verb: "Edited", symbol: ArgoSymbol.edited, label: nil,
            ending: .succeeded, steps: [],
        )
    }

    private var ran: FeedEvidence {
        FeedEvidence(
            verb: "Ran", symbol: ArgoSymbol.ran, label: nil, ending: .failed, steps: [],
        )
    }

    private var looked: FeedEvidence {
        FeedEvidence(
            verb: "Looked at", symbol: ArgoSymbol.looked, label: "Searched 1 · Read 5",
            ending: .succeeded, steps: [],
        )
    }
}

#Preview("Evidence header — a call, a failed command, and a folded run") {
    EvidenceHeaderSpecimen()
        .frame(width: 480)
        .background(ArgoPalette.graphite.surface.sunken)
        .argoAppearance()
}

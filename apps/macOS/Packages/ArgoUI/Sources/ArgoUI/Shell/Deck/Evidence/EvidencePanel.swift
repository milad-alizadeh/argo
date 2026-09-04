import ArgoDesign
import ArgoEngine
import SwiftUI

/// What a call produced, beside the feed that named it. It takes evidence, never a Session or a
/// selection — the deck owns which row is open.
package struct EvidencePanel: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    /// Which step the feed pointed at, if any. A position rather than a scroll offset.
    var current: Int?

    /// Which way the patches are being read. Re-seeded whenever the evidence changes.
    @State private var reading: EvidenceReading = .source

    /// The header rides INSIDE the scroll, above the results, rather than pinned over them: a
    /// pinned bar below the canopy would hide this column's content from the glass. The panel
    /// carries no close button of its own: Escape and the row that opened it both close it, and
    /// the toolbar's evidence toggle is the affordance that shows.
    package var body: some View {
        ScrollViewReader { pane in
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                    EvidenceHeader(evidence: evidence, reading: $reading)
                    DeckSeparator()
                    results
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .defaultScrollAnchor(.top)
            // Not animated: a pane scrolling two thousand points is a smear.
            .onChange(of: current, initial: true) {
                guard let current else { return }
                pane.scrollTo(current, anchor: .top)
            }
        }
        .argoScrollsUnderCanopy()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(argo.color.surface.sunken)
        .onChange(of: evidence, initial: true) { reading = evidence.opening }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Evidence")
    }

    /// Everything the row stands for, in the order it happened. A plain stack and not a lazy one:
    /// a lazy stack can only scroll to a row it has built, and the ninth file of a run is not built
    /// until something scrolls near it.
    @ViewBuilder private var results: some View {
        if evidence.steps.isEmpty {
            EvidenceAbsent()
        } else {
            VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                ForEach(evidence.steps) { step in
                    EvidenceStep(
                        step: step,
                        reading: reading,
                        hasFailed: evidence.ending.hasFailed,
                        isCurrent: step.id == current,
                    )
                    .id(step.id)
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(evidence: FeedEvidence, current: Int? = nil) {
        self.evidence = evidence
        self.current = current
    }
}

/// One result inside the panel, under the address it came from.
private struct EvidenceStep: View {
    let step: FeedEvidence.Step
    package let reading: EvidenceReading
    /// Whether the CALL failed — the only grain at which the record tells error output from
    /// ordinary output.
    let hasFailed: Bool
    /// Whether this is the result the feed pointed at.
    let isCurrent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            EvidenceStepHeader(step: step, isCurrent: isCurrent)
            shown(step.result)
        }
    }

    @ViewBuilder private func shown(_ result: ToolResult) -> some View {
        switch result {
        case let .output(output):
            EvidenceOutput(
                output: output,
                language: step.language,
                hasFailed: hasFailed,
                holdsTheFile: step.holdsTheFile,
                reading: reading,
            )
        case let .diff(diff):
            EvidenceDiff(diff: diff, language: step.language, reading: reading)
        case let .media(media): EvidenceMedia(media: media)
        }
    }
}

/// A row whose evidence went missing between the marker and the panel. Unreachable by
/// construction — a row with nothing behind it does not open — and drawn anyway.
private struct EvidenceAbsent: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing was kept of this call")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
            .padding(ArgoSpacing.comfortable)
    }
}

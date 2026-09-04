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
    /// Told the step now at the top of the view, while the reader scrolls — the other half of
    /// `current`. `nil` where nobody is listening, which is every surface but the deck's own.
    var onScroll: ((Int) -> Void)?

    /// Which way the patches are being read. Re-seeded whenever the evidence changes.
    @State private var reading: EvidenceReading = .source
    /// The last step THIS view reported through `onScroll`, so a `current` that arrives back
    /// equal to it is recognised as an echo of our own write rather than a fresh instruction —
    /// the fight `onChange(of: current)` below guards against.
    @State private var reportedTop: Int?
    /// The top of every step, keyed by its id, in the scroll's own coordinate space. Read only to
    /// pick the one nearest the visible top; the space makes each frame move with the scroll for
    /// free, with nothing to compute from an offset by hand.
    @State private var stepTops: [Int: CGFloat] = [:]
    /// On while a `scrollTo` this view asked for is still landing. The frames the preference
    /// reports during that flight are the OLD position, one layout pass behind the jump — read
    /// during it, `current` would seem to have moved back to wherever the panel scrolled from.
    @State private var isSettling = false

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
            .coordinateSpace(name: Self.scrollSpace)
            .defaultScrollAnchor(.top)
            // Not animated: a pane scrolling two thousand points is a smear.
            .onChange(of: current, initial: true) {
                guard let current else { return }
                // `current` arriving back as what WE just reported is the panel's own scroll
                // echoing home through the feed — not a fresh instruction, and scrolling to it
                // again is the fight #1355 rules out: a scroll the panel started sending the
                // panel back to the top.
                guard current != reportedTop else { return }
                reportedTop = current
                isSettling = true
                pane.scrollTo(current, anchor: .top)
                DispatchQueue.main.async { isSettling = false }
            }
            .onPreferenceChange(EvidenceStepTopKey.self) { tops in
                stepTops = tops
                guard !isSettling else { return }
                reportTop()
            }
        }
        .argoScrollsUnderCanopy()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(argo.color.surface.sunken)
        .onChange(of: evidence, initial: true) { reading = evidence.opening }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Evidence")
    }

    private static let scrollSpace = "EvidencePanel.scroll"

    /// Whichever step sits at the top of the visible area right now, told upward — but only where
    /// there is more than one step to distinguish, and only when it actually changed: every layout
    /// pass touches every step's frame, and a report on each one would fight `current` on its own
    /// echo before `reportedTop` ever settles.
    private func reportTop() {
        guard evidence.steps.count > 1, let onScroll, let top = topStep() else { return }
        guard top != reportedTop else { return }
        reportedTop = top
        onScroll(top)
    }

    /// The step whose top has scrolled furthest past the visible top without leaving it — the
    /// last one at or above zero in the scroll's own space. Before anything has scrolled, none
    /// qualifies, and the first step stands in: it IS what is at the top.
    private func topStep() -> Int? {
        let sorted = stepTops.sorted { $0.key < $1.key }
        guard let first = sorted.first else { return nil }
        return (sorted.last { $0.value <= 0 } ?? first).key
    }

    /// Everything the row stands for, in the order it happened. A plain stack and not a lazy one:
    /// a lazy stack can only scroll to a row it has built, and the ninth file of a run is not built
    /// until something scrolls near it.
    ///
    /// A `DeckSeparator` between each pair of steps and none at either end: the gap alone reads as
    /// one long stream once the results are unequal lengths, and a single-step panel has no other
    /// result to mark the boundary of.
    @ViewBuilder private var results: some View {
        if evidence.steps.isEmpty {
            EvidenceAbsent()
        } else {
            VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                ForEach(Array(evidence.steps.enumerated()), id: \.element.id) { position, step in
                    if position > 0 {
                        DeckSeparator()
                    }
                    EvidenceStep(
                        step: step,
                        reading: reading,
                        hasFailed: evidence.ending.hasFailed,
                        isCurrent: step.id == current,
                    )
                    .id(step.id)
                    .background {
                        GeometryReader { proxy in
                            Color.clear.preference(
                                key: EvidenceStepTopKey.self,
                                value: [step.id: proxy.frame(in: .named(Self.scrollSpace)).minY],
                            )
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(evidence: FeedEvidence, current: Int? = nil, onScroll: ((Int) -> Void)? = nil) {
        self.evidence = evidence
        self.current = current
        self.onScroll = onScroll
    }
}

/// Where one step's top sits in the panel's own scroll space, keyed by its id — read to find
/// whichever step the reader has scrolled to the top of the view.
private struct EvidenceStepTopKey: PreferenceKey {
    static let defaultValue: [Int: CGFloat] = [:]

    static func reduce(value: inout [Int: CGFloat], nextValue: () -> [Int: CGFloat]) {
        value.merge(nextValue()) { _, next in next }
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

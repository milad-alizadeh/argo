import ArgoEngine
import SwiftUI

/// What a call produced, beside the feed that named it.
///
/// It takes the evidence and the words that addressed it, never a Session or a selection — the
/// deck owns which row is open, and this draws whatever it is handed. A list of results, each under
/// the address it came from: four reads open as four files down one pane, and the names listed
/// under
/// the row in the feed scroll the pane to whichever one was clicked.
struct EvidencePanel: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    /// Which step the feed pointed at, if any. A position rather than a scroll offset: the feed
    /// says WHICH result it means, and where that lands is the pane's own business.
    var current: Int?
    let dismiss: () -> Void

    /// Which way the patches are being read. Owned here rather than by the row, because it is a
    /// property of looking at this thing and not of the thing: opening a different row asks the
    /// question again, which is why it is re-seeded whenever the evidence changes.
    @State private var reading: EvidenceReading = .source

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            EvidenceHeader(evidence: evidence, reading: $reading, dismiss: dismiss)
            DeckSeparator()
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(argo.color.surface.sunken)
        .onChange(of: evidence, initial: true) { reading = evidence.opening }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Evidence")
    }

    /// Everything the row stands for, in the order it happened — a collapsed run of three edits is
    /// three patches down one pane, each one what that ONE call changed.
    ///
    /// The scrolling lives here and not in the arms below, so a run reads as one scrollable column
    /// rather than as three little windows. Content shorter than the pane sits at the TOP of it: a
    /// scroll view centres what it does not have to scroll, which put a four-line build failure in
    /// the middle of an empty pane, reading as a caption rather than as the start of a stream.
    ///
    /// Vertical only. A panel that scrolls sideways hides the end of every long line behind a
    /// gesture, and the reader has no way to know a line HAS an end they have not seen — a wrapped
    /// line is longer to read and complete to look at. The panel is a column of a resizable deck,
    /// so the width to wrap to is one the reader already set.
    @ViewBuilder private var content: some View {
        if evidence.steps.isEmpty {
            EvidenceAbsent()
        } else {
            ScrollViewReader { pane in
                results
                    // The click lands in the feed and the answer happens here, so the jump is not
                    // animated: a pane scrolling two thousand points is a smear, and what the
                    // reader asked for was to be somewhere else.
                    .onChange(of: current, initial: true) {
                        guard let current else { return }
                        pane.scrollTo(current, anchor: .top)
                    }
            }
        }
    }

    /// A plain stack and not a lazy one, deliberately. What the accordion asks for is a jump to the
    /// nth result, and a lazy stack can only scroll to a row it has built — the ninth file of a run
    /// is not built until something scrolls near it, which is the thing being asked for.
    private var results: some View {
        ScrollView(.vertical) {
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
        .defaultScrollAnchor(.top)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// One result inside the panel, under the address it came from.
private struct EvidenceStep: View {
    let step: FeedEvidence.Step
    let reading: EvidenceReading
    /// Whether the CALL failed — a fact about the outcome, which is the only grain at which the
    /// record tells error output apart from ordinary output.
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
            EvidenceOutput(output: output, language: step.language, hasFailed: hasFailed)
        case let .diff(diff):
            EvidenceDiff(diff: diff, language: step.language, reading: reading)
        case let .media(media): EvidenceMedia(media: media)
        }
    }
}

/// A row whose evidence went missing between the marker and the panel. Unreachable by
/// construction — a row with nothing behind it does not open — and drawn anyway, because the
/// alternative to an unreachable branch that says so is a blank panel that says nothing.
private struct EvidenceAbsent: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text("Nothing was kept of this call")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
            .padding(ArgoSpacing.comfortable)
    }
}

#Preview("Evidence — a failed command's whole output") {
    EvidenceFixture.failed.map { EvidencePanel(evidence: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — the patch one edit made") {
    EvidenceFixture.edited.map { EvidencePanel(evidence: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — everything a folded run of looking read") {
    EvidenceFixture.surveyed.map { EvidencePanel(evidence: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — a folded run, scrolled to the file the feed pointed at") {
    EvidenceFixture.surveyed.map { EvidencePanel(evidence: $0, current: 2, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

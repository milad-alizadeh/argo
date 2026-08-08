import ArgoEngine
import SwiftUI

/// What one call produced, beside the feed that named it.
///
/// It takes the evidence and the words that addressed it, never a Session or a selection — the
/// deck owns which row is open, and this draws whatever it is handed. The full path lives here and
/// only here: the feed shows a filename, and this is where the address it stood for is readable.
struct EvidencePanel: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            EvidenceHeader(evidence: evidence, dismiss: dismiss)
            DeckSeparator()
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(argo.color.surface.sunken)
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
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                    ForEach(Array(evidence.steps.enumerated()), id: \.offset) { position, step in
                        EvidenceStep(
                            step: step,
                            language: step.language ?? evidence.language,
                            position: position,
                            count: evidence.steps.count,
                        )
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .defaultScrollAnchor(.top)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// One result inside the panel, numbered where there is more than one of it.
///
/// The number is what keeps a collapsed run honest: three patches with nothing between them read as
/// one long diff, and the whole reason the row collapsed is that they were three separate moments.
/// A folded run of looking adds the file each step came from, because its own line no longer says.
private struct EvidenceStep: View {
    @Environment(\.argo) private var argo

    let step: FeedEvidence.Step
    let language: EvidenceLanguage?
    let position: Int
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            caption
            shown(step.result)
        }
    }

    /// The step's own header, where it needs one: which of the run this is, and — inside a folded
    /// run of looking, where the panel's own header carries a count instead — the file it came
    /// from, under its own mark and cut from the front exactly as the panel's header is.
    @ViewBuilder private var caption: some View {
        if count > 1 || step.address != nil {
            HStack(spacing: ArgoSpacing.snug) {
                if count > 1 {
                    Text("\(position + 1) of \(count)")
                        .monospacedDigit()
                }
                if let address = step.address {
                    ArgoGlyph(language?.symbol ?? ArgoSymbol.plainSource, .inline)
                    Text(address)
                        .lineLimit(1)
                        .truncationMode(.head)
                        .help(address)
                }
            }
            .argoText(ArgoTypography.sectionLabel)
            .foregroundStyle(argo.color.text.tertiary)
            .padding(.horizontal, ArgoSpacing.comfortable)
        }
    }

    @ViewBuilder private func shown(_ result: ToolResult) -> some View {
        switch result {
        case let .output(output): EvidenceOutput(output: output)
        case let .diff(diff): EvidenceDiff(diff: diff, language: language)
        case let .media(media): EvidenceMedia(media: media)
        }
    }
}

/// What the panel is open ON: a mark for what kind of thing it was, the address the feed was
/// standing in for, and — for a subject that is not a file — the verb and how it went.
private struct EvidenceHeader: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(evidence.symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            if evidence.saysVerb {
                Text(evidence.verb)
                    .argoText(ArgoTypography.body)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            address
            Spacer(minLength: ArgoSpacing.snug)
            outcome
            Button(action: dismiss) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(argo.color.text.tertiary)
            .accessibilityLabel("Close evidence")
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.base)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(spoken)
    }

    /// The path from the cwd forward, on ONE line, cut from the FRONT where it does not fit. A path
    /// is identified by its right-hand end, so those are the characters to keep; wrapping it
    /// instead pushed the close control down and grew the header with the depth of whatever
    /// happened to be open.
    private var address: some View {
        Text(evidence.address)
            .argoMono(.body)
            .foregroundStyle(argo.color.text.primary)
            .textSelection(.enabled)
            .lineLimit(1)
            .truncationMode(.head)
            .help(evidence.address)
    }

    /// How it went, in a word, and only where there is anything to say. Success is silent here for
    /// the same reason it is silent on the row: the panel below is the outcome, at length, and
    /// `succeeded` over a stream of output the reader is already looking at says nothing twice.
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

    /// The verb is spoken even where it is not drawn: a mark says "Swift file" to somebody looking
    /// at it and nothing at all to somebody listening.
    private var spoken: String {
        [evidence.verb, evidence.address, evidence.ending.spoken]
            .compactMap(\.self)
            .joined(separator: " ")
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

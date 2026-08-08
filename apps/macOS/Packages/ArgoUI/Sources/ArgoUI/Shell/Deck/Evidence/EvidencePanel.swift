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
    @ViewBuilder private var content: some View {
        if evidence.steps.isEmpty {
            EvidenceAbsent()
        } else {
            // Vertical only. A panel that scrolls sideways hides the end of every long line
            // behind a gesture, and the reader has no way to know a line HAS an end they have not
            // seen — a wrapped line is longer to read and complete to look at. The panel is a
            // column of a resizable deck, so the width to wrap to is one the reader already set.
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                    ForEach(Array(evidence.steps.enumerated()), id: \.offset) { position, step in
                        EvidenceStep(
                            step: step,
                            language: evidence.language,
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
            if let caption {
                Text(caption)
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
                    .padding(.horizontal, ArgoSpacing.comfortable)
            }
            shown(step.result)
        }
    }

    private var caption: String? {
        let counted = count > 1 ? "\(position + 1) of \(count)" : nil
        let parts = [counted, step.caption].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    @ViewBuilder private func shown(_ result: ToolResult) -> some View {
        switch result {
        case let .output(output): EvidenceOutput(output: output)
        case let .diff(diff): EvidenceDiff(diff: diff, language: language)
        case let .media(media): EvidenceMedia(media: media)
        }
    }
}

/// What the panel is open ON: the file's own mark, and the address the feed was standing in for.
private struct EvidenceHeader: View {
    @Environment(\.argo) private var argo

    let evidence: FeedEvidence
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            // The file's own mark instead of the verb the row already said. A header that opened
            // with `EDITED` spent its first line restating the line that was clicked; the mark
            // says the one thing the row could not — what kind of file this is.
            ArgoGlyph(evidence.symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            // The path from the cwd forward, on ONE line, cut from the FRONT where it does not
            // fit. A path is identified by its right-hand end, so those are the characters to
            // keep; wrapping it instead pushed the close control down and grew the header with
            // the depth of whatever happened to be open.
            Text(evidence.address)
                .argoMono(.body)
                .foregroundStyle(argo.color.text.primary)
                .textSelection(.enabled)
                .lineLimit(1)
                .truncationMode(.head)
                .help(evidence.address)
            Spacer(minLength: ArgoSpacing.snug)
            Button(action: dismiss) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
            }
            .buttonStyle(.plain)
            .foregroundStyle(argo.color.text.tertiary)
            .accessibilityLabel("Close evidence")
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.base)
        // The verb is spoken even though it is no longer drawn: a mark says "Swift file" to
        // somebody looking at it and nothing at all to somebody listening.
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(evidence.verb) \(evidence.address)")
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

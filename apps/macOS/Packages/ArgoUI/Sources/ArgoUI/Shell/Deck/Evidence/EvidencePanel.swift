import ArgoEngine
import SwiftUI

/// What one call produced, beside the feed that named it.
///
/// It takes the evidence and the words that addressed it, never a Session or a selection — the
/// deck owns which row is open, and this draws whatever it is handed. The full path lives here and
/// only here: the feed shows a filename, and this is where the address it stood for is readable.
struct EvidencePanel: View {
    @Environment(\.argo) private var argo

    let call: FeedCall
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            EvidenceHeader(call: call, dismiss: dismiss)
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
        if call.evidence.isEmpty {
            EvidenceAbsent()
        } else {
            ScrollView([.vertical, .horizontal]) {
                VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                    ForEach(Array(call.evidence.enumerated()), id: \.offset) { position, result in
                        EvidenceStep(
                            result: result,
                            position: position,
                            count: call.evidence.count,
                        )
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .defaultScrollAnchor(.topLeading)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// One result inside the panel, numbered where there is more than one of it.
///
/// The number is what keeps a collapsed run honest: three patches with nothing between them read as
/// one long diff, and the whole reason the row collapsed is that they were three separate moments.
private struct EvidenceStep: View {
    @Environment(\.argo) private var argo

    let result: ToolResult
    let position: Int
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            if count > 1 {
                Text("\(position + 1) of \(count)")
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
                    .padding(.horizontal, ArgoSpacing.comfortable)
            }
            shown(result)
        }
    }

    @ViewBuilder private func shown(_ result: ToolResult) -> some View {
        switch result {
        case let .output(output): EvidenceOutput(output: output)
        case let .diff(diff): EvidenceDiff(diff: diff)
        case let .media(media): EvidenceMedia(media: media)
        }
    }
}

/// What the panel is open ON: the call's own sentence, and under it the address the feed was
/// standing in for.
private struct EvidenceHeader: View {
    @Environment(\.argo) private var argo

    let call: FeedCall
    let dismiss: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(call.kind.verb)
                    .argoText(ArgoTypography.sectionLabel)
                    .textCase(.uppercase)
                    .foregroundStyle(argo.color.text.tertiary)
                Text(address)
                    .argoMono(.body)
                    .foregroundStyle(argo.color.text.primary)
                    .textSelection(.enabled)
                    .lineLimit(2)
                    .truncationMode(.head)
            }
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
    }

    /// The whole path for a file, because this is the surface the feed defers it to. Everything
    /// else is already whole on the row — a command, a pattern, a tool's name — and is repeated
    /// here so the panel says what it is open on without the feed beside it.
    private var address: String {
        switch call.subject {
        case let .file(file): file.path
        case let .command(command): command
        case let .plain(text): text
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
    EvidenceFixture.failed.map { EvidencePanel(call: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — the patch one edit made") {
    EvidenceFixture.edited.map { EvidencePanel(call: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

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

    /// One arm per kind of result, and an honest absence for the row that has none. A panel open
    /// on nothing is a promise the disclosure marker made and this could not keep — it cannot
    /// happen, because a row with no evidence does not open, and it says so rather than showing a
    /// blank if it ever does.
    @ViewBuilder private var content: some View {
        switch call.evidence {
        case let .output(output): EvidenceOutput(output: output)
        case let .diff(diff): EvidenceDiff(diff: diff)
        case let .media(media): EvidenceMedia(media: media)
        case nil: EvidenceAbsent()
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
                    .argoText(ArgoTypography.machine)
                    .foregroundStyle(argo.color.text.primary)
                    .textSelection(.enabled)
                    .lineLimit(2)
                    .truncationMode(.head)
            }
            Spacer(minLength: ArgoSpacing.snug)
            Button(action: dismiss) {
                ArgoGlyph(ArgoSymbol.dismiss, ArgoTypography.control)
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

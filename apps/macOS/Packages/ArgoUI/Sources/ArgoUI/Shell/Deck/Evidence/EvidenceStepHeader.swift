import AppKit
import SwiftUI

/// The address one result came from, over the result itself. Every step has one, including the only
/// step of a single call.
struct EvidenceStepHeader: View {
    @Environment(\.argo) private var argo

    let step: FeedEvidence.Step
    /// Whether this is the step the reader asked for from the feed.
    var isCurrent = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            ArgoGlyph(symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            address
            external
            churn
            printed
            Spacer(minLength: ArgoSpacing.snug)
            EvidenceCopyButton(text: step.address.text)
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.tight)
        .background(isCurrent ? argo.color.surface.selected : .transparent)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
    }

    /// Read off the ADDRESS and never the characters: a command's own words end in `.sh` often
    /// enough that asking for a language here would set a shell invocation as a shell script.
    private var symbol: String {
        if let language = step.language {
            return language.symbol
        }
        switch step.address {
        case .typed: return ArgoSymbol.ran
        case .filed, .named: return ArgoSymbol.plainSource
        }
    }

    /// A path is cut from the FRONT — its right-hand end identifies it; a command is cut in the
    /// middle by the shared rule, so the verb at the front and the file at the end both survive.
    @ViewBuilder private var address: some View {
        switch step.address {
        case .filed:
            HStack(spacing: ArgoSpacing.flush) {
                Text(step.address.parted.parent)
                    .foregroundStyle(argo.color.text.tertiary)
                Text(step.address.parted.name)
                    .foregroundStyle(argo.color.text.primary)
            }
            .argoMono(.body)
            .lineLimit(1)
            .truncationMode(.head)
            .textSelection(.enabled)
            .help(step.address.text)
        case .named, .typed:
            Text(step.address.drawn)
                .argoMono(.body)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(EvidenceAddress.commandLines)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
                .help(step.address.text)
        }
    }

    /// A file the Session is not working in: without this mark the path reads as relative to here.
    @ViewBuilder private var external: some View {
        if step.isExternal {
            ArgoGlyph(ArgoSymbol.externalFile, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .help("Outside this Session's working tree")
        }
    }

    /// What this ONE result changed, in lines — the panel's own count and not the row's.
    @ViewBuilder private var churn: some View {
        if let churn = step.churn {
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

    /// How much this ONE command printed — a reader landing mid-pane cannot see where the stream
    /// they are inside ends.
    @ViewBuilder private var printed: some View {
        if let drawn = step.printed?.drawn {
            Text(drawn)
                .argoMono(.body)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
        }
    }

    private var spoken: String {
        [
            step.address.text,
            step.isExternal ? "outside the working tree" : nil,
            step.churn.map { "\($0.added) added, \($0.removed) removed" },
            step.printed?.drawn,
        ]
        .compactMap(\.self)
        .joined(separator: ", ")
    }
}

/// Take this address to the pasteboard. It copies what the header SAYS — the path relative to the
/// Session's cwd, which is what pastes back into that Session's terminal.
private struct EvidenceCopyButton: View {
    @Environment(\.argo) private var argo

    let text: String
    /// Whether the copy just happened. It reverts on its own.
    @State private var hasCopied = false

    var body: some View {
        Button(action: copy) {
            ArgoGlyph(hasCopied ? ArgoSymbol.chosen : ArgoSymbol.copyAddress, .inline)
        }
        .buttonStyle(.plain)
        .foregroundStyle(hasCopied ? argo.color.interaction.accent : argo.color.text.tertiary)
        .help("Copy path")
        .accessibilityLabel("Copy path")
    }

    private func copy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        hasCopied = true
        Task {
            try? await Task.sleep(for: .seconds(Self.acknowledgement))
            hasCopied = false
        }
    }

    /// Seconds the tick stands before the control goes back to offering the copy.
    private static let acknowledgement = 1.5
}

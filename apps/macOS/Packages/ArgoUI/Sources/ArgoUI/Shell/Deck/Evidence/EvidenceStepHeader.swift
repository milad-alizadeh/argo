import AppKit
import SwiftUI

/// The address one result came from, over the result itself.
///
/// Every step has one, including the only step of a single call — which is what makes the panel a
/// LIST of things that happened rather than one thing with a title. Four reads open as four files
/// down one pane, each under its own name, and the reader scrolls between them the way they scroll
/// a diff review.
///
/// The path is drawn in two inks. The parent is context — the same eleven folders on every row of a
/// monorepo — and the filename is the answer, so the eye lands on the end of the path rather than
/// reading its way there. That split is also why a file address is its own case: cutting a command
/// this way would take its verb.
struct EvidenceStepHeader: View {
    @Environment(\.argo) private var argo

    let step: FeedEvidence.Step
    /// Whether this is the step the reader asked for from the feed. The mark is faint and on the
    /// header rather than over the result: it answers "did my click land here", once, and then
    /// stops competing with what it pointed at.
    var isCurrent = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            ArgoGlyph(symbol, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            address
            external
            churn
            Spacer(minLength: ArgoSpacing.snug)
            EvidenceCopyButton(text: step.address.text)
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.tight)
        .background(isCurrent ? argo.color.surface.selected : .transparent)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
    }

    /// The language's mark for a file whose extension Argo knows, the terminal for a command, and
    /// the plain document for everything else — a pattern, a URL, a file Argo cannot place. Read
    /// off the ADDRESS and never the characters: a command's own words end in `.sh` often enough
    /// that asking for a language here would set a shell invocation as a shell script.
    private var symbol: String {
        if let language = step.language {
            return language.symbol
        }
        switch step.address {
        case .typed: return ArgoSymbol.ran
        case .filed, .named: return ArgoSymbol.plainSource
        }
    }

    /// A path on one line, cut from the FRONT where it does not fit — its right-hand end is what
    /// identifies it. A command keeps its beginning instead and is cut in the middle by the shared
    /// rule, so the verb at the front and the file at the end both survive.
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

    /// A file the Session is not working in, marked rather than described. The path beside it is
    /// relative to somewhere else, and without this the header would quietly read as if it were
    /// relative to here.
    @ViewBuilder private var external: some View {
        if step.isExternal {
            ArgoGlyph(ArgoSymbol.externalFile, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .help("Outside this Session's working tree")
        }
    }

    /// What this ONE result changed, in lines. The panel's own count and not the row's: a run of
    /// three edits shows what each of them did, which is the whole reason the three were kept
    /// apart.
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

    private var spoken: String {
        [
            step.address.text,
            step.isExternal ? "outside the working tree" : nil,
            step.churn.map { "\($0.added) added, \($0.removed) removed" },
        ]
        .compactMap(\.self)
        .joined(separator: ", ")
    }
}

/// Take this address to the pasteboard.
///
/// Beside every address rather than once at the top, because there is no single address in a panel
/// that shows four files — the control has to sit where the thing it copies is. It copies what the
/// header SAYS, which is the path relative to the Session's cwd: that is the address the reader can
/// paste back into the same Session's terminal, and the absolute one is about this machine.
private struct EvidenceCopyButton: View {
    @Environment(\.argo) private var argo

    let text: String
    /// Whether the copy just happened. It reverts on its own — a control that stays ticked is a
    /// control that has stopped saying anything about the press after it.
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

    /// How long the tick stands before the control goes back to offering the copy. Long enough to
    /// be seen after the press that caused it, short enough that a reader coming back to the pane
    /// is not told about a copy they made a minute ago.
    private static let acknowledgement = 1.5
}

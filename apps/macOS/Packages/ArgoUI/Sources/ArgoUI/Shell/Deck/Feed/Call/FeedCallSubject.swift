import SwiftUI

/// What a call named, drawn as the shortest thing that still identifies it.
///
/// A path never appears here. The filename is the whole address, with a parent in front of it only
/// where another file in the same feed answers to the same name — which is what keeps a call one
/// line at any window width, and what leaves the full path to the evidence panel.
struct FeedCallSubject: View {
    @Environment(\.argo) private var argo

    let subject: FeedCall.Subject
    /// The ink the whole line is taking, where it has claimed one — a command that passed, a call
    /// that failed. The line owns that claim, so the subject is told it rather than deciding it.
    var tint: ArgoColor?
    /// Whether this row's evidence is the panel's content. The subject is what carries it, because
    /// the subject is what the panel is showing.
    var isOpen = false

    var body: some View {
        switch subject {
        case let .file(file): named(file)
        case let .command(command): typed(command)
        case let .plain(text): plain(text)
        // Prose, drawn as prose. The command it stands in for is the panel's, and setting a
        // sentence in a mono chip would say the agent's words were something to be run.
        case let .narration(text, _): plain(text)
        }
    }

    /// The filename, and nothing after it.
    ///
    /// No parent folder trailing the name, and no destination trailing a move. Both put a word
    /// after every such filename that the reader has to discard — a name followed by `Shell` reads
    /// as two things until you know it is one, and `→ VisualCont…` is a second cut address on the
    /// one row that already had one. What a reader who needs them goes to is the panel: it opens on
    /// the whole path, and a move's patch says where the file landed.
    private func named(_ file: FeedCall.FileName) -> some View {
        Text(file.name)
            .argoText(subject.style)
            .foregroundStyle(ink)
    }

    /// A command takes a ground of its own as well as the machine face — it is the one subject a
    /// reader might retype, and the chip is what says where it starts and ends.
    private func typed(_ command: String) -> some View {
        Text(FeedCommandLine.head(of: command))
            .argoText(subject.style)
            .foregroundStyle(ink)
            .padding(.horizontal, ArgoSpacing.tight)
            .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.marker))
    }

    private func plain(_ text: String) -> some View {
        Text(text)
            .argoText(subject.style)
            .foregroundStyle(ink)
    }

    /// A verdict outranks the selection, which outranks the ordinary reading: a failed row stays
    /// red while it is open, because that is the more important of the two things it is saying.
    private var ink: ArgoColor {
        tint ?? (isOpen ? argo.color.interaction.accentBright : argo.color.text.secondary)
    }
}

extension FeedCall.Subject {
    /// Which of the two faces the subject sets in — the one rule about a call line a hurried view
    /// is most likely to break, so it is a value the contract can hold rather than a modifier three
    /// branches spell for themselves.
    ///
    /// The mono is for the one subject a reader might retype. Everything else is the interface
    /// sans, a narration emphatically included: it is a sentence somebody wrote, and prose set in
    /// machine type reads as something to run.
    var style: ArgoTextStyle {
        switch self {
        // On the same rung as the words around it: the face already tells them apart, and a second
        // size was the line's own type scale disagreeing with itself.
        case .command: ArgoTextStyle(typeface: .machine, rung: ArgoTypography.body.rung)
        case .file, .plain, .narration: ArgoTypography.body
        }
    }
}

// Every shape a subject takes — a filename, a sentence the agent wrote, a command on its own
// ground, a plain address. Taken from the shipping projection rather than written here, so no
// preview can show a shape the shared rule would never produce.
#Preview("Call subject — every shape a call can name") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallSubject(subject: call.subject)
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 520)
    .argoDeckSurface()
    .argoAppearance()
}

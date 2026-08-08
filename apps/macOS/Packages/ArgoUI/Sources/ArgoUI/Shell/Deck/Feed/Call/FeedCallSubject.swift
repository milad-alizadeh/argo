import SwiftUI

/// What a call named, drawn as the shortest thing that still identifies it.
///
/// A path never appears here. The filename is the whole address, with a parent in front of it only
/// where another file in the same feed answers to the same name — which is what keeps a call one
/// line at any window width, and what leaves the full path to the evidence panel.
struct FeedCallSubject: View {
    @Environment(\.argo) private var argo

    let subject: FeedCall.Subject
    /// Where a moved file went. A qualifier rather than a second sentence: the verb already said
    /// what happened, and this says where to.
    var destination: String?
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
        }
    }

    /// The filename, and after it only where the file WENT.
    ///
    /// No parent folder trailing the name. It was there to tell two same-named files apart, and it
    /// paid for that by putting a word after every filename in the feed that the reader has to
    /// discard — a name followed by `Shell` reads as two things until you know it is one. The
    /// disambiguation lives where a reader who needs it goes: the panel opens on the whole path,
    /// and a folded run lists its files as paths.
    private func named(_ file: FeedCall.FileName) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            Text(file.name)
                .argoText(ArgoTypography.body)
                .foregroundStyle(ink)
            quiet(destination.map { "→ \($0)" })
        }
    }

    /// A command reads as machine text on a ground of its own, because it is the one subject a
    /// reader might retype. On the same rung as the words around it: the mono face already tells
    /// them apart, and a second size was the line's own type scale disagreeing with itself.
    private func typed(_ command: String) -> some View {
        Text(FeedCommandLine.head(of: command))
            .argoMono(.body)
            .foregroundStyle(ink)
            .padding(.horizontal, ArgoSpacing.tight)
            .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.marker))
    }

    private func plain(_ text: String) -> some View {
        Text(text)
            .argoText(ArgoTypography.body)
            .foregroundStyle(ink)
    }

    /// A verdict outranks the selection, which outranks the ordinary reading: a failed row stays
    /// red while it is open, because that is the more important of the two things it is saying.
    private var ink: ArgoColor {
        tint ?? (isOpen ? argo.color.interaction.accentBright : argo.color.text.secondary)
    }

    /// A qualifier is quieter in INK and not in size — it is there to disambiguate rather than to
    /// be read, and shrinking it was how the line ended up with three sizes on it.
    @ViewBuilder private func quiet(_ text: String?) -> some View {
        if let text {
            Text(text)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.disabled)
        }
    }
}

// Every shape a subject takes — a name that stands alone, the two the feed had to qualify, a move's
// destination, a command on its own ground, a plain address. Taken from the shipping projection
// rather than written here, so no preview can show a qualifier the shared rule would never produce.
#Preview("Call subject — every shape a call can name") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallSubject(subject: call.subject, destination: call.kind.destination)
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 520)
    .argoDeckSurface()
    .argoAppearance()
}

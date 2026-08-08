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
    let destination: String?

    var body: some View {
        switch subject {
        case let .file(file): named(file)
        case let .command(command): typed(command)
        case let .plain(text): plain(text)
        }
    }

    private func named(_ file: FeedCall.FileName) -> some View {
        HStack(spacing: ArgoSpacing.tight) {
            Text(file.name)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
            quiet(file.qualifier)
            quiet(destination.map { "→ \($0)" })
        }
    }

    /// A command reads as machine text on a ground of its own, because it is the one subject a
    /// reader might retype.
    private func typed(_ command: String) -> some View {
        Text(command)
            .argoText(ArgoTypography.machine)
            .foregroundStyle(argo.color.text.secondary)
            .padding(.horizontal, ArgoSpacing.tight)
            .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.marker))
    }

    private func plain(_ text: String) -> some View {
        Text(text)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.secondary)
    }

    @ViewBuilder private func quiet(_ text: String?) -> some View {
        if let text {
            Text(text)
                .argoText(ArgoTypography.caption)
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

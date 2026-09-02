import ArgoDesign
import SwiftUI

/// What a call named, drawn as the shortest thing that still identifies it.
///
/// A path never appears here. The filename is the whole address, with a parent in front of it only
/// where another file in the same feed answers to the same name — which is what keeps a call one
/// line at any window width, and what leaves the full path to the evidence panel.
struct FeedCallSubject: View {
    @Environment(\.argo) private var argo
    /// Whether this drawing is the ion's mask rather than the row — see `isIonMask`.
    @Environment(\.isIonMask) private var isIonMask

    let subject: FeedCall.Subject
    /// The ink the whole line has claimed, where it has. The line owns that claim, so the subject
    /// is told it rather than deciding it.
    var tint: ArgoColor?
    /// Whether this row's evidence is the panel's content.
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

    /// The filename, and nothing after it: no trailing parent folder, and no destination trailing
    /// a move. The panel is where a reader gets the whole path and where a move's patch landed.
    private func named(_ file: FeedCall.FileName) -> some View {
        Text(file.name)
            .argoText(subject.style)
            .foregroundStyle(ink)
    }

    /// A command takes a ground of its own as well as the machine face — it is the one subject a
    /// reader might retype, and the chip is what says where it starts and ends.
    ///
    /// The ground is the one part of the row an ion mask must not see, or the pass lights the whole
    /// chip instead of the command on it.
    private func typed(_ command: String) -> some View {
        Text(FeedCommandLine.head(of: command))
            .argoText(subject.style)
            .foregroundStyle(ink)
            .padding(.horizontal, ArgoSpacing.tight)
            .background(
                isIonMask ? ArgoColor.transparent : argo.color.surface.raised,
                in: .rect(cornerRadius: ArgoRadius.marker),
            )
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
    /// Which of the two faces the subject sets in. Mono is for the one subject a reader might
    /// retype; everything else is the interface sans, a narration included.
    var style: ArgoTextStyle {
        switch self {
        // On the same rung as the words around it: the face already tells them apart.
        case .command: ArgoTextStyle(typeface: .machine, rung: ArgoTypography.body.rung)
        case .file, .plain, .narration: ArgoTypography.body
        }
    }
}

// Taken from the shipping projection rather than written here, so no preview can show a shape the
// shared rule would never produce.
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

import ArgoDesign
import SwiftUI

/// The room's nothings, told apart. ONE view for all of them, for `TicketsRoomVacancy`'s reason:
/// the contrast between the sentences is the thing being built.
///
/// The three readings are three different instructions — no Project to measure, nothing measured
/// yet and what would fix it, and a measurement that could not be read so the Project is not at
/// fault (#1140, stories 3 and 4).
struct AtlasRoomVacancy: View {
    @Environment(\.argo) private var argo

    let reading: AtlasReading
    /// The Project the room is scoped to, named in the sentence. Absent where the window has no
    /// active Project, and the sentence drops the clause rather than saying "this Project".
    let project: String?
    let rebuild: () -> Void

    var body: some View {
        ContentUnavailableView {
            Text(title)
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
                .frame(maxWidth: ArgoTicketsRoomVacancy.panelWidth)
        } description: {
            Text(message)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoTicketsRoomVacancy.panelWidth)
        } actions: {
            if project != nil, reading != .measuring {
                AtlasRebuildButton(title: "Generate atlas", rebuild: rebuild)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Titles are noun phrases in sentence case, and each names the ONE thing that is true: which
    /// of the four the reader is looking at has to be readable before the sentence under it is.
    private var title: String {
        switch reading {
        case .noProject: "No Project open"
        case .unmeasured: project.map { "No atlas for \($0) yet" } ?? "No atlas yet"
        case .measuring: project.map { "Generating the atlas for \($0)…" } ?? "Generating…"
        case .unreadable: "This atlas could not be read"
        case .measured: ""
        }
    }

    /// The page with no atlas on it says WHAT AN ATLAS IS, because it is the one page a person who
    /// has never opened this room will read. Every other room draws a thing its reader already has
    /// a word for; a map of a repository is not, and a page that only offered to generate one
    /// would be an instruction with no subject.
    ///
    /// The rest are one sentence of what is true and one of what to do. Two carry a clause that
    /// cannot be cut for brevity, because it IS the reading: a repository with no atlas is not an
    /// empty one, and a file that will not open is not a Project at fault (#1140, stories 3 and 4).
    private var message: String {
        switch reading {
        case .noProject:
            "An atlas maps the Project this window is on. Open one from the Project menu."
        case .unmeasured:
            """
            An atlas draws every file in this repository as a tile, sized and coloured by what \
            Argo can measure about it. Generating walks the working tree once and keeps what it \
            found.
            """
        case .measuring:
            "Reading every tracked file, its size and its history. Nothing in your files changes."
        case .unreadable:
            """
            An older version of Argo may have written it. Your Project is fine. Generate the \
            atlas again to replace the file.
            """
        case .measured:
            ""
        }
    }
}

/// The room's one lever, in the shape every accent-filled control in this app takes.
struct AtlasRebuildButton: View {
    @Environment(\.argo) private var argo

    let title: String
    let rebuild: () -> Void

    var body: some View {
        Button(action: rebuild) {
            Text(title)
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.onAccent)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.vertical, ArgoSpacing.snug)
                .background(
                    argo.color.interaction.accent,
                    in: RoundedRectangle(cornerRadius: ArgoRadius.control),
                )
        }
        .buttonStyle(.plain)
    }
}

#Preview("Atlas room, the three nothings") {
    HStack(spacing: ArgoSpacing.flush) {
        AtlasRoomVacancy(reading: .noProject, project: nil, rebuild: {})
        AtlasRoomVacancy(reading: .unmeasured, project: "argo", rebuild: {})
        AtlasRoomVacancy(reading: .unreadable, project: "argo", rebuild: {})
    }
    .frame(width: 1440, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Atlas room, generating") {
    AtlasRoomVacancy(reading: .measuring, project: "argo", rebuild: {})
        .frame(width: 540, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}

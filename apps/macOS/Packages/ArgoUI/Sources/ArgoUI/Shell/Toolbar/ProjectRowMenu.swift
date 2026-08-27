import SwiftUI

/// A Project's management verbs. Rename is absent because a Project's name IS its folder's, and
/// `Locate…` because Project Settings, one item below, opens the same folder picker. A row whose
/// folder has actually gone still carries `Locate…` inline, where it is a recovery.
struct ProjectRowMenu: View {
    @Environment(\.argo) private var argo

    let row: ProjectDrawerProjection.Row
    let actions: CockpitActions
    let dismiss: DismissAction

    var body: some View {
        Menu {
            // Disabled, not hidden, on a folder that is not there: Finder has nothing to open,
            // and the verb going quiet would read as the click having missed.
            Button("Reveal in Finder", systemImage: ArgoSymbol.revealInFinder) {
                actions.revealProject(row.id)
            }
            .disabled(!row.isReachable)
            // The other route to the same panel, `⌘K` being the first.
            Button(ProjectSettingsCommands.label, systemImage: ArgoSymbol.projectSettings) {
                actions.openProjectPanel(row.id)
                dismiss()
            }
            Divider()
            Button("Remove from Argo", systemImage: ArgoSymbol.removeProject) {
                actions.removeProject(row.id)
                dismiss()
            }
            .help("Removes Argo's registration only. The folder on disk is not touched.")
        } label: {
            ArgoGlyph(ArgoSymbol.projectMenu, .inline)
        }
        // The contract reserves the brand hue for selection and focus, and a menu label takes the
        // control's accent — through the TINT, which a `foregroundStyle` on the label cannot reach.
        .tint(argo.color.text.tertiary)
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        // A slot rather than the menu's intrinsic size — see `rowMenuWidth`.
        .frame(width: ArgoToolbarVessel.rowMenuWidth, alignment: .leading)
        .accessibilityLabel("Manage this Project")
    }
}

/// A `DismissAction` only exists inside a view, so the preview has to be one.
private struct ProjectRowMenuPreview: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ProjectRowMenu(
            row: ProjectDrawerProjection.rows(from: .preview)[0],
            actions: .inert,
            dismiss: dismiss,
        )
    }
}

#Preview("Project row menu") {
    ProjectRowMenuPreview()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

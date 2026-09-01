import SwiftUI

/// One registered Project's management verbs, as a submenu of `ProjectMenu`.
///
/// Rename is absent because a Project's name IS its folder's, and `Locate…` because Project
/// Settings, one item below, opens the same folder picker. A Project whose folder has actually gone
/// is located by picking it in the menu above, where that is a recovery rather than a switch.
struct ProjectManageMenu: View {
    let row: ProjectMenuProjection.Row
    let actions: CockpitActions

    var body: some View {
        Menu(row.name) {
            // Disabled, not hidden, on a folder that is not there: Finder has nothing to open,
            // and the verb going quiet would read as the click having missed.
            Button("Reveal in Finder", systemImage: ArgoSymbol.revealInFinder) {
                actions.projects.reveal(row.id)
            }
            .disabled(!row.isReachable)
            // The other route to the same panel, `⌘K` being the first.
            Button(ProjectSettingsCommands.label, systemImage: ArgoSymbol.projectSettings) {
                actions.projects.openPanel(row.id)
            }
            Divider()
            Button("Remove from Argo", systemImage: ArgoSymbol.removeProject) {
                actions.projects.remove(row.id)
            }
            .help("Removes Argo's registration only. The folder on disk is not touched.")
        }
        .accessibilityLabel("Manage \(row.name)")
    }
}

#Preview("Manage a Project") {
    Menu("Manage") {
        ProjectManageMenu(row: ProjectMenuProjection.rows(from: .preview)[0], actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

// Reveal is disabled rather than absent on a folder that is not there — the verb going quiet
// would read as the click having missed.
#Preview("Manage a Project — folder not found") {
    Menu("Manage") {
        ProjectManageMenu(
            row: ProjectMenuProjection.rows(from: .unreachablePreview)[0],
            actions: .inert,
        )
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

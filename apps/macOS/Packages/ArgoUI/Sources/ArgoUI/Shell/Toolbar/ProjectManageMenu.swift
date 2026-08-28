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
                actions.revealProject(row.id)
            }
            .disabled(!row.isReachable)
            // The other route to the same panel, `⌘K` being the first.
            Button(ProjectSettingsCommands.label, systemImage: ArgoSymbol.projectSettings) {
                actions.openProjectPanel(row.id)
            }
            Divider()
            Button("Remove from Argo", systemImage: ArgoSymbol.removeProject) {
                actions.removeProject(row.id)
            }
            .help("Removes Argo's registration only. The folder on disk is not touched.")
        }
        .accessibilityLabel("Manage \(row.name)")
    }
}

import ArgoDesign
import SwiftUI

/// One registered Project's management verbs, as a submenu of `ProjectMenu`.
///
/// Rename is absent because a Project's name IS its folder's, and `Locate…` because Project
/// Settings, one item below, opens the same folder picker. A Project whose folder has actually gone
/// is located by picking it in the menu above, where that is a recovery rather than a switch.
package struct ProjectManageMenu: View {
    let row: ProjectMenuProjection.Row
    let actions: CockpitActions

    package var body: some View {
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
            // The same verb the disabled-Project state offers, spelled once (`ProjectRepair`):
            // one repair cannot have two vocabularies.
            Button(ProjectRepair.remove, systemImage: ArgoSymbol.removeProject) {
                ProjectRepair(projectID: row.id, actions: actions).forget()
            }
            .help(ProjectRepair.removeHelp)
        }
        .accessibilityLabel("Manage \(row.name)")
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(row: ProjectMenuProjection.Row, actions: CockpitActions) {
        self.row = row
        self.actions = actions
    }
}

// Reveal is disabled rather than absent on a folder that is not there — the verb going quiet
// would read as the click having missed.

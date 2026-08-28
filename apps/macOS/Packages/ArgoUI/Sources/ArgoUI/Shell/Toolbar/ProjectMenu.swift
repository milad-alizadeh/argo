import SwiftUI

/// The one place you both switch Projects and manage the registered set — no modal, no settings
/// pane, and since #875 no drawer either: this is a native menu's own items, so the tick beside the
/// Project on screen, the highlight, the keyboard and the dismissal are all the system's.
///
/// The switch is an inline `Picker` rather than a row of buttons because that is what draws the
/// tick. The verbs are a `Manage` submenu below it for the same reason in reverse: a menu item can
/// carry a tick OR a submenu, never both, and switching Projects is the thing this menu is for.
struct ProjectMenu: View {
    /// Already projected: the menu's honesty claims are `ProjectMenuProjection`'s, and this file
    /// only draws them.
    let rows: [ProjectMenuProjection.Row]
    let actions: CockpitActions

    var body: some View {
        if rows.isEmpty {
            // Inert rather than absent: a menu that opens onto `Add Project…` alone does not say
            // why there is nothing above it.
            Text("No Projects registered on this Mac")
        } else {
            Picker("Projects · registered on this Mac", selection: pick) {
                ForEach(rows) { row in
                    Text(row.title)
                        .accessibilityLabel(row.accessibilityLabel)
                        .tag(Optional(row.id))
                }
            }
            .pickerStyle(.inline)
        }
        Divider()
        // **Add Project…**, not "Register a Project": registration is the domain term, not the
        // label.
        Button("Add Project…", systemImage: ArgoSymbol.addProject, action: actions.addProject)
        if !registered.isEmpty {
            Divider()
            Menu("Manage") {
                ForEach(registered) { row in
                    ProjectManageMenu(row: row, actions: actions)
                }
            }
        }
    }

    /// Nobody registered these rows, so there is nothing to reveal, re-point or forget. The branch
    /// is absent rather than present-and-inert.
    private var registered: [ProjectMenuProjection.Row] {
        rows.filter(\.isRegistered)
    }

    /// Picking a Project whose folder is gone points at the folder picker, not at a Project that
    /// cannot be opened — so the setter is where the honesty is, not the row.
    private var pick: Binding<ProjectMenuProjection.Row.ID?> {
        Binding(
            get: { ProjectMenuProjection.active(in: rows) },
            set: { picked in
                guard let row = rows.first(where: { $0.id == picked }) else { return }
                if row.isReachable {
                    actions.selectProject(row.id)
                } else {
                    actions.locateProject(row.id)
                }
            },
        )
    }
}

// The menu's own items, drawn inside a `Menu` because that is the only place they exist — a
// `ForEach` of `Button`s outside one renders as a column of buttons and proves nothing about what
// AppKit will build. Clicking the label in a preview opens the real thing.

#Preview("Project menu") {
    Menu("Projects") {
        ProjectMenu(rows: ProjectMenuProjection.rows(from: .preview), actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project menu — a Project whose folder is not there") {
    Menu("Projects") {
        ProjectMenu(rows: ProjectMenuProjection.rows(from: .unreachablePreview), actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project menu — nothing registered") {
    Menu("Projects") {
        ProjectMenu(rows: ProjectMenuProjection.rows(from: .unregisteredPreview), actions: .inert)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

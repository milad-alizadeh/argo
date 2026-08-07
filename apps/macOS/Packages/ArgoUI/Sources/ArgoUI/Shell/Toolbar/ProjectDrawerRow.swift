import SwiftUI

/// One registered Project: its symbol, its full name over its path, what is live in it, and the
/// verbs that manage it.
///
/// An unreachable row keeps its place and states "folder not found" in words. The dashed edge is
/// the second reading of that, never the only one — and `Locate…` sits on the row rather than
/// inside the menu, because on this row it is the primary action.
struct ProjectDrawerRow: View {
    @Environment(\.argo) private var argo

    let row: ProjectDrawerProjection.Row
    let actions: CockpitActions

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Button { actions.selectProject(row.id) } label: {
                identity
            }
            .buttonStyle(.plain)
            .disabled(!row.isReachable)
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing
        }
        .padding(.horizontal, ArgoSpacing.base)
        .padding(.vertical, ArgoSpacing.snug)
        // The whole row, after its padding: the wash marks which Project is on screen, and one
        // sized to the name alone would mark the name instead.
        .background(rowSurface)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(row.accessibilityLabel)
        .accessibilityAddTraits(row.isActive ? .isSelected : [])
    }

    private var identity: some View {
        HStack(spacing: ArgoSpacing.base) {
            Image(systemName: row.isReachable ? ArgoSymbol.project : ArgoSymbol.unreachableProject)
                .argoGlyph(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.tertiary)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(row.name)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                Text(row.detail)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(row.isReachable ? argo.color.text.tertiary : argo.color.state
                        .attention)
            }
            .lineLimit(1)
            .truncationMode(.middle)
            Spacer(minLength: ArgoSpacing.flush)
        }
        .contentShape(.rect)
    }

    @ViewBuilder private var trailing: some View {
        if row.isReachable {
            if let liveSessions = row.liveSessions {
                Text(liveSessions)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        } else {
            Button("Locate…") { actions.locateProject(row.id) }
                .argoText(ArgoTypography.control)
        }
        ProjectRowMenu(projectID: row.id, actions: actions)
    }

    /// The active row is the only one that takes a surface at all — the same tonal separation the
    /// rest of the shell reads selection from.
    @ViewBuilder private var rowSurface: some View {
        let shape = RoundedRectangle(cornerRadius: ArgoRadius.control)
        if row.isReachable {
            shape.fill(argo.color.surface.selected).opacity(row.isActive ? 1 : 0)
        } else {
            shape.strokeBorder(
                argo.color.edge.strong,
                style: StrokeStyle(lineWidth: ArgoStroke.border, dash: [ArgoStroke.dash]),
            )
        }
    }
}

/// A Project's management verbs. Rename is deliberately absent: a Project's name IS its folder's,
/// so renaming one means renaming the folder — which makes it unreachable, and `Locate…` already
/// covers that.
private struct ProjectRowMenu: View {
    @Environment(\.argo) private var argo

    let projectID: String
    let actions: CockpitActions

    var body: some View {
        Menu {
            Button("Reveal in Finder", systemImage: ArgoSymbol.revealInFinder) {
                actions.revealProject(projectID)
            }
            Button("Locate…", systemImage: ArgoSymbol.locateProject) {
                actions.locateProject(projectID)
            }
            Divider()
            Button("Remove from Argo", systemImage: ArgoSymbol.removeProject) {
                actions.removeProject(projectID)
            }
            .help("Removes Argo's registration only. The folder on disk is not touched.")
        } label: {
            Image(systemName: ArgoSymbol.projectMenu)
                .argoGlyph(ArgoTypography.rowTitle)
                // The contract reserves the brand hue for selection and focus; a menu label takes
                // the control's accent unless it is told otherwise.
                .foregroundStyle(argo.color.text.tertiary)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("Manage this Project")
    }
}

#Preview("Drawer row — active") {
    ProjectDrawerRow(
        row: ProjectDrawerProjection.rows(from: .preview)[0],
        actions: .inert,
    )
    .frame(width: ArgoLayout.projectDrawerWidth)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Drawer row — folder not found") {
    ProjectDrawerRow(
        row: ProjectDrawerProjection.rows(from: .preview)[2],
        actions: .inert,
    )
    .frame(width: ArgoLayout.projectDrawerWidth)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

import SwiftUI

/// One registered Project: its symbol, its full name over its path, what is live in it, and the
/// verbs that manage it.
///
/// An unreachable row keeps its place and states "folder not found" in words. The dashed edge is
/// the second reading of that, never the only one — and `Locate…` sits on the row rather than
/// inside the menu, because on this row it is the primary action.
struct ProjectDrawerRow: View {
    @Environment(\.argo) private var argo
    /// A drawer that stayed open over the cockpit it just re-pointed would be showing the answer
    /// to a question already asked. Every verb that changes what the window is on closes it.
    @Environment(\.dismiss) private var dismiss

    let row: ProjectDrawerProjection.Row
    let actions: CockpitActions

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Button { select() } label: {
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

    private func select() {
        actions.selectProject(row.id)
        dismiss()
    }

    private func locate() {
        actions.locateProject(row.id)
        dismiss()
    }

    private var identity: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(
                row.isReachable ? ArgoSymbol.project : ArgoSymbol.unreachableProject,
                ArgoTypography.rowTitle,
            )
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
            Button("Locate…", action: locate)
                .argoText(ArgoTypography.control)
        }
        // Nobody registered this row, so there is no record to reveal, re-point or forget. The
        // menu is absent rather than present-and-inert.
        if row.isRegistered {
            ProjectRowMenu(row: row, actions: actions, dismiss: dismiss)
        }
    }

    /// The active row is the only one that takes a surface at all. The wash is neutral and the Ion
    /// Blue is the indicator edge, per the contract — which also keeps the active row readable
    /// beside the system's own focus effect, a fill that would otherwise say the same thing.
    @ViewBuilder private var rowSurface: some View {
        let shape = RoundedRectangle(cornerRadius: ArgoRadius.control)
        if row.isReachable {
            shape
                .fill(argo.color.surface.selected)
                .overlay(alignment: .leading) { selectionIndicator }
                .opacity(row.isActive ? 1 : 0)
        } else {
            shape.strokeBorder(
                argo.color.edge.strong,
                style: StrokeStyle(lineWidth: ArgoStroke.border, dash: [ArgoStroke.dash]),
            )
        }
    }

    private var selectionIndicator: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.marker)
            .fill(argo.color.interaction.selectionIndicator)
            .frame(width: ArgoStroke.indicator)
            .padding(.vertical, ArgoSpacing.tight)
    }
}

/// A Project's management verbs. Rename is deliberately absent: a Project's name IS its folder's,
/// so renaming one means renaming the folder — which makes it unreachable, and `Locate…` already
/// covers that.
private struct ProjectRowMenu: View {
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
            Button("Locate…", systemImage: ArgoSymbol.locateProject) {
                actions.locateProject(row.id)
                dismiss()
            }
            Divider()
            Button("Remove from Argo", systemImage: ArgoSymbol.removeProject) {
                actions.removeProject(row.id)
                dismiss()
            }
            .help("Removes Argo's registration only. The folder on disk is not touched.")
        } label: {
            ArgoGlyph(ArgoSymbol.projectMenu, ArgoTypography.rowTitle)
        }
        // The contract reserves the brand hue for selection and focus, and a menu label takes the
        // control's accent — through the TINT, which a `foregroundStyle` on the label cannot reach.
        .tint(argo.color.text.tertiary)
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

// The commonest row of all: registered, reachable, not the Project on screen, and — because the
// Hub observes one Project at a time — carrying no count.
#Preview("Drawer row — a Project nothing is observing") {
    ProjectDrawerRow(
        row: ProjectDrawerProjection.rows(from: .preview)[1],
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

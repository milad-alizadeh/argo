import SwiftUI

/// One registered Project: its symbol, its full name over its path, what is live in it, and the
/// verbs that manage it. An unreachable row keeps its place and states "folder not found" in
/// words; the dashed edge is the second reading of that, never the only one.
struct ProjectDrawerRow: View {
    @Environment(\.argo) private var argo
    /// Every verb that changes what the window is on closes the drawer.
    @Environment(\.dismiss) private var dismiss

    /// The row draws its own focus: the system's effect boxes the button it is on — here the
    /// identity alone — which wrapped two thirds of a row in a fill, and drew for a click as
    /// readily as for a key. Pulled once on suspicion of causing a crash on open; the crash was
    /// the accessibility tree, not this.
    @FocusState private var isFocused: Bool

    let row: ProjectDrawerProjection.Row
    let actions: CockpitActions

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Button { select() } label: {
                identity
            }
            .buttonStyle(.plain)
            .focused($isFocused)
            .focusEffectDisabled()
            .frame(maxWidth: .infinity, alignment: .leading)
            // The label sits on the button that DOES the switching, not on the row around it.
            .accessibilityLabel(row.accessibilityLabel)
            .accessibilityAddTraits(row.isActive ? .isSelected : [])
            trailing
        }
        .padding(.horizontal, ArgoSpacing.base)
        .padding(.vertical, ArgoSpacing.snug)
        // The whole row, after its padding: the wash marks which Project is on screen, and one
        // sized to the name alone would mark the name instead.
        .background(rowSurface)
        // `contain`, NOT `combine`. Combining flattens the row into a single element and swallows
        // the ⋯ menu with it — so Reveal, Locate and Remove were unreachable to anything driving
        // by accessibility, which is every screen reader as well as the E2E test that caught it.
        .accessibilityElement(children: .contain)
    }

    /// Clicking a row whose folder is gone points at the folder picker, not at a Project that
    /// cannot be opened.
    private func select() {
        guard row.isReachable else { return locate() }
        actions.selectProject(row.id)
        dismiss()
    }

    private func locate() {
        actions.locateProject(row.id)
        dismiss()
    }

    private var identity: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(
                row.isReachable ? ArgoSymbol.project : ArgoSymbol.unreachableProject,
                .inline,
            )
            .foregroundStyle(argo.color.text.tertiary)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(row.name)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                // "folder not found" takes no hue of its own: the attention amber is spoken for by
                // the state rollup (#164).
                Text(row.detail)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(row.isReachable ? argo.color.text.tertiary : argo.color.text
                        .secondary)
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
            locateButton
        }
        // Nobody registered this row, so there is no record to reveal, re-point or forget. The
        // menu is absent rather than present-and-inert.
        if row.isRegistered {
            ProjectRowMenu(row: row, actions: actions, dismiss: dismiss)
        }
    }

    /// Prominent by placement and weight, not by hue: the contract reserves the accent for
    /// selection and focus, and this row must not read as selected.
    private var locateButton: some View {
        Button("Locate…", action: locate)
            .buttonStyle(.quiet)
    }

    /// Two independent readings on one shape: which Project the window is on, and whether its
    /// folder is there. They compose — the active Project's folder can be the one that moved, and
    /// that row has to say both at once.
    private var rowSurface: some View {
        let shape = RoundedRectangle(cornerRadius: ArgoRadius.control)
        return shape
            .fill(argo.color.surface.selected)
            .opacity(row.isActive ? 1 : 0)
            .overlay {
                if !row.isReachable {
                    dashedEdge(shape)
                }
            }
            .argoFocusRing(isFocused)
    }

    private func dashedEdge(_ shape: RoundedRectangle) -> some View {
        shape.strokeBorder(
            argo.color.edge.strong,
            style: StrokeStyle(lineWidth: ArgoStroke.border, dash: [ArgoStroke.dash]),
        )
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

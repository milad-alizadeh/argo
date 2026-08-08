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

    /// The row draws its own focus. The system's effect boxes the button it is on — here the
    /// identity alone — so a rectangle wrapped two thirds of a row in a fill saying the same thing
    /// as the active wash. This was pulled once on suspicion of causing a crash on open; the E2E
    /// test now walks that path, and the crash was the accessibility tree, not this.
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
    /// cannot be opened. A disabled row would grey out its own name, which is the one thing on it
    /// that is still true.
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
                ArgoTypography.rowTitle,
            )
            .foregroundStyle(argo.color.text.tertiary)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(row.name)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                // "folder not found" takes no hue of its own. The words and the dashed edge carry
                // it, and the attention amber is spoken for by the state rollup (#164) — one
                // colour meaning two things is what the merged vessel exists to end.
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

    /// Prominent by placement and weight, not by hue: a stock tinted button would put the only
    /// accent-coloured control in the shell on the one row that must not read as selected, and the
    /// contract reserves that hue for selection and focus.
    private var locateButton: some View {
        Button(action: locate) {
            Text("Locate…")
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.primary)
                .padding(.horizontal, ArgoSpacing.base)
                .padding(.vertical, ArgoSpacing.tight)
                .background(
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .fill(argo.color.surface.raised),
                )
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    /// Two independent readings on one shape: which Project the window is on, and whether its
    /// folder is there. They compose because they are not alternatives — the active Project's
    /// folder can be the one that moved, and that row has to say both at once.
    ///
    /// The wash alone marks the active row. There is no Ion Blue edge beside it: on glass the
    /// wash already separates that row from every other, and a second mark saying the same thing
    /// only competes with what the system paints for focus.
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
            .overlay {
                if isFocused {
                    shape.strokeBorder(
                        argo.color.interaction.focusRing,
                        lineWidth: ArgoStroke.focus,
                    )
                }
            }
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

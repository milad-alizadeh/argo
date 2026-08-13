import SwiftUI

/// The one place you both switch Projects and manage the registered set — no modal, no settings
/// pane. Every registered Project is one row; adding one is the footer.
struct ProjectDrawer: View {
    @Environment(\.argo) private var argo
    @Environment(\.dismiss) private var dismiss
    /// Drawn here, not by the system: the default effect is a square-cornered box on the button's
    /// own bounds, which cuts across the rule above it and the panel's rounded corners below.
    @FocusState private var isFooterFocused: Bool

    let presentation: CockpitPresentation
    let actions: CockpitActions

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            header
            content
            footer
        }
        // One gutter for the whole drawer, so the header, the row washes, the rule and the footer
        // all start at the same edge.
        .padding(.horizontal, ArgoSpacing.snug)
        .padding(.bottom, ArgoSpacing.snug)
        .frame(width: ArgoLayout.projectDrawerWidth)
        // NO ground of its own, of any kind. A popover IS the system's glass, so anything drawn
        // behind this content is a second material inside the same panel — and the popover window
        // is wider than this content, so even a `glassEffect` shows as a rim around a second sheet.
    }

    private var rows: [ProjectDrawerProjection.Row] {
        ProjectDrawerProjection.rows(from: presentation)
    }

    /// The picker opens over the window, so the drawer must not be left hanging in front of it.
    private func addProject() {
        actions.addProject()
        dismiss()
    }

    /// The registry is per machine and never travels, which the label has to say.
    private var header: some View {
        Text("Projects · registered on this Mac")
            .argoText(ArgoTypography.sectionLabel)
            .foregroundStyle(argo.color.text.tertiary)
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.top, ArgoSpacing.comfortable)
            .padding(.bottom, ArgoSpacing.base)
    }

    @ViewBuilder private var content: some View {
        if rows.isEmpty {
            Text("No Projects yet. Add one to scope this window.")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .padding(.horizontal, ArgoSpacing.base)
                .padding(.bottom, ArgoSpacing.base)
        } else {
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                ForEach(rows) { row in
                    ProjectDrawerRow(row: row, actions: actions)
                }
            }
            .padding(.bottom, ArgoSpacing.snug)
        }
    }

    /// **Add Project…**, not "Register a Project": registration is the domain term, not the label.
    private var footer: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            DeckSeparator()
            Button(action: addProject) {
                Label {
                    Text("Add Project…")
                } icon: {
                    ArgoGlyph(ArgoSymbol.addProject, .inline)
                }
                // The rows' own role, not a control role: the footer is the last item in the
                // list's icon column, and a size of its own would break that column.
                .labelStyle(.argo(ArgoTypography.rowTitle))
                .foregroundStyle(argo.color.text.primary)
                // The same inner gutter a row uses, so the "+" lands in the rows' icon column
                // rather than 4pt to its left.
                .padding(.horizontal, ArgoSpacing.base)
                .padding(.vertical, ArgoSpacing.base)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
                .argoFocusRing(isFooterFocused)
            }
            .buttonStyle(.plain)
            .focused($isFooterFocused)
            .focusEffectDisabled()
        }
    }
}

#Preview("Project drawer") {
    ProjectDrawer(presentation: .preview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Project drawer — nothing registered") {
    ProjectDrawer(presentation: .unregisteredPreview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Project drawer — the active Project's folder has moved") {
    ProjectDrawer(presentation: .unreachablePreview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

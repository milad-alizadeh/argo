import SwiftUI

/// The one place you both switch Projects and manage the registered set — no modal, no settings
/// pane. Every registered Project is one row; adding one is the footer.
struct ProjectDrawer: View {
    @Environment(\.argo) private var argo
    @Environment(\.dismiss) private var dismiss
    /// Drawn here rather than left to the system, for the reason the rows draw their own: the
    /// default effect is a square-cornered box on the button's own bounds, which cuts across the
    /// rule above it and the panel's rounded corners below.
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
        // NO ground of its own, of any kind. A popover IS the system's glass, and anything drawn
        // behind this content is a second material inside the same panel: an opaque fill read as
        // a flat slab, and a `glassEffect` was no better — the popover window is wider than this
        // content, so its own material showed as a rim around a second sheet of glass. Two tones
        // either way. The one that carries the panel has to be the only one.
    }

    private var rows: [ProjectDrawerProjection.Row] {
        ProjectDrawerProjection.rows(from: presentation)
    }

    /// The picker is the app's, and it opens over the window — a drawer left hanging in front of
    /// it is a second surface between the user and the folder they are choosing.
    private func addProject() {
        actions.addProject()
        dismiss()
    }

    /// The registry is per machine and never travels — said here rather than left to be discovered
    /// on the second computer.
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

    /// **Add Project…**, not "Register a Project": registration is the domain term, and it is not
    /// the word on the button.
    private var footer: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            DeckSeparator()
            Button(action: addProject) {
                Label {
                    Text("Add Project…")
                } icon: {
                    ArgoGlyph(ArgoSymbol.addProject, ArgoTypography.rowTitle)
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
                .overlay {
                    if isFooterFocused {
                        RoundedRectangle(cornerRadius: ArgoRadius.control)
                            .strokeBorder(
                                argo.color.interaction.focusRing,
                                lineWidth: ArgoStroke.focus,
                            )
                    }
                }
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

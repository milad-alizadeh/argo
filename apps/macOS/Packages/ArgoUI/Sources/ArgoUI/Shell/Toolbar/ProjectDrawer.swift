import SwiftUI

/// The one place you both switch Projects and manage the registered set — no modal, no settings
/// pane. Every registered Project is one row; adding one is the footer.
struct ProjectDrawer: View {
    @Environment(\.argo) private var argo
    @Environment(\.dismiss) private var dismiss

    let presentation: CockpitPresentation
    let actions: CockpitActions

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            header
            content
            footer
        }
        .frame(width: ArgoLayout.projectDrawerWidth)
        .background(argo.color.surface.overlay)
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
            .padding(.horizontal, ArgoSpacing.comfortable)
            .padding(.top, ArgoSpacing.comfortable)
            .padding(.bottom, ArgoSpacing.base)
    }

    @ViewBuilder private var content: some View {
        if rows.isEmpty {
            Text("No Projects yet. Add one to scope this window.")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.bottom, ArgoSpacing.base)
        } else {
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                ForEach(rows) { row in
                    ProjectDrawerRow(row: row, actions: actions)
                }
            }
            .padding(.horizontal, ArgoSpacing.snug)
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
                    ArgoGlyph(ArgoSymbol.addProject, ArgoTypography.control)
                }
                .labelStyle(.argo(ArgoTypography.control))
                .foregroundStyle(argo.color.text.primary)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.vertical, ArgoSpacing.base)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
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

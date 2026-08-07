import SwiftUI

/// The active Project as the leading half of the scope vessel: state, full name, disclosure.
///
/// The name is spelled out rather than initialled — an initial is what sent this surface out of
/// the sidebar. Until the Project drawer lands (#450) the disclosure is a menu over the set.
struct ProjectVessel: View {
    @Environment(\.argo) private var argo

    let presentation: CockpitPresentation
    let actions: CockpitActions

    var body: some View {
        Menu {
            ForEach(presentation.projects) { candidate in
                Button(candidate.name) { actions.selectProject(candidate.id) }
            }
            if !presentation.projects.isEmpty {
                Divider()
            }
            Button("Add Project…", action: actions.addProject)
        } label: {
            label
        }
        .help(help)
        .accessibilityLabel(accessibilityLabel)
    }

    private var project: CockpitPresentation.Project? {
        presentation.activeProject
    }

    private var label: some View {
        HStack(spacing: ArgoSpacing.snug) {
            stateRing
            Text(project?.name ?? "No Project")
                .argoText(ArgoTypography.control)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .frame(maxWidth: ArgoLayout.projectVesselMaximumWidth)
    }

    /// The slot the per-Project worst-state rollup fills (#164). Nothing derives it yet, so it is
    /// drawn as the unknown it is — a ring, not a tinted disc claiming a state Argo cannot read.
    /// A glyph rather than a `Circle`: a menu label draws text and symbols, and a bare shape in one
    /// silently renders nothing at all.
    private var stateRing: some View {
        Image(systemName: "circle")
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .accessibilityHidden(true)
    }

    private var help: String {
        guard let project else { return "No Project registered — add one to scope this window" }
        return project.isReachable
            ? "Project — \(project.name) · \(project.location)"
            : "Project — \(project.name) · folder not found"
    }

    /// State is spoken, never left to the ring: unreachability is a word here for the same reason
    /// it is a word in the drawer.
    private var accessibilityLabel: String {
        guard let project else { return "Project, none registered" }
        return project.isReachable
            ? "Project, \(project.name)"
            : "Project, \(project.name), folder not found"
    }
}

#Preview("Project vessel") {
    ProjectVessel(presentation: .preview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Project vessel — folder not found") {
    ProjectVessel(presentation: .unreachablePreview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Project vessel — nothing registered") {
    ProjectVessel(presentation: .unregisteredPreview, actions: .inert)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

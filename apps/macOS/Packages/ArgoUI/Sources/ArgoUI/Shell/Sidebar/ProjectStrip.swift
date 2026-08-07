import SwiftUI

/// The registered set at the leading edge of the continuous native sidebar, one mark per Project.
struct ProjectStrip: View {
    @Environment(\.argo) private var argo

    let projects: [CockpitPresentation.Project]
    let activeProjectID: CockpitPresentation.Project.ID?
    let selectProject: (CockpitPresentation.Project.ID) -> Void
    let addProject: () -> Void
    let locateProject: (CockpitPresentation.Project.ID) -> Void

    var body: some View {
        VStack(spacing: ArgoSpacing.base) {
            ForEach(projects) { project in
                ProjectMark(
                    project: project,
                    isActive: project.id == activeProjectID,
                    select: { selectProject(project.id) },
                    locate: { locateProject(project.id) },
                )
            }
            addButton
            Spacer()
        }
        .padding(.top, ArgoSpacing.loose)
        .frame(width: ArgoLayout.projectStripWidth)
    }

    /// Registration is the act that creates a Project, so it needs an affordance — and on a machine
    /// that has registered nothing this is the only one on screen.
    private var addButton: some View {
        Button(action: addProject) {
            Image(systemName: "plus")
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoLayout.projectMarkSize, height: ArgoLayout.projectMarkSize)
                .contentShape(RoundedRectangle(cornerRadius: ArgoRadius.control))
        }
        .buttonStyle(.plain)
        .help("Register a Project")
        .accessibilityLabel("Register a Project")
    }
}

#Preview("Project strip") {
    ProjectStrip(
        projects: CockpitPresentation.preview.projects,
        activeProjectID: CockpitPresentation.preview.activeProjectID,
        selectProject: { _ in },
        addProject: {},
        locateProject: { _ in },
    )
    .frame(height: 480)
    .argoAppearance()
}

#Preview("Project strip — nothing registered") {
    ProjectStrip(
        projects: [],
        activeProjectID: nil,
        selectProject: { _ in },
        addProject: {},
        locateProject: { _ in },
    )
    .frame(height: 480)
    .argoAppearance()
}

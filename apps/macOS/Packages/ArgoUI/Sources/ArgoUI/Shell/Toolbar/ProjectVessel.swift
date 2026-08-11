import SwiftUI

/// The active Project as the leading half of the scope vessel: its symbol, its full name and a
/// disclosure. Clicking it opens the Project drawer.
///
/// The name is spelled out rather than initialled. No state dot: nothing derives the per-Project
/// worst-state rollup yet (#164).
struct ProjectVessel: View {
    @Environment(\.argo) private var argo
    @State private var isDrawerOpen = false

    let presentation: CockpitPresentation
    let actions: CockpitActions

    var body: some View {
        Button { isDrawerOpen.toggle() } label: {
            label
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isDrawerOpen, arrowEdge: .bottom) {
            ProjectDrawer(presentation: presentation, actions: actions)
        }
        .help(help)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Opens the Project drawer")
    }

    private var project: CockpitPresentation.Project? {
        presentation.activeProject
    }

    private var label: some View {
        HStack(spacing: ArgoSpacing.snug) {
            // The drawer rows' role, not a control role: one size for the Project name here and
            // in the drawer, and a rung above the branch beside it.
            ArgoGlyph(symbol, .control)
            Text(project?.name ?? "No Project")
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.tail)
            ArgoGlyph(ArgoSymbol.disclosure, .inline)
        }
        .foregroundStyle(argo.color.text.primary)
        .frame(maxWidth: ArgoLayout.projectVesselMaximumWidth)
        .toolbarSegment()
    }

    /// A Project whose folder is gone says so with its mark as well as in the drawer's words.
    private var symbol: String {
        project?.isReachable == false ? ArgoSymbol.unreachableProject : ArgoSymbol.project
    }

    private var help: String {
        guard let project else { return "No Project registered — add one to scope this window" }
        return project.isReachable
            ? "Project — \(project.name) · \(project.location)"
            : "Project — \(project.name) · folder not found"
    }

    /// State is spoken, never left to the mark: unreachability is a word here and in the drawer.
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

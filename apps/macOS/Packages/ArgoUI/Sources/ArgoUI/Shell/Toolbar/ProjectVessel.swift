import SwiftUI

/// The active Project as the leading half of the scope vessel: its symbol, its full name and a
/// disclosure. Clicking it opens the Project drawer.
///
/// The name is spelled out rather than initialled — an initial is what sent this surface out of
/// the sidebar. No state dot: nothing derives the per-Project worst-state rollup yet (#164), and
/// an empty ring beside every Project is chrome standing in for a fact.
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
            // The drawer rows' role, not a control role. The Project name is the subject of this
            // vessel and its own row in the drawer — one size for it in both places — and setting
            // it above the branch is what makes the merged capsule read "this Project, on this
            // checkout" rather than two equal facts glued together.
            ArgoGlyph(symbol, ArgoTypography.rowTitle)
            Text(project?.name ?? "No Project")
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.tail)
            ArgoGlyph(indicator: ArgoSymbol.disclosure, height: ArgoLayout.disclosureHeight)
        }
        .foregroundStyle(argo.color.text.primary)
        .frame(maxWidth: ArgoLayout.projectVesselMaximumWidth)
        .toolbarSegment()
    }

    /// A Project reads as a Project rather than as a bare word beside a state ring — and a Project
    /// whose folder is gone says so with its mark as well as in the drawer's words.
    private var symbol: String {
        project?.isReachable == false ? ArgoSymbol.unreachableProject : ArgoSymbol.project
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

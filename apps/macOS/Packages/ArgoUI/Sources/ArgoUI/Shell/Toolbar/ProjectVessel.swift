import SwiftUI

/// The active Project as the leading half of the scope vessel: its symbol, its full name and a
/// disclosure. Clicking it opens the Project drawer.
///
/// No state dot: nothing derives the per-Project worst-state rollup yet (#164).
struct ProjectVessel: View {
    @Environment(\.argo) private var argo
    @State private var isDrawerOpen = false

    let reading: ProjectVesselReading
    let rows: [ProjectDrawerProjection.Row]
    let actions: CockpitActions

    var body: some View {
        Button { isDrawerOpen.toggle() } label: {
            label
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isDrawerOpen, arrowEdge: .bottom) {
            ProjectDrawer(rows: rows, actions: actions)
        }
        .help(reading.help)
        .accessibilityLabel(reading.announcement)
        .accessibilityHint(ProjectVesselReading.hint)
    }

    private var label: some View {
        HStack(spacing: ArgoSpacing.snug) {
            // The drawer rows' role, not a control role: one size for the Project name here and
            // in the drawer, and a rung above the branch beside it.
            ArgoGlyph(reading.mark, .control)
            Text(reading.name)
                .argoText(ArgoTypography.rowTitle)
                .lineLimit(1)
                .truncationMode(.tail)
            ArgoDisclosure(.below)
        }
        .foregroundStyle(argo.color.text.primary)
        .frame(maxWidth: ArgoLayout.projectVesselMaximumWidth)
        .toolbarSegment()
    }
}

#Preview("Project vessel") {
    ProjectVessel(
        reading: ProjectVesselReading(presentation: .preview),
        rows: ProjectDrawerProjection.rows(from: .preview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project vessel — folder not found") {
    ProjectVessel(
        reading: ProjectVesselReading(presentation: .unreachablePreview),
        rows: ProjectDrawerProjection.rows(from: .unreachablePreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Project vessel — nothing registered") {
    ProjectVessel(
        reading: ProjectVesselReading(presentation: .unregisteredPreview),
        rows: ProjectDrawerProjection.rows(from: .unregisteredPreview),
        actions: .inert,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

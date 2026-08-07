import SwiftUI

/// The active Project at the leading edge of the continuous native sidebar.
struct ProjectStrip: View {
    @Environment(\.argo) private var argo
    @Environment(\.controlActiveState) private var activeState

    let project: CockpitPresentation.Project

    var body: some View {
        VStack(spacing: ArgoSpacing.base) {
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: ArgoRadius.control)
                    .fill(argo.color.surface.selected)
                Rectangle()
                    .fill(selectionInk)
                    .frame(width: ArgoStroke.indicator)
                Text(String(project.name.prefix(1)).uppercased())
                    .argoText(ArgoTypography.identityHeading)
                    .frame(maxWidth: .infinity)
            }
            .frame(width: ArgoLayout.projectMarkSize, height: ArgoLayout.projectMarkSize)
            .help(project.location)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Selected Project, \(project.name)")
            Spacer()
        }
        .padding(.top, ArgoSpacing.loose)
        .frame(width: ArgoLayout.projectStripWidth)
    }

    private var selectionInk: ArgoColor {
        switch activeState {
        case .key, .active: argo.color.interaction.selectionIndicator
        case .inactive: argo.color.text.tertiary
        @unknown default: argo.color.text.tertiary
        }
    }
}

#Preview("Project strip") {
    ProjectStrip(project: CockpitPresentation.preview.project)
        .frame(height: 480)
        .argoAppearance()
}

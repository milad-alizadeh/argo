import SwiftUI

/// One Project in the strip: its initial, whether it is the one on screen, and whether its
/// folder is still where it was registered.
///
/// An unreachable mark keeps its place rather than dropping out of the strip — the Project has
/// not stopped existing, its folder has moved — and its action re-points rather than switches:
/// switching to a folder that is not there would swap a working roster for an empty one.
struct ProjectMark: View {
    @Environment(\.argo) private var argo

    let project: CockpitPresentation.Project
    let isActive: Bool
    let actions: CockpitActions

    var body: some View {
        Button(action: act) {
            Text(String(project.name.prefix(1)).uppercased())
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(ink)
                .frame(maxWidth: .infinity)
                .background {
                    // Selection is tonal, not branded: the strip is borderless (the shell spec's
                    // "tabs float on the scene"), so only the active mark takes a surface at all,
                    // and its lit rim is the same depth device every other edge here is.
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .fill(argo.color.surface.selected)
                        .overlay {
                            RoundedRectangle(cornerRadius: ArgoRadius.control)
                                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
                        }
                        .opacity(isActive ? 1 : 0)
                }
                .frame(width: ArgoLayout.projectMarkSize, height: ArgoLayout.projectMarkSize)
                .overlay(alignment: .bottomTrailing) {
                    if !project.isReachable {
                        Circle()
                            .fill(argo.color.state.attention)
                            .frame(
                                width: ArgoLayout.statusDotSize,
                                height: ArgoLayout.statusDotSize,
                            )
                            .offset(x: ArgoSpacing.hair, y: ArgoSpacing.hair)
                    }
                }
        }
        .buttonStyle(.plain)
        .help(helpText)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }

    private func act() {
        guard project.isReachable else {
            actions.locateProject(project.id)
            return
        }
        actions.selectProject(project.id)
    }

    /// The strip carries no project label, so the tooltip is the only place the path appears.
    private var helpText: String {
        project.isReachable
            ? "\(project.name) — \(project.location)"
            : "\(project.name) — folder not found at \(project.location). Click to locate it."
    }

    private var accessibilityLabel: String {
        let state = project.isReachable ? "" : ", folder not found"
        return isActive
            ? "Selected Project, \(project.name)\(state)"
            : "Project, \(project.name)\(state)"
    }

    /// The active mark is the only one at full strength, so which Project is on screen is read off
    /// the same tonal separation the rest of the shell is built from.
    private var ink: ArgoColor {
        guard project.isReachable else { return argo.color.text.disabled }
        return isActive ? argo.color.text.primary : argo.color.text.tertiary
    }
}

#Preview("Project mark — active") {
    ProjectMark(
        project: CockpitPresentation.preview.projects[0],
        isActive: true,
        actions: .inert,
    )
    .padding()
    .argoAppearance()
}

#Preview("Project mark — background") {
    ProjectMark(
        project: CockpitPresentation.preview.projects[1],
        isActive: false,
        actions: .inert,
    )
    .padding()
    .argoAppearance()
}

#Preview("Project mark — folder not found") {
    ProjectMark(
        project: CockpitPresentation.preview.projects[2],
        isActive: false,
        actions: .inert,
    )
    .padding()
    .argoAppearance()
}

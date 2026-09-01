import SwiftUI

/// The whole window when the active Project's folder is not at the recorded path: one error state,
/// and the two verbs that repair it (failure spec §6).
///
/// It REPLACES the rooms rather than sitting over them. The folder is the Project's scope
/// (ADR-0015), so with the folder gone there is no room left that could be honestly lit — the
/// roster, the checkout and the Code room all read the same missing folder. A per-room split was
/// proposed and rejected.
///
/// Said in WORDS, with no mark above them. The icon ladder tops out at a control's own rung
/// (`ArgoIconSize`), and a 13pt folder over a whole window reads as a speck rather than as a state
/// — so the failure ink on the status word is the only second reading here, and `folder not found`
/// is on the screen whatever the palette does.
struct ProjectDisabledScreen: View {
    @Environment(\.argo) private var argo

    let reading: ProjectDisabledReading
    let repair: ProjectRepair

    var body: some View {
        VStack(spacing: ArgoSpacing.section) {
            said
            verbs
        }
        .frame(maxWidth: ArgoProjectDisabled.readingWidth)
        .padding(ArgoSpacing.region)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(argo.color.surface.sunken)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(reading.announcement)
    }

    private var said: some View {
        VStack(spacing: ArgoSpacing.base) {
            Text(reading.name)
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
            Text(reading.state)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(ArgoOperationalState.failure.tint(in: argo.color))
            Text(reading.detail)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .multilineTextAlignment(.center)
        }
    }

    /// Relocate takes the default action: it is the repair that keeps the Project, and removing one
    /// by pressing Return is not a thing this screen may do.
    private var verbs: some View {
        HStack(spacing: ArgoSpacing.base) {
            Button(ProjectRepair.relocate, action: repair.locate)
                .argoText(ArgoTypography.control)
                .keyboardShortcut(.defaultAction)
            Button(ProjectRepair.remove, action: repair.forget)
                .argoText(ArgoTypography.control)
                .help(ProjectRepair.removeHelp)
        }
    }
}

#Preview("Project disabled — folder not found") {
    if let reading = ProjectDisabledReading(presentation: .unreachablePreview) {
        ProjectDisabledScreen(
            reading: reading,
            repair: ProjectRepair(projectID: reading.projectID, actions: .inert),
        )
        .frame(width: ArgoLayout.windowMinimumWidth, height: ArgoLayout.windowMinimumHeight)
        .argoAppearance()
    }
}

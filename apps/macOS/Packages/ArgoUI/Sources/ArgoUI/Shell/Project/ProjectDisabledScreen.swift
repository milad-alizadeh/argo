import ArgoDesign
import SwiftUI

/// The whole window when the active Project's folder is not at the recorded path: one error state,
/// and the two verbs that repair it (failure spec §6).
///
/// The platform's own unavailable state, restyled through the contract exactly as
/// `TicketsRoomVacancy` does it — this is a title, a sentence and the actions on them, which is
/// what `ContentUnavailableView` is, and a hand-built stack of the same three would lose the
/// keyboard and accessibility behaviour that comes with it.
///
/// Said in WORDS, with no mark over them. The icon ladder tops out at a control's own rung
/// (`ArgoIconSize`), and a 13pt folder above a whole window reads as a speck rather than as a
/// state, so the failure ink on the status word is the only second reading here.
struct ProjectDisabledScreen: View {
    @Environment(\.argo) private var argo

    let reading: ProjectDisabledReading
    let repair: ProjectRepair

    var body: some View {
        ContentUnavailableView {
            VStack(spacing: ArgoSpacing.tight) {
                Text(reading.name)
                    .argoText(ArgoTypography.identityHeading)
                    .foregroundStyle(argo.color.text.primary)
                Text(reading.state)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(ArgoOperationalState.failure.tint(in: argo.color))
            }
            .frame(maxWidth: ArgoProjectDisabled.readingWidth)
        } description: {
            Text(reading.detail)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                // On the Text: `ContentUnavailableView` sizes its description to a measure of its
                // own, and a frame outside it never reaches the line breaks.
                .frame(width: ArgoProjectDisabled.readingWidth)
        } actions: {
            verbs
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(argo.color.surface.sunken)
    }

    /// Relocate takes the default action: it is the repair that keeps the Project, and removing one
    /// by pressing Return is not a thing this screen may do. Remove takes the quiet style beside
    /// it, so the accent stays on the one control the screen is asking for.
    private var verbs: some View {
        HStack(spacing: ArgoSpacing.base) {
            Button(ProjectRepair.relocate, action: repair.locate)
                .argoText(ArgoTypography.control)
                .keyboardShortcut(.defaultAction)
            Button(ProjectRepair.remove, action: repair.forget)
                .buttonStyle(.quiet)
                .help(ProjectRepair.removeHelp)
        }
        // `ContentUnavailableView` lays its actions out to a measure of its own and truncates what
        // will not fit — which cut `Remove from Argo` to `Remove from…`, a verb that reads as
        // opening something. A repair's label is the one thing here that may not be abbreviated.
        .fixedSize(horizontal: true, vertical: false)
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

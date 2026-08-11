import SwiftUI

/// The window's connection chips: what Argo can observe, and how the active Project's ports are
/// reading. Stacked because they are two subjects, drawn the same because they are one language.
///
/// Both are silent when there is nothing wrong, so the ordinary window carries none of this — a
/// permanently-lit healthy indicator trains the eye to skip the spot the warning appears in.
struct ConnectionChips: View {
    let presentation: CockpitPresentation
    let health: ConnectionHealthReading
    let actions: CockpitActions

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            if let observation = ConnectionChipReading(observing: presentation.connection) {
                ConnectionChip(reading: observation, act: actions.retryConnection)
            }
            // Reconnecting happens in the Connect panel, so the chip's one act is to open it on the
            // Project this reading is about. There is one reconnect in this app and this is a way
            // to REACH it, not a second one.
            if let providers = ConnectionHealthProjection.chip(from: health) {
                ConnectionChip(reading: providers) {
                    actions.openProjectPanel(presentation.activeProjectID)
                }
            }
        }
    }
}

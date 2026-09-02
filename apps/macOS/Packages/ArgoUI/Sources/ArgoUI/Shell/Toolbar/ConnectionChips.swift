import ArgoDesign
import SwiftUI

/// The window's connection chips: what Argo can observe, and how the active Project's ports are
/// reading. Stacked because they are two subjects, drawn the same because they are one language.
///
/// Both are silent when there is nothing wrong, so the ordinary window carries none of this — a
/// permanently-lit healthy indicator trains the eye to skip the spot the warning appears in.
struct ConnectionChips: View {
    let connection: CockpitPresentation.Connection
    /// Which Project the panel opens on. The chip is about the window's active one.
    let projectID: CockpitPresentation.Project.ID?
    let health: ConnectionHealthReading
    let actions: CockpitActions

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            if let observation = ConnectionChipReading(observing: connection) {
                ConnectionChip(reading: observation, act: actions.retry.connection)
            }
            if let providers = ConnectionHealthProjection.chip(from: health) {
                rollUp(providers)
            }
        }
    }

    /// The roll-up, pressable whichever state it is in — because the roll-up is only honest if the
    /// per-port truth it hides is one gesture away, and the Connect panel is where that truth is:
    /// a row per port, each naming its Account and carrying its own fix.
    ///
    /// Two shapes and not one. A chip that already carries `Reconnect` cannot also BE a button —
    /// a control inside a control is two hit targets claiming one rectangle — so the escalation
    /// keeps its button and everything else becomes one.
    @ViewBuilder private func rollUp(_ reading: ConnectionChipReading) -> some View {
        if reading.action == nil {
            Button(action: open) { ConnectionChip(reading: reading, act: open) }
                .buttonStyle(.plain)
                .accessibilityLabel("\(reading.label). Show which connections are down.")
        } else {
            ConnectionChip(reading: reading, act: open)
        }
    }

    /// Reconnecting happens in the Connect panel, so the chip's one act is to open it on the
    /// Project this reading is about. There is one reconnect in this app and this is a way to REACH
    /// it, not a second one.
    private func open() {
        actions.projects.openPanel(projectID)
    }
}

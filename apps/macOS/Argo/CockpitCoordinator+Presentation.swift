import ArgoUI

/// Everything the shell renders, projected by `CockpitPresentation(pointing:hub:readings:)` —
/// which lives in ArgoUI, where a test can reach it. Nothing is derived here.
///
/// The shell's readings are an argument because both facts in them the projection needs are the
/// ACCOUNTS coordinator's: the Ticket Binding tells a Session nobody could have read a link for
/// from one nothing named a Ticket for (#894), and the Deliveries are derived through the code
/// host Binding (#1480).
@MainActor
extension CockpitCoordinator {
    func presentation(_ shell: ShellReadings) -> CockpitPresentation {
        // The reader is a CLOSURE, so a Subagent's bytes are asked for by the lane that draws them
        // rather than copied into the projection: building it reads nothing, which is the whole
        // point — a batch invalidates whatever called it and not this scene (#858).
        let reader = FeedAgentReader.reading(hub)
        let readings = CockpitPresentation.Readings(
            annotations, over: shell.health, asking: reader, deliveries: shell.deliveries,
        )
        return CockpitPresentation(pointing: pointing, hub: hub, readings: readings)
    }
}

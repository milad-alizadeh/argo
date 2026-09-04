import ArgoUI

/// Everything the shell renders, projected by `CockpitPresentation(pointing:hub:readings:)` —
/// which lives in ArgoUI, where a test can reach it. Nothing is derived here.
///
/// The health is an argument because the Ticket Binding is the ACCOUNTS coordinator's, not this
/// one's, and it is what tells a Session nobody could have read a link for from one nothing named
/// a Ticket for (#894).
@MainActor
extension CockpitCoordinator {
    func presentation(_ health: ConnectionHealthReading) -> CockpitPresentation {
        // The reader is a CLOSURE, so a Subagent's bytes are asked for by the lane that draws them
        // rather than copied into the projection: building it reads nothing, which is the whole
        // point — a batch invalidates whatever called it and not this scene (#858).
        let reader = FeedAgentReader.reading(hub)
        let readings = CockpitPresentation.Readings(annotations, over: health, asking: reader)
        return CockpitPresentation(pointing: pointing, hub: hub, readings: readings)
    }
}

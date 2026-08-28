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
        let readings = CockpitPresentation.Readings(annotations, over: health)
        return CockpitPresentation(pointing: pointing, hub: hub, readings: readings)
    }
}

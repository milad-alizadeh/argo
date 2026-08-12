@testable import ArgoEngine
import Foundation
import Testing

/// Whether a Session's composer has a command surface at all (#685).
///
/// That `claude` honours a `/command` sent this way is asserted against the real CLI in
/// `LiveCommandTests`; what is asserted here is that the answer survives the trip to the cockpit.
@Suite("Command surface")
@MainActor
struct DriveCommandSurfaceTests {
    @Test
    func `the driver a Hub hands the cockpit declares the command surface`() {
        let hub = testHub(projectURL: URL(filePath: "/tmp/argo-command-surface"))
        #expect(hub.driver.canRunCommands)
    }
}

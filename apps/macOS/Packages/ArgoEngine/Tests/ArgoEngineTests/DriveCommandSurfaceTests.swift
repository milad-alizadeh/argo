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
    /// The port has no Session to read the answer for, so it can only state what BOTH adapters do
    /// — and `codex` does not (#549). The picker is drawn per Session, so this has to become a
    /// per-Session reading before #685 can ship. Until then the joint statement is a refusal.
    @Test
    func `the driver a Hub hands the cockpit declares the command surface`() {
        let hub = testHub(projectURL: URL(filePath: "/tmp/argo-command-surface"))
        #expect(!hub.driver.canRunCommands)
    }
}

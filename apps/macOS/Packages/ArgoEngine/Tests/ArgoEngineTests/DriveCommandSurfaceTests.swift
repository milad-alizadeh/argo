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
    /// The reading is per Session because the two adapters disagree. A joint statement would refuse
    /// every `claude` Session the moment one Codex thread was reachable, which is what #698 left
    /// this suite standing on until the picker existed to need it.
    ///
    /// A Session with no Codex thread behind it routes to `claude`, which is the default this suite
    /// can reach without starting anything. The refusal on the other side is asserted against a
    /// really-spawned Codex Session in `SessionDriverConformanceTests`, where the routing is real —
    /// asking the adapter by name proved only that the adapter agreed with itself (#761).
    @Test
    func `the driver a Hub hands the cockpit declares the command surface per Session`() {
        let hub = testHub(projectURL: URL(filePath: "/tmp/argo-command-surface"))

        #expect(hub.driver.surface(of: "a-claude-session").runsCommands)
    }
}

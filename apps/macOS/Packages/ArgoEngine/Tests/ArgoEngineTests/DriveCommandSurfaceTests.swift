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
    @Test
    func `the driver a Hub hands the cockpit declares the command surface per Session`() {
        let hub = testHub(projectURL: URL(filePath: "/tmp/argo-command-surface"))
        #expect(hub.driver.canRunCommands(for: "a-claude-session"))
    }

    /// Asked of the Codex adapter by name, because routing to it needs a live thread and this suite
    /// starts nothing. It is this refusal that makes the routing worth
    /// having: stated jointly it would have taken the picker off every `claude` Session too.
    @Test
    func `the Codex adapter refuses the command surface`() {
        let hub = testHub(projectURL: URL(filePath: "/tmp/argo-command-surface"))

        #expect(!hub.channels.codex.canRunCommands(for: "a-codex-session"))
    }
}

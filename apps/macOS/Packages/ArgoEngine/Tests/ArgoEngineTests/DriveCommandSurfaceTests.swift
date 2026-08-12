@testable import ArgoEngine
import Foundation
import Testing

/// Whether a Session's composer has a command surface at all (#685) — the capability the picker is
/// drawn from, and the one it is absent from.
///
/// That `claude` really honours a `/command` sent this way is not a claim any of these can make; it
/// is asserted against the real CLI in `LiveCommandTests`. What is asserted here is that the answer
/// survives the trip to the cockpit, which is the way a declared capability actually goes wrong.
@Suite("Command surface")
@MainActor
struct DriveCommandSurfaceTests {
    @Test
    func `the driver a Hub hands the cockpit declares the command surface`() {
        let hub = testHub(projectURL: URL(filePath: "/tmp/argo-command-surface"))
        #expect(hub.driver.canRunCommands)
    }

    /// A wrapper that answered for itself would hide an adapter with no command surface behind one
    /// that has it, and the cockpit would draw a picker whose every row does nothing.
    @Test(arguments: [true, false])
    func `the wrapper carries its adapter's own answer about commands`(declared: Bool) {
        let base = InMemorySessionDriver()
        base.canRunCommands = declared
        let driver = RememberingDriver(base: base, records: { _ in 0 }, remember: { _, _ in })
        #expect(driver.canRunCommands == declared)
    }

    @Test(arguments: [true, false])
    func `the wrapper carries its adapter's own answer about attachments`(declared: Bool) {
        let base = InMemorySessionDriver()
        base.canAttach = declared
        let driver = RememberingDriver(base: base, records: { _ in 0 }, remember: { _, _ in })
        #expect(driver.canAttach == declared)
    }
}

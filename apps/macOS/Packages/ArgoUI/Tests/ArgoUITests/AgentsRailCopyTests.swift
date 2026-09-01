@testable import ArgoUI
import Testing

/// What the rail SAYS, in the reader's words rather than the model's (#1014).
///
/// A suite because a string inside a `body` is a string nothing re-checks: the rename is a
/// deliberate departure from `Subagent`, and the thing most likely to happen to it is a reader
/// putting the model's word back.
@Suite("Agents rail copy")
struct AgentsRailCopyTests {
    @Test
    func `the rail is headed with what the reader is looking at`() {
        #expect(AgentsRailCopy.header(running: 2) == "Background Agents · 2 running")
    }

    @Test
    func `no line the rail draws says subagent`() {
        #expect(!AgentsRailCopy.all.contains { $0.lowercased().contains("subagent") })
    }

    @Test
    func `the session's own reading is headed Main`() {
        #expect(AgentsRailCopy.main == "Main")
    }
}

@testable import ArgoEngine
import Foundation
import Testing

/// What the wrapper adds to the port it forwards (#545, #633): a rung is filed when it lands, and
/// only then.
///
/// Where the record is USED — a second change counted from the first rather than from a stale
/// record — is `DriveModeTests`. This suite is the narrower claim underneath it, so a wrapper that
/// stopped recording says so here rather than as a keystroke count two files away.
@Suite("Remembering driver")
@MainActor
struct RememberingDriverTests {
    /// Every act but `setMode` reaches the adapter untouched, so wrapping cannot quietly cost one.
    @Test
    func `the acts it does not record still reach the adapter`() throws {
        let base = InMemorySessionDriver()
        let driver = RememberingDriver(base: base, records: { _ in 0 }) { _, _ in }

        try driver.send("Off you go.", to: "session-a")
        try driver.revokeStandingAllow("Bash", for: "session-a")

        #expect(base.sent(to: "session-a") == ["Off you go."])
        #expect(base.revoked(for: "session-a") == ["Bash"])
        #expect(driver.canAttach == base.canAttach)
    }

    @Test
    func `a rung that landed is filed with the Session it landed on`() throws {
        let base = InMemorySessionDriver()
        var filed: [(SessionModeSet, String)] = []
        let driver = RememberingDriver(base: base, records: { _ in 0 }) { filed.append(($0, $1)) }

        try driver.setMode(.plan, for: "session-a")

        #expect(base.rungs(for: "session-a") == [.plan])
        #expect(filed.map(\.0.mode) == [.plan])
        #expect(filed.map(\.1) == ["session-a"])
    }

    /// The count is read BEFORE the walk, because the walk is no longer one write (#653): a record
    /// the walk itself provokes must not be counted as one that was already there.
    @Test
    func `the record count is the one from before the walk`() throws {
        let base = InMemorySessionDriver()
        var records = 4
        var filed: [SessionModeSet] = []
        let driver = RememberingDriver(base: base, records: { _ in records }) { set, _ in
            filed.append(set)
        }
        base.duringSetMode = { records = 9 }

        try driver.setMode(.auto, for: "session-a")

        #expect(filed.map(\.recordsWhenSet) == [4])
    }

    /// The refusal case is the whole reason the record sits behind the port rather than beside it:
    /// a rung filed for keystrokes that never went is the stale count it exists to prevent.
    @Test
    func `a refused rung is not filed`() {
        let base = InMemorySessionDriver()
        base.refusal = .modeBusy
        var filed: [SessionMode] = []
        let driver = RememberingDriver(base: base, records: { _ in 0 }) { set, _ in
            filed.append(set.mode)
        }

        #expect(throws: SessionDriveError.modeBusy) {
            try driver.setMode(.auto, for: "session-a")
        }
        #expect(filed.isEmpty)
    }
}

@testable import ArgoEngine
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
        let driver = RememberingDriver(
            base: base, records: { _ in 0 }, remember: { _, _ in }, rememberRun: { _ in },
        )

        try driver.send("Off you go.", to: "session-a")
        try driver.revokeStandingAllow("Bash", for: "session-a")

        #expect(base.sent(to: "session-a") == ["Off you go."])
        #expect(base.revoked(for: "session-a") == ["Bash"])
    }

    /// A wrapper that answered for itself would hide an adapter with no command surface behind one
    /// that has it, and the cockpit would draw a picker whose every row does nothing (#685). Both
    /// answers, because a hard-coded `true` passes a test that only ever asks for `true`.
    @Test(arguments: [true, false])
    func `it carries its adapter's own declared surface`(declared: Bool) {
        let base = InMemorySessionDriver()
        base.declaredSurface = DriveSurface(
            takesAttachments: declared, runsCommands: declared, resolvesMentions: declared,
        )
        let driver = RememberingDriver(
            base: base, records: { _ in 0 }, remember: { _, _ in }, rememberRun: { _ in },
        )

        #expect(driver.surface(of: "s1") == base.declaredSurface)
    }

    @Test
    func `a rung that landed is filed with the Session it landed on`() async throws {
        let base = InMemorySessionDriver()
        var filed: [(SessionModeSet, String)] = []
        let driver = RememberingDriver(
            base: base, records: { _ in 0 }, remember: { filed.append(($0, $1)) },
            rememberRun: { _ in },
        )

        try await driver.setMode(.plan, for: "session-a")

        #expect(base.rungs(for: "session-a") == [.plan])
        #expect(filed.map(\.0.mode) == [.plan])
        #expect(filed.map(\.1) == ["session-a"])
    }

    /// The count is read BEFORE the walk, because the walk is no longer one write (#653): a record
    /// the walk itself provokes must not be counted as one that was already there.
    @Test
    func `the record count is the one from before the walk`() async throws {
        let base = InMemorySessionDriver()
        var records = 4
        var filed: [SessionModeSet] = []
        let driver = RememberingDriver(
            base: base, records: { _ in records }, remember: { set, _ in filed.append(set) },
            rememberRun: { _ in },
        )
        base.duringSetMode = { records = 9 }

        try await driver.setMode(.auto, for: "session-a")

        #expect(filed.map(\.recordsWhenSet) == [4])
    }

    /// The refusal case is the whole reason the record sits behind the port rather than beside it:
    /// a rung filed for keystrokes that never went is the stale count it exists to prevent.
    @Test
    func `a refused rung is not filed`() async {
        let base = InMemorySessionDriver()
        base.refusal = .modeBusy
        var filed: [SessionMode] = []
        let driver = RememberingDriver(
            base: base, records: { _ in 0 }, remember: { set, _ in filed.append(set.mode) },
            rememberRun: { _ in },
        )

        await #expect(throws: SessionDriveError.modeBusy) {
            try await driver.setMode(.auto, for: "session-a")
        }
        #expect(filed.isEmpty)
    }

    /// A Model or an Effort is remembered APP-WIDE and against no Session (#1175) — the pick alone,
    /// where the rung above files a Session id beside it.
    @Test
    func `a Model and an Effort that landed are filed as picks`() async throws {
        let base = InMemorySessionDriver()
        base.declaredSurface = DriveSurface(
            takesAttachments: true, runsCommands: true, resolvesMentions: true, chooses: .both,
        )
        var picked: [SessionRunPick] = []
        let driver = RememberingDriver(
            base: base, records: { _ in 0 }, remember: { _, _ in },
            rememberRun: { picked.append($0) },
        )

        try await driver.setModel("sonnet", for: "session-a")
        try await driver.setEffort(.high, for: "session-a")

        #expect(picked == [.model("sonnet"), .effort(.high)])
    }

    /// A pick the port refused is not one the next New Session should open on, which is the whole
    /// reason the file is written after the call rather than before it.
    @Test
    func `a Model the adapter refuses is not filed`() async throws {
        let base = InMemorySessionDriver()
        base.declaredSurface = DriveSurface(
            takesAttachments: true, runsCommands: true, resolvesMentions: true,
        )
        var picked: [SessionRunPick] = []
        let driver = RememberingDriver(
            base: base, records: { _ in 0 }, remember: { _, _ in },
            rememberRun: { picked.append($0) },
        )

        await #expect(throws: SessionDriveError.runFactsUnsupported) {
            try await driver.setModel("sonnet", for: "session-a")
        }

        #expect(picked.isEmpty)
    }
}

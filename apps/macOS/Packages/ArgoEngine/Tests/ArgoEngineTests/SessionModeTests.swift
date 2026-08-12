@testable import ArgoEngine
import Testing

/// The ladder against the one CLI Argo can spawn. Verified against `claude` 2.1.227 on
/// 2026-08-11: `--permission-mode` takes `manual` where ADR-0025's table said `default`, and the
/// transcript still writes `default`, so both spellings have to read.
@Suite("Session mode")
struct SessionModeTests {
    @Test
    func `each rung names the claude value that sets it`() {
        #expect(ClaudePermissionMode.value(for: .readOnly) == "plan")
        // Plan and Read Only SET the same boundary — the difference is the intent Argo holds.
        #expect(ClaudePermissionMode.value(for: .plan) == "plan")
        #expect(ClaudePermissionMode.value(for: .code) == "acceptEdits")
        #expect(ClaudePermissionMode.value(for: .auto) == "auto")
    }

    @Test
    func `the three exact values read back as their own rung`() {
        #expect(ClaudePermissionMode.reading(of: "plan") == .exactly(.readOnly, cli: "plan"))
        #expect(ClaudePermissionMode.reading(of: "acceptEdits") == .exactly(
            .code,
            cli: "acceptEdits",
        ))
        #expect(ClaudePermissionMode.reading(of: "auto") == .exactly(.auto, cli: "auto"))
    }

    /// Nearest is judged by what the Session does with nobody answering prompts: `manual` reads and
    /// waits, so its standing stance is Read Only's.
    @Test
    func `a value with no rung of its own reads as the nearest rung, marked`() {
        let manual = ClaudePermissionMode.reading(of: "manual")
        #expect(manual == .nearly(.readOnly, cli: "manual"))
        #expect(manual.isApproximate)
        #expect(ClaudePermissionMode.reading(of: "default") == .nearly(.readOnly, cli: "default"))
        #expect(ClaudePermissionMode.reading(of: "bypassPermissions") == .nearly(
            .auto,
            cli: "bypassPermissions",
        ))
    }

    /// `dontAsk`'s boundary is an allowlist Argo cannot see, so two Sessions in it can sit at
    /// opposite ends of the ladder. A rung would be a guess.
    @Test
    func `dontAsk and an unrecognised value are unknown, not a nearest rung`() {
        #expect(ClaudePermissionMode.reading(of: "dontAsk") == .unknown(cli: "dontAsk"))
        #expect(ClaudePermissionMode.reading(of: "somethingNew") == .unknown(cli: "somethingNew"))
        #expect(ClaudePermissionMode.reading(of: "dontAsk").rung == nil)
    }

    /// The rung is Argo's word for the boundary; the CLI's own word is kept beside it, because that
    /// is what the approximation is measured against and what the tooltip states.
    @Test
    func `every reading keeps the CLI's own value verbatim`() {
        #expect(ClaudePermissionMode.reading(of: "acceptEdits").cliValue == "acceptEdits")
        #expect(ClaudePermissionMode.reading(of: "manual").cliValue == "manual")
        #expect(ClaudePermissionMode.reading(of: "dontAsk").cliValue == "dontAsk")
    }

    /// Read Only and Plan set one boundary, so a cycle to either lands on the same value — which is
    /// why an observed `plan` can never be read back as Plan.
    @Test
    func `the shift+tab ring is the one claude 2_1_227 cycles`() {
        #expect(ClaudePermissionMode.ring == ["auto", "manual", "acceptEdits", "plan"])
    }

    /// A set stands only until a record is written AFTER it. Nothing has been here, so the rung
    /// Argo asked for is the later of the two facts and there is nothing to correct.
    @Test
    func `a rung with no record since stands, and says nothing did not take`() {
        var session = Self.spawned(on: .code)
        session.apply(.mode(cli: "acceptEdits"))
        session.modeSet = SessionModeSet(mode: .auto, recordsWhenSet: session.observedModeCount)

        #expect(session.mode == .exactly(.auto, cli: "auto"))
        #expect(session.modeDidNotTake == nil)
    }

    /// The record spoke after the set and agreed. The reading is the record's from here on, and
    /// still nothing to correct.
    @Test
    func `a rung the record confirms is simply the rung`() {
        var session = Self.spawned(on: .code)
        session.apply(.mode(cli: "acceptEdits"))
        session.modeSet = SessionModeSet(mode: .auto, recordsWhenSet: session.observedModeCount)
        session.apply(.mode(cli: "auto"))

        #expect(session.mode == .exactly(.auto, cli: "auto"))
        #expect(session.modeDidNotTake == nil)
    }

    /// The bug this pair exists for (#629): the record spoke after the set and repeated the OLD
    /// value. Compared by value that is indistinguishable from a record that has not caught up, and
    /// Argo would go on drawing a rung nobody is standing on.
    @Test
    func `a rung the record contradicts snaps back and says which one did not take`() {
        var session = Self.spawned(on: .code)
        session.apply(.mode(cli: "acceptEdits"))
        session.modeSet = SessionModeSet(mode: .auto, recordsWhenSet: session.observedModeCount)
        session.apply(.mode(cli: "acceptEdits"))

        #expect(session.mode == .exactly(.code, cli: "acceptEdits"))
        #expect(session.modeDidNotTake == .auto)
    }

    /// Plan is the one rung the CLI cannot report, so a record answering `plan` after a Plan was
    /// set is agreement and not contradiction.
    @Test
    func `Plan confirmed by the boundary it shares is not a rung that did not take`() {
        var session = Self.spawned(on: .code)
        session.apply(.mode(cli: "acceptEdits"))
        session.modeSet = SessionModeSet(mode: .plan, recordsWhenSet: session.observedModeCount)
        session.apply(.mode(cli: "plan"))

        #expect(session.mode == .exactly(.plan, cli: "plan"))
        #expect(session.modeDidNotTake == nil)
    }

    private static func spawned(on mode: SessionMode) -> HubSession {
        HubSession(spawn: AgentSpawn(
            claim: .init(value: "claim-1"),
            cli: .claude,
            cwd: "/tmp",
            spawnedAtMs: 0,
            mode: mode,
        ))
    }
}

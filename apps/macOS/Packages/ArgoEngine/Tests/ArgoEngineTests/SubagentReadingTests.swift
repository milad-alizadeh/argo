@testable import ArgoEngine
import Testing

/// A Subagent read two ways: named by the call that started it, and read as the subject of its own
/// record. The same reader does both, and which one it is doing decides four guards.
@Suite("Subagent reading")
struct SubagentReadingTests {
    private func outcomes(in name: String) async throws -> [ToolCallOutcome] {
        try await Fixture.events(name).compactMap { event in
            guard case let .toolCallOutcome(outcome) = event else { return nil }
            return outcome
        }
    }

    /// The join key, and the only one there is: the Subagent's own file is named for this string,
    /// and nothing else in the parent's record ties a file to the call that started it.
    @Test
    func `a delegating call names the Subagent it started`() async throws {
        #expect(try await outcomes(in: "delegationAgent").map(\.subagentID)
            == ["a4a7ffa1285ef5be4"])
    }

    /// An ordinary call started no Subagent, so there is nothing to name — and a call that reported
    /// one is how the rail tells a delegation from every other line of work.
    @Test
    func `a call that started no Subagent names none`() async throws {
        #expect(try await outcomes(in: "commands").allSatisfy { $0.subagentID == nil })
    }

    /// The host measures the child's whole run and states it beside the spend. Read from there and
    /// not from `endedAtMs - atMs`: those are the parent's own clock readings, and a record with no
    /// timestamp leaves that subtraction with nothing to work from.
    @Test
    func `a delegating call reports how long its Subagent ran`() async throws {
        #expect(try await outcomes(in: "delegationAgent").map(\.reportedDurationMs) == [223_591])
    }

    /// Read as a Session, every record in a Subagent's file is a sidechain, so the guards that keep
    /// a child's facts off its parent would leave this reading with no Turn boundary at all.
    @Test
    func `a Subagent's own reading keeps the Turn its record ended`() async throws {
        let ended = try await subagentEvents("subagentOwn").filter { event in
            guard case .turnEnded = event else { return false }
            return true
        }

        #expect(ended == [.turnEnded(.endTurn)])
    }

    @Test
    func `a Subagent's own reading keeps what it spent`() async throws {
        let spends = try await subagentEvents("subagentOwn").compactMap { event -> Usage? in
            guard case let .usage(usage) = event else { return nil }
            return usage
        }

        #expect(spends.map(\.inputTokens) == [900])
    }

    /// The Plan is Session-scoped (ADR-0020), which is why a delegate's list is kept off its
    /// parent's pill. Its own reading is the one place that list belongs.
    @Test
    func `a Subagent's own reading keeps the Plan it wrote`() async throws {
        let plans = try await subagentEvents("subagentOwn").compactMap { event -> Plan? in
            guard case let .plan(plan) = event else { return nil }
            return plan
        }

        #expect(plans.last?.entries.map(\.text) == ["Read the issue", "Read the diff"])
    }

    /// The other side of the same switch, and the regression the four guards exist for: read as a
    /// Session, that file's records are a child's and none of the three facts is the reading's own.
    @Test
    func `the same file read as a Session attributes none of it`() async throws {
        let events = try await Fixture.events("subagentOwn")

        #expect(!events.contains(TranscriptEvent.turnEnded(.endTurn)))
        #expect(!events.contains { event in
            guard case .usage = event else { return false }
            return true
        })
        #expect(!events.contains { event in
            guard case .plan = event else { return false }
            return true
        })
    }

    private func subagentEvents(_ name: String) async throws -> [TranscriptEvent] {
        try await TranscriptReader(subject: .subagent).read(lines: Fixture.lines(name))
    }
}

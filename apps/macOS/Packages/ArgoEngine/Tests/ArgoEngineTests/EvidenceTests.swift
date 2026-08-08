@testable import ArgoEngine
import Testing

// What a resolved call is read AS, and what a row keeps of it. Every assertion here is an equality
// against the fixture's own characters, because "preserved" is the claim and a normalized reading
// would pass a looser one. The two readings with a tier ladder of their own — diff and media — have
// their own suites.

@Suite("Evidence")
struct EvidenceTests {
    @Test
    func `A command's output is carried verbatim`() async throws {
        let outcomes = try await Fixture.events("commands").outcomes()
        let failed = try #require(outcomes["call-bash-bad"])

        #expect(failed.status == .failed)
        guard case let .output(output) = try #require(failed.result) else {
            Issue.record("a failed command carries what it printed")
            return
        }
        #expect(output.tier == .direct)
        #expect(output.text == "src/x.ts(4,1): error TS2345")
    }

    /// A read's payload is the file as the AGENT saw it, and it is kept for the same reason media
    /// bytes are: re-reading the path later shows what the file says now, which after three edits
    /// in
    /// one turn is a different file. It is the engine's largest payload and it is held anyway.
    @Test
    func `A successful read keeps what the agent was looking at`() async throws {
        let outcomes = try await Fixture.events("commands").outcomes()
        guard case let .output(output) = try #require(outcomes["call-read-ok"]).result else {
            Issue.record("a read carries the content it returned")
            return
        }

        #expect(output.tier == .direct)
        #expect(output.text == "1\texport const token = 1")
    }

    @Test
    func `A delegate's result belongs to the subagent, not to the delegating call`() async throws {
        let outcomes = try await Fixture.events("treeFull").outcomes()
        #expect(try #require(outcomes["call-bare"]).result == nil)
    }

    @Test
    func `The spend a result reports rides on the outcome`() async throws {
        let events = try await Fixture.events("treeFull")
        let calls = events.compactMap { event -> ToolCall? in
            guard case let .toolCall(call) = event else { return nil }
            return call
        }

        #expect(calls.map(\.name).contains("Task"))
        #expect(calls.first { $0.id == "call-read" }?.kind == .read)
        #expect(calls.first { $0.id == "call-todo" }?.kind == .plan)
        #expect(calls.first { $0.id == "call-task" }?.kind == .delegate)
    }
}

extension [TranscriptEvent] {
    /// Every resolved call, by id — the shape most assertions here want.
    func outcomes() -> [String: ToolCallOutcome] {
        reduce(into: [:]) { found, event in
            guard case let .toolCallOutcome(outcome) = event else { return }
            found[outcome.id] = outcome
        }
    }
}

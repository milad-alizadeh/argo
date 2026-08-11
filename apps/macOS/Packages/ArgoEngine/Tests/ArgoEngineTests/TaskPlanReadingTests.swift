@testable import ArgoEngine
import Testing

/// The plan, read off a host that writes it ONE ENTRY AT A TIME.
///
/// `TodoWrite` handed the whole list over on every write, which is the shape ADR-0020 was written
/// against. Claude Code writes `TaskCreate`/`TaskUpdate` instead, so the list only exists as the
/// fold of every write before it — and the claim every test here makes is that the fold happens in
/// the reader, so what leaves it is still one whole list per write and nothing downstream can tell
/// which host wrote it.
@Suite("Task plan reading")
struct TaskPlanReadingTests {
    private func plans() async throws -> [Plan] {
        try await Fixture.events("taskWritten").compactMap { event -> Plan? in
            guard case let .plan(plan) = event else { return nil }
            return plan
        }
    }

    private func calls() async throws -> [String: ToolCall] {
        try await Fixture.events("taskWritten").reduce(into: [:]) { found, event in
            guard case let .toolCall(call) = event else { return }
            found[call.id] = call
        }
    }

    @Test
    func `a list written one entry at a time is read as one list`() async throws {
        let plan = try #require(await plans().last)

        #expect(plan.entries.map(\.text) == ["Read the record", "Fold the writes", "Open the PR"])
        #expect(plan.entries.map(\.status) == [.completed, .completed, .pending])
    }

    /// The point of folding in the reader: every write reports the WHOLE list, so the newest plan
    /// is still the whole of it and `PlanProjection` goes on taking the last one it sees.
    @Test
    func `every write reports the whole list, not the entry it changed`() async throws {
        let plans = try await plans()

        #expect(plans.map(\.entries.count) == [1, 2, 2, 2, 3, 3])
    }

    /// The id is joined from the result the create came back with. Read off creation ORDER instead,
    /// the second entry would have been `2` — and the update naming `7` would have landed on
    /// nothing, or worse, on somebody else.
    @Test
    func `an entry is keyed by the id its result reported, never by its place in the list`(
    ) async throws {
        let afterSecondUpdate = try #require(await plans().dropFirst(3).first)

        #expect(afterSecondUpdate.entries.map(\.status) == [.inProgress, .completed])
    }

    /// Three writes that change nothing sit in the fixture between the ones that do — an update
    /// naming a task nobody created, one that only rewords, and a `TaskStop`, which belongs to a
    /// background agent task and not to this list at all. Six plans out of nine writes is the
    /// claim.
    @Test
    func `a write that changes nothing reports nothing`() async throws {
        #expect(try await plans().count == 6)
    }

    /// An entry with no subject is dropped rather than shown blank — the same reading a `TodoWrite`
    /// entry with no `content` already gets.
    @Test
    func `a task with nothing on it never joins the list`() async throws {
        #expect(try await plans().allSatisfy { !$0.entries.contains { $0.text.isEmpty } })
        #expect(try await plans().last?.entries.count == 3)
    }

    /// A create whose result never landed has no id, so nothing can address it. It is still ON the
    /// list — the agent wrote it down — and the update naming an id it never got moves nothing.
    @Test
    func `an entry the record never gave an id is on the list and cannot be updated`() async throws {
        let plan = try #require(await plans().last)

        #expect(plan.entries.last?.text == "Open the PR")
        #expect(plan.entries.last?.status == .pending)
    }

    /// The pill draws what these calls wrote, so the feed must not draw them as well — which is
    /// what the `plan` kind means (`FeedCallReading`). `TaskStop` is not one of them: stopping a
    /// background task is news, and it keeps whatever kind its own name earns.
    @Test
    func `the tools that write the list are read as plan calls, and TaskStop is not`() async throws {
        #expect(try await calls()["create-first"]?.kind == .plan)
        #expect(try await calls()["update-first"]?.kind == .plan)
        #expect(try await calls()["stop-background"]?.kind == .other)
    }
}

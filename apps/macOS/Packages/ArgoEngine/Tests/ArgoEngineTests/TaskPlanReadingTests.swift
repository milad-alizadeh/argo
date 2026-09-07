@testable import ArgoEngine
import Testing

/// The plan, read off a host that writes it ONE ENTRY AT A TIME (`PlanLedger` says why the fold
/// exists and where it sits).
///
/// The fold ends at the reader: what leaves it is one whole list per write, so nothing downstream
/// can tell which host wrote the record.
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

    /// Every write reports the WHOLE list, so `PlanProjection` goes on taking the last one it sees.
    ///
    /// Six snapshots out of the fixture's eleven writes: the five that report nothing wrote nothing
    /// to this list — a create with no subject, an update naming a task nobody created, one that
    /// only rewords, a `TaskList`, and a `TaskStop`.
    @Test
    func `every write reports the whole list, and a write that changes nothing reports none`(
    ) async throws {
        let plans = try await plans()

        #expect(plans.map(\.entries.count) == [1, 2, 2, 2, 3, 3])
    }

    /// The id is joined from the result the create came back with. Read off creation ORDER instead,
    /// the second entry would have been `2` and the update naming `7` would have landed on nothing.
    @Test
    func `an entry is keyed by the id its result reported, never by its place in the list`(
    ) async throws {
        let afterSecondUpdate = try #require(await plans().dropFirst(3).first)

        #expect(afterSecondUpdate.entries.map(\.status) == [.inProgress, .completed])
    }

    /// An entry with no subject is dropped rather than shown blank — the same reading a `TodoWrite`
    /// entry with no `content` already gets.
    @Test
    func `a task with nothing on it never joins the list`() async throws {
        #expect(try await plans().allSatisfy { !$0.entries.contains { $0.text.isEmpty } })
    }

    /// The Plan is Session-scoped (ADR-0020), and an incremental list is never replaced whole by
    /// the next write — so a delegate's step folded in here would sit on the pill for good.
    @Test
    func `a subagent's own list is not folded into the Session's`() async throws {
        let plan = try #require(await plans().last)

        #expect(!plan.entries.contains { $0.text == "A delegate's own step" })
    }

    /// A create whose result never landed has no id, so nothing can address it. It is still ON the
    /// list — the agent wrote it down — and the update naming an id it never got moves nothing.
    @Test
    func `an entry the record never gave an id is on the list and cannot be updated`() async throws {
        let plan = try #require(await plans().last)

        #expect(plan.entries.last?.text == "Open the PR")
        #expect(plan.entries.last?.status == .pending)
    }

    /// The `plan` kind means the feed draws no row (`FeedCallReading`), so only the two that WRITE
    /// earn it: `TaskList` reads the list and `TaskStop` ends a background agent task.
    @Test
    func `only the tools that write the list are read as plan calls`() async throws {
        #expect(try await calls()["create-first"]?.kind == .plan)
        #expect(try await calls()["update-first"]?.kind == .plan)
        #expect(try await calls()["list-read"]?.kind == .other)
        #expect(try await calls()["stop-background"]?.kind == .other)
    }

    /// A file is read twice over — once for its plan writes alone (`TranscriptPlanScan`), then for
    /// its two ends — so a record reaches the ledger twice. Folding the second copy would append a
    /// second entry for the same create (#1594).
    @Test
    func `a create read twice writes one entry`() {
        var ledger = PlanLedger()
        let use = Self.creating("call-1", subject: "Read the record")
        let first = ledger.written(by: use)

        let second = ledger.written(by: use)

        #expect(first?.entries.map(\.text) == ["Read the record"])
        #expect(second == nil)
    }

    /// And the worse half of the same hazard: an update read again after a LATER one has landed
    /// takes the entry's status back to what it said. A status that walked backwards is a Plan
    /// nobody can read progress from.
    @Test
    func `an update read again after a later one moves nothing`() {
        var ledger = PlanLedger()
        _ = ledger.written(by: Self.creating("call-1", subject: "Read the record"))
        ledger.identify(call: "call-1", from: Self.reportedID("7"))
        let started = Self.updating("call-2", taskID: "7", status: "in_progress")
        _ = ledger.written(by: started)
        let finished = ledger.written(by: Self.updating("call-3", taskID: "7", status: "completed"))

        #expect(ledger.written(by: started) == nil)
        #expect(finished?.entries.map(\.status) == [.completed])
    }

    /// `TodoWrite` hands the whole list over and needs no fold, but it is folded ONCE all the same.
    /// A file is read twice over, and a whole-list write re-read out of the file's head would be
    /// emitted after the scanned list and supersede it with an older one (#1594).
    @Test
    func `a whole-list write read twice reports one list`() {
        var ledger = PlanLedger()
        let use = ToolUseBlock(
            id: "call-1",
            name: planTool,
            input: .object(["todos": .array([.object([
                "content": .string("Read the record"),
                "status": .string("completed"),
            ])])]),
        )
        let first = ledger.written(by: use)

        let second = ledger.written(by: use)

        #expect(first?.entries.map(\.text) == ["Read the record"])
        #expect(second == nil)
    }

    private static func creating(_ id: String, subject: String) -> ToolUseBlock {
        ToolUseBlock(id: id, name: taskCreateTool, input: .object(["subject": .string(subject)]))
    }

    private static func updating(_ id: String, taskID: String, status: String) -> ToolUseBlock {
        ToolUseBlock(
            id: id,
            name: taskUpdateTool,
            input: .object(["taskId": .string(taskID), "status": .string(status)]),
        )
    }

    private static func reportedID(_ id: String) -> JSONValue {
        .object(["task": .object(["id": .string(id)])])
    }
}

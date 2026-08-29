@testable import ArgoEngine
import Testing

// A finished background agent's report is filed as an ordinary user record, so the reader that
// takes a user record at face value titles a Turn with an XML envelope (#825). The report is not a
// prompt and not a call of its own: it is the DELEGATING call's outcome, arriving late.
//
// The fixture keeps the real record's `origin` field, which no reading here touches: the envelope
// itself is what the reader is held to, so the fixture must not become the reason it passes.

@Suite("Task notification reading")
struct TaskNotificationReadingTests {
    private func events() async throws -> [TranscriptEvent] {
        try await Fixture.events("taskNotification")
    }

    private func prompts() async throws -> [String] {
        try await events().compactMap { event -> String? in
            guard case let .prompt(text, _, _) = event else { return nil }
            return text
        }
    }

    /// Every outcome one call was given, in the order the records wrote them.
    private func outcomes(of callID: String) async throws -> [ToolCallOutcome] {
        try await events().compactMap { event -> ToolCallOutcome? in
            guard case let .toolCallOutcome(outcome) = event, outcome.id == callID else {
                return nil
            }
            return outcome
        }
    }

    private func report(of outcome: ToolCallOutcome) throws -> OutputEvidence {
        guard case let .output(output) = try #require(outcome.result) else {
            throw NotPrinted()
        }
        return output
    }

    private struct NotPrinted: Error {}

    private typealias Stood = (call: ToolCall, outcome: ToolCallOutcome)

    /// The row an unjoinable report stood up for itself, addressed by the summary it carries.
    private func standalone(summarising summary: String) async throws -> Stood {
        let read = try await events()
        let call = try #require(read.compactMap { event -> ToolCall? in
            guard case let .toolCall(call) = event, call.narration == summary else { return nil }
            return call
        }.first)
        return try (call, #require(read.outcomes()[call.id]))
    }

    @Test
    func `A notification opens no Turn and renders no prompt`() async throws {
        let read = try await prompts()

        #expect(!read.contains { $0.hasPrefix("<task-notification>") })
        #expect(!read.contains { $0.contains("<status>completed</status>") })
    }

    @Test
    func `The report is the delegating call's work, attached by its tool-use id`() async throws {
        let outcome = try await #require(events().outcomes()["n-call-agent"])

        #expect(outcome.status == .completed)
        #expect(try report(of: outcome).text.hasPrefix("## Xcode-fidelity minimap"))
    }

    @Test
    func `The report reads DERIVED, as an external record's words must`() async throws {
        let outcome = try await #require(events().outcomes()["n-call-agent"])

        // The words are read off a record Argo does not own, so the tier degrades down from the
        // DIRECT a tool result printed into this file would carry.
        #expect(try report(of: outcome).tier == .derived)
    }

    @Test
    func `A status other than completed reads as a failed call`() async throws {
        let outcome = try await #require(events().outcomes()["n-call-task"])

        #expect(outcome.status == .failed)
        #expect(try report(of: outcome).text == "The agent stopped before it could report.")
    }

    @Test
    func `The last of several notifications for one call is the one that stands`() async throws {
        // Three records answer this call — the launch result and two notifications — and the LAST
        // is what every surface reads, because they all key an outcome by its call's id.
        let given = try await outcomes(of: "n-call-agent")
        #expect(given.count == 3)

        let standing = try await #require(events().outcomes()["n-call-agent"])
        #expect(try report(of: standing).text.contains("The resumed agent answered the follow-up."))
    }

    @Test
    func `The Subagent's id survives a report replacing the one before it`() async throws {
        let outcome = try await #require(events().outcomes()["n-call-agent"])

        // The notification names the same `agentId` the launch result reported. Dropped here, the
        // join key onto the delegate's own transcript would go with the outcome it replaced.
        #expect(outcome.subagentID == "a6198311a6979b60e")
    }

    @Test
    func `A report lands on no call this file never opened`() async throws {
        // Invented onto that id, the outcome would claim a join Argo cannot make.
        #expect(try await events().outcomes()["n-call-in-another-file"] == nil)
    }

    @Test
    func `That report is drawn all the same, rather than dropped`() async throws {
        let stood = try await standalone(summarising: "Agent \"Resumed chain\" finished")

        #expect(try report(of: stood.outcome).text == "A report for a call this file never opened.")
    }

    @Test
    func `A notification carrying no tool-use id is still never a prompt`() async throws {
        // The envelope is recognisable at its head whatever else it carries; a missing id says the
        // report cannot be JOINED, never that the user typed the XML (#945).
        let read = try await prompts()

        #expect(!read.contains { $0.contains("a1e1f7432a058b0fe") })
        #expect(!read.contains { $0.contains("Monitor event") })
    }

    @Test
    func `An unjoinable report stands as a row of its own`() async throws {
        let stood = try await standalone(summarising: "Agent \"Implement ticket 899\" finished")

        #expect(stood.outcome.status == .completed)
        let text = try report(of: stood.outcome).text
        #expect(text == "The failing test is a pre-existing flake on main.")
        // The words are still read off a record Argo does not own.
        #expect(try report(of: stood.outcome).tier == .derived)
        // Never a delegation, which the Agents rail lifts a child from, and never the delegate's
        // spend, which the envelope states in a shape no reading here can fill.
        #expect(stood.call.kind == .other)
        #expect(stood.call.name == "background agent")
        #expect(stood.outcome.usage == nil)
    }

    @Test
    func `One agent reporting twice is two rows, not one overwritten`() async throws {
        // A notification says in its own text that it fires again for the same task. Addressed by
        // the task rather than by the record, the second report would replace the first.
        let rows = try await events().compactMap { event -> ToolCall? in
            guard case let .toolCall(call) = event,
                  call.narration == "Agent \"Implement ticket 899\" finished"
            else { return nil }
            return call
        }

        #expect(rows.count == 2)
        #expect(rows[0].id != rows[1].id)
    }

    @Test
    func `A joined report stating no status is not read as a failure either`() async throws {
        let outcome = try await #require(events().outcomes()["n-call-quiet"])

        #expect(outcome.status == .completed)
    }

    @Test
    func `A notification stating no status claims no failure`() async throws {
        // A monitor's mid-run event states none. Read as one, every such report would be drawn as
        // an agent that fell over.
        let stood = try await standalone(summarising: "Monitor event: \"PR 651 CI checks landing\"")

        #expect(stood.outcome.status == .completed)
        #expect(try report(of: stood.outcome).text.hasSuffix("ALL CHECKS DONE"))
    }

    @Test
    func `A prompt that merely quotes the word is still a prompt`() async throws {
        #expect(try await prompts().contains(
            "The reader draws the whole <task-notification> envelope as my own words — fix that",
        ))
    }

    @Test
    func `An async launch reads as the call starting, not as the call ending`() async throws {
        let launch = try await #require(outcomes(of: "n-call-agent").first)

        // The receipt names `async_launched`, which resolves nothing: the agent it started is
        // still working, and the report that ends it arrives later as an outcome of its own.
        #expect(launch.status == .inProgress)
    }

    /// Unlike a synchronous result, which names the agent only once it is over — so a chip for a
    /// backgrounded agent has the key its reading is scoped by from the moment it starts.
    @Test
    func `An async launch names its agent up front`() async throws {
        let launch = try await #require(outcomes(of: "n-call-agent").first)

        #expect(launch.subagentID == "a6198311a6979b60e")
    }

    /// The receipt states what was HANDED OVER, never what it cost — and the report that ends it
    /// states a token total Argo will not read as a spend. So a backgrounded agent reports neither,
    /// at either end, and the chip has nothing to draw.
    @Test
    func `An async launch reports no spend and no duration`() async throws {
        let launch = try await #require(outcomes(of: "n-call-agent").first)

        #expect(launch.usage == nil)
        #expect(launch.reportedDurationMs == nil)
    }

    @Test
    func `The launch result stays suppressed`() async throws {
        let launch = try await #require(outcomes(of: "n-call-agent").first)

        // Internal metadata that says in its own text never to quote it, already refused by the
        // `delegate` guard in `evidence(for:)` and refused still.
        #expect(launch.result == nil)
    }
}

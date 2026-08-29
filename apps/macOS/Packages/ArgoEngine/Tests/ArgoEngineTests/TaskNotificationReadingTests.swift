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
    func `A notification naming no call this file opened is dropped, not invented`() async throws {
        let read = try await events()

        #expect(read.outcomes()["n-call-in-another-file"] == nil)
        #expect(!read.contains {
            guard case let .toolCall(call) = $0 else { return false }
            return call.id == "n-call-in-another-file"
        })
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

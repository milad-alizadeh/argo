@testable import ArgoEngine
import Testing

// A finished background agent's report is filed as an ordinary user record, so the reader that
// takes a user record at face value titles a Turn with an XML envelope (#825). The report is not a
// prompt and not a call of its own: it is the DELEGATING call's outcome, arriving late.

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

    private func printed(_ outcome: ToolCallOutcome) throws -> String {
        guard case let .output(output) = try #require(outcome.result) else {
            Issue.record("a finished agent's report is what its call printed")
            return ""
        }
        return output.text
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
        #expect(try printed(outcome).hasPrefix("## Xcode-fidelity minimap"))
        // DERIVED: the words are read off an external record rather than owned by Argo.
        guard case let .output(output) = try #require(outcome.result) else { return }
        #expect(output.tier == .derived)
    }

    @Test
    func `A status other than completed reads as a failed call`() async throws {
        let outcome = try await #require(events().outcomes()["n-call-task"])

        #expect(outcome.status == .failed)
        #expect(try printed(outcome) == "The agent stopped before it could report.")
    }

    @Test
    func `A second notification replaces the first rather than adding a row`() async throws {
        let read = try await events()
        let forCall = read.filter {
            guard case let .toolCallOutcome(outcome) = $0 else { return false }
            return outcome.id == "n-call-agent"
        }

        // Three records name this call — the launch result and two notifications — and the LAST
        // report wins, because a resumed agent notifies again with more to say.
        #expect(forCall.count == 3)
        let outcome = try #require(read.outcomes()["n-call-agent"])
        #expect(try printed(outcome).contains("The resumed agent answered the follow-up."))
        // The Subagent join key survives the replacement: the notification names the same
        // `agentId` the launch result reported, and dropping it would orphan the delegate.
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
    func `The launch result stays suppressed`() async throws {
        let read = try await events()
        let launch = try #require(read.compactMap { event -> ToolCallOutcome? in
            guard case let .toolCallOutcome(outcome) = event,
                  outcome.id == "n-call-agent" else { return nil }
            return outcome
        }.first)

        // Internal metadata that says in its own text never to quote it, already refused by the
        // `delegate` guard in `evidence(for:)` and refused still.
        #expect(launch.result == nil)
    }
}

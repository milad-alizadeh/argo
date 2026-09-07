@testable import ArgoEngine
import Testing

/// The record's own account of a `!` command the CLI ran ITSELF (#1595) — see `promptEvents`.
///
/// Its own suite beside `LocalCommandReadingTests` because the two records are what differ: a
/// local command is heard and answered in one, and a shell command asks in one and prints in
/// another, minutes later.
@Suite("Shell command reading")
struct ShellTurnReadingTests {
    @Test
    func `the asked command reads as the line the reader typed, not as markup`() async throws {
        let events = try await Fixture.events("shellCommandTurn")

        #expect(events.contains(
            .prompt(
                text: "! gh auth refresh -h github.com -s admin:repo_hook",
                images: [],
                atMs: 1_788_598_806_000,
            ),
        ))
    }

    /// The whole of the ticket: nothing between the two records says the command is over, so a
    /// Session waiting on one is working rather than idle.
    @Test
    func `a command that has not printed yet holds its Turn open`() async throws {
        // The same file as it stands while the command is still running: everything the CLI has
        // written by then is everything but the record it writes when the command exits.
        let running = try Fixture.lines("shellCommandTurn").filter { !$0.contains("bash-stdout") }
        var session = HubSession(observation: hubTestObservation(id: "shell", events: []))
        for event in try await TranscriptReader().read(lines: running) {
            session.apply(event)
        }

        #expect(session.signals.turnOpen)
    }

    @Test
    func `what the command printed reads as its output, and ends the Turn`() async throws {
        let events = try await Fixture.events("shellCommandTurn")

        let ending = events.suffix(3)
        #expect(ending.last == .turnEnded(.endTurn))
        #expect(ending.contains { event in
            guard case let .toolCall(call) = event else { return false }
            return call.name == ShellTurn.toolName
        })
        #expect(ending.contains { event in
            guard case let .toolCallOutcome(outcome) = event,
                  case let .output(printed)? = outcome.result
            else { return false }
            // Both streams: a command that printed on one and failed on the other said both.
            return printed.text == """
            Command did not complete within its 120s timeout.
            a terminal is required
            """
        })
    }

    /// A command that printed nothing still printed: the record is the CLI saying the command is
    /// over, and a reader that skipped it would leave the Turn open for good.
    @Test
    func `a command that printed nothing still ends its Turn`() {
        let printed = ShellTurn.printed(in: [.text("<bash-stdout></bash-stdout>")])

        #expect(printed?.isEmpty == true)
    }

    @Test(arguments: ["! ls", "!ls"])
    func `a line beginning with the mark is a shell command`(line: String) {
        #expect(ShellTurn.isTyped(line))
    }

    /// The mark is read at the HEAD alone, the discipline every other reading here uses: a prompt
    /// that merely CONTAINS one is a prompt.
    @Test(arguments: ["Fix it!", "/implement 1595", "run ! as a shell command"])
    func `a line that only mentions the mark is not one`(line: String) {
        #expect(!ShellTurn.isTyped(line))
    }
}

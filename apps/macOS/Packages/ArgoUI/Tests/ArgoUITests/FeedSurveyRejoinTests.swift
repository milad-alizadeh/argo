import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// Two runs of looking that end up next to each other are one stretch.
///
/// The survey's own pass runs over the whole stream and every pass after it takes rows away: the
/// Turn's card of work swallows the loud calls that had been keeping two runs apart, and the two
/// are left one under the other with nothing between them.
@Suite("Feed survey rejoining")
struct FeedSurveyRejoinTests {
    /// The Turn's card takes away the rows that were keeping two runs of looking apart, and the
    /// two are then one stretch — three lines reading `Ran 2`, `Ran 2`, `Ran 2` are a count the
    /// reader has to add up by hand.
    @Test
    func `runs of looking the card left adjacent are read as one`() {
        let rows = FeedProjection.rows(from: ran("ls apps", "cat a.swift")
            + ran("swift build", "swift test")
            + ran("rg Feed", "wc -l a.swift")
            + ran("swift build", "swift test")
            + ran("git status", "git diff"))

        #expect(FeedFixture.work(in: rows).map(\.label) == ["Ran 4 Commands"])
        #expect(FeedFixture.surveys(in: rows).map(\.label) == ["Ran 2 Commands", "Ran 4 Commands"])
    }

    /// A command as a host that narrates nothing writes it, with what it printed.
    private func ran(_ commands: String...) -> [TranscriptEvent] {
        commands.flatMap { command -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    command,
                    tool: "shell",
                    kind: .execute,
                    naming: command,
                )),
                .toolCallOutcome(TranscriptFixtures.printed(command, "what \(command) printed")),
            ]
        }
    }
}

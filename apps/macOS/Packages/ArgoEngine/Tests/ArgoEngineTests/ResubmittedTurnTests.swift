@testable import ArgoEngine
import Foundation
import Testing

/// Where the READER sees a Turn put twice (#1202).
///
/// The transcript is a TREE, not a list: `parentUuid` names the record each one answers. A Turn
/// submitted twice — a Return the composer sent again, a prompt re-sent — leaves TWO children on
/// one parent, and only the later of them is the branch the CLI went on with. The file keeps both,
/// so a reader that appends every line in file order draws the same words twice with one answer
/// under them, which is exactly what the issue's screenshot shows.
///
/// What the reading then DOES with the marker is `ResubmittedTurnReadingTests`.
@Suite("A resubmitted Turn")
struct ResubmittedTurnTests {
    @Test
    func `a second prompt on one parent supersedes the first`() async {
        let reader = TranscriptReader()
        let lines = [
            resubmittedPrompt("first", under: "boundary", saying: "did you fix the issues"),
            resubmittedPrompt("second", under: "boundary", saying: "did you fix the issues"),
        ]

        let read = await reader.read(lines: lines)

        #expect(read.contains(.superseded(fromRecord: "first")))
    }

    /// The whole of the acceptance criterion: the row holds one of them, not two.
    @Test
    func `the abandoned branch leaves one row behind`() async {
        let reader = TranscriptReader()
        let lines = [
            resubmittedPrompt("first", under: "boundary", saying: "did you fix the issues"),
            resubmittedPrompt("second", under: "boundary", saying: "did you fix the issues"),
        ]

        let read = await reader.read(lines: lines)

        #expect(promptsDrawn(in: sessionReading(of: read).events) == ["did you fix the issues"])
    }

    /// An ordinary conversation is a chain of single children, and nothing in it is superseded —
    /// the guard that keeps this reading from eating a feed.
    @Test
    func `a conversation nobody forked keeps every prompt`() async {
        let reader = TranscriptReader()
        let lines = [
            resubmittedPrompt("one", under: nil, saying: "first"),
            resubmittedPrompt("two", under: "one", saying: "second"),
            resubmittedPrompt("three", under: "two", saying: "third"),
        ]

        let read = await reader.read(lines: lines)

        #expect(!carriesSupersede(read))
        #expect(promptsDrawn(in: sessionReading(of: read).events) == ["first", "second", "third"])
    }

    /// A fact the dropped branch was the only one to ANNOUNCE comes back with the record that
    /// superseded it. The cwd, branch, model and effort are emitted on CHANGE, so the record a fork
    /// removes can be the one that announced the new value — and the superseding record carries
    /// the same value, which on-change has nothing to say. Left alone, the fact would be in no
    /// event anywhere while the Session's folded scalars still held it.
    @Test
    func `a fact only the dropped branch announced is re-stated`() async {
        let reader = TranscriptReader()
        let moved = """
        {"type": "user", "parentUuid": "boundary", "message": {"role": "user", \
        "content": "on the new branch"}, "uuid": "first", "gitBranch": "argo/#1202", \
        "sessionId": "s"}
        """
        let again = """
        {"type": "user", "parentUuid": "boundary", "message": {"role": "user", \
        "content": "on the new branch"}, "uuid": "second", "gitBranch": "argo/#1202", \
        "sessionId": "s"}
        """

        let read = await reader.read(lines: [
            resubmittedPrompt("opening", under: nil, saying: "start"),
            moved,
            again,
        ])

        #expect(sessionReading(of: read).events.contains(.branch("argo/#1202")))
        #expect(sessionReading(of: read).branch == "argo/#1202")
    }

    /// A Subagent's file is read for its own lane and appended raw beside the roster
    /// (`SubagentReadings`), so nothing there spends the marker. One emitted would be a dead event
    /// in a stream compared by its length, with both branches still drawn.
    @Test
    func `a Subagent's reading is never told about a fork`() async {
        let reader = TranscriptReader(subject: .subagent)
        let lines = [
            resubmittedPrompt("first", under: "boundary", saying: "delegated"),
            resubmittedPrompt("second", under: "boundary", saying: "delegated"),
        ]

        let read = await reader.read(lines: lines)

        #expect(!carriesSupersede(read))
    }

    /// The whole shape at once, in the CLI's own bytes: one Turn put twice leaves one prompt and
    /// the answer the CLI actually gave, with the half-answer it abandoned gone from both.
    ///
    /// The fixture's field set is verbatim from `claude` 2.1.226 — the `promptId`, `promptSource`
    /// and `permissionMode` a typed prompt carries, and the two sibling uuids under one
    /// `parentUuid` that are the fork itself.
    @Test
    func `the CLI's own bytes draw one prompt and one answer`() async throws {
        let session = try await sessionReading(of: Fixture.events("resubmittedTurn"))

        #expect(promptsDrawn(in: session.events) == ["open the session", "did you fix the issues"])
        #expect(said(by: session) == ["Opened.", "Yes, all of them."])
    }
}

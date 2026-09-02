import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What a command's output is worth saying about it before anybody opens it: how much of it there
/// is, counted off the record, and nothing at all where the record supports nothing.
@Suite("Evidence length")
struct EvidenceLengthTests {
    @Test(arguments: [
        ("one line with no newline behind it", "** BUILD SUCCEEDED **", 1),
        ("a line the command ended", "** BUILD SUCCEEDED **\n", 1),
        ("every line, blank ones included", "first\n\nthird\n", 3),
        ("a windows line ending", "first\r\nsecond\r\n", 2),
    ])
    func `a command's output is counted in the lines it printed`(
        _ what: String,
        _ text: String,
        _ lines: Int,
    ) {
        let length = EvidenceLength(.output(OutputEvidence(tier: .direct, text: text)))

        #expect(length?.lines == lines, "\(what)")
    }

    /// The honest omission: a count of a thing the record does not carry is a claim, not a fact.
    @Test
    func `a result with no output to count says nothing rather than zero`() {
        let media = ToolResult.media(MediaEvidence(
            tier: .direct,
            mediaType: "image/png",
            bytes: nil,
        ))
        let patch = ToolResult.diff(DiffEvidence(
            tier: .direct,
            mutation: DiffEvidence.Mutation(change: .modify, destination: nil),
            patch: DiffEvidence.Patch(added: 8, removed: 2, hunks: []),
        ))
        let empty = ToolResult.output(OutputEvidence(tier: .direct, text: ""))

        #expect(EvidenceLength(media) == nil)
        #expect(EvidenceLength(patch) == nil)
        #expect(EvidenceLength(empty) == nil)
    }

    @Test
    func `a folded run of commands is counted across everything it printed`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("one", tool: "Bash", kind: .execute, naming: "swift build")),
            .toolCallOutcome(TranscriptFixtures.printed("one", "compiling\nlinking\n")),
            .toolCall(FeedFixture.call("two", tool: "Bash", kind: .execute, naming: "swift build")),
            .toolCallOutcome(TranscriptFixtures.printed("two", "done\n")),
        ])

        #expect(calls.map(\.repeats) == [2])
        #expect(calls.first?.printed?.lines == 3)
    }

    /// The count belongs to a stream. A read's output is the file, drawn with the file's own line
    /// numbers, and a search's is matches — counting either as printed lines would misname it.
    @Test
    func `only a command's output is counted on the row`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("read", tool: "Read", kind: .read, naming: "Token.swift")),
            .toolCallOutcome(TranscriptFixtures.printed("read", "let token = 1\nlet other = 2\n")),
        ])

        #expect(calls.first?.evidence.isEmpty == false)
        #expect(calls.first?.printed == nil)
    }

    @Test
    func `a command still running has printed nothing to count`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift test")),
        ])

        #expect(calls.first?.ending == .pending)
        #expect(calls.first?.printed == nil)
    }

    /// A failure is counted like anything else: the panel is where the output is read, and the row
    /// says how much of it is waiting there.
    @Test
    func `a failed command counts what it printed like any other`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift test")),
            .toolCallOutcome(FeedFixture.failed(
                "run",
                printing: "error: no such module\nExit 1\n",
            )),
        ])

        #expect(calls.first?.ending == .failed)
        #expect(calls.first?.printed?.lines == 2)
    }

    /// A one-line stream is the least a command can print, so the count warns about nothing and is
    /// not drawn — the chevron already says there is something behind the row.
    @Test(arguments: [(1, nil), (2, "2 lines"), (1204, "1204 lines")] as [(Int, String?)])
    func `the count is drawn in the unit it counted, and only where it says something`(
        _ lines: Int,
        _ drawn: String?,
    ) {
        let text = String(repeating: "printed\n", count: lines)
        let length = EvidenceLength(.output(OutputEvidence(tier: .direct, text: text)))

        #expect(length?.drawn == drawn)
    }

    /// The seam's other consumer: the panel counts one step at a time, and only where that step's
    /// address is a command.
    @Test
    func `a panel step counts the command it came from and not the file`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift build")),
            .toolCallOutcome(TranscriptFixtures.printed("run", "compiling\nlinking\n")),
            .toolCall(FeedFixture.call("read", tool: "Read", kind: .read, naming: "Token.swift")),
            .toolCallOutcome(TranscriptFixtures.printed("read", "let token = 1\n")),
        ])

        #expect(calls.map { $0.opened.steps.compactMap { $0.printed?.lines } } == [[2], []])
    }
}

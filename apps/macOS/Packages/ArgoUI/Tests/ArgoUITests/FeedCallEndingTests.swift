import ArgoEngine
@testable import ArgoUI
import Testing

/// How a call ended, and what the row is entitled to say about it — which is nothing, in words. The
/// ending is drawn as the ink of the line and a mark after it; everything the record actually said
/// is the panel's.
@Suite("Feed call ending")
struct FeedCallEndingTests {
    /// Not one line of the output reaches the row, the exit line included.
    @Test
    func `a failed command says so, and none of its output appears on the row`() throws {
        let printed = "Exit code 65\n\nChip.swift:88:7: error: cannot convert value\n"
            + "    to expected argument type\n** BUILD FAILED **"
        let call = try #require(FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "build",
                tool: "Bash",
                kind: .execute,
                naming: "swift build",
            )),
            .toolCallOutcome(FeedFixture.failed("build", printing: printed)),
        ]).first)

        #expect(call.ending == .failed)
        // Whole and unabridged, and only behind the disclosure.
        #expect(call.evidence == [.output(OutputEvidence(tier: .direct, text: printed))])
    }

    /// A failure that printed nothing is still a failure, and the ROW says so with ink and a cross.
    /// There is no word for Argo to put there instead.
    @Test
    func `a failure the host printed nothing for reads as failed and opens onto nothing`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "build",
                tool: "Bash",
                kind: .execute,
                naming: "swift build",
            )),
            .toolCallOutcome(FeedFixture.failed("build", printing: nil)),
        ])

        #expect(calls.first?.ending == .failed)
        #expect(calls.first?.disclosure == FeedCall.Disclosure.none)
    }

    @Test
    func `a command that came back good is a success, and keeps what it printed`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("run", tool: "Bash", kind: .execute, naming: "swift test")),
            .toolCallOutcome(FeedFixture.answered(
                "run",
                .output(OutputEvidence(
                    tier: .direct,
                    text: "Test Suite 'All tests' started\n✔ oneTest\n"
                        + "Executed 151 tests, with 0 failures\n\n",
                )),
            )),
        ])

        #expect(calls.first?.ending == .succeeded)
        #expect(calls.first?.ending.hasFailed == false)
        #expect(calls.first?.disclosure == .available)
    }

    /// A call the record has not answered yet HAPPENED, and it is a row — never a success, never
    /// dropped.
    @Test
    func `a call the transcript has not answered is open, not quietly successful`() {
        let calls = FeedFixture.read("Token.swift")

        #expect(calls.first?.ending == .pending)
        #expect(calls.first?.ending.spoken == "still running")
    }

    // MARK: - What opens

    /// The marker follows the EVIDENCE and never the kind — two reads of the same file, one
    /// answered by the record and one not, are two different rows.
    @Test
    func `the disclosure marker and what opens behind it are one fact`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("kept", tool: "Read", kind: .read, naming: "Token.swift")),
            .toolCallOutcome(FeedFixture.answered(
                "kept",
                .output(OutputEvidence(tier: .direct, text: "1\texport const token = 1")),
            )),
            .toolCall(FeedFixture.call(
                "dropped",
                tool: "Read",
                kind: .read,
                naming: "Other.swift",
            )),
            .toolCallOutcome(FeedFixture.answered("dropped", nil)),
            // Never answered at all — a third way to have nothing behind the row.
            .toolCall(FeedFixture.call("open", tool: "Read", kind: .read, naming: "Third.swift")),
        ])

        #expect(calls.map(\.disclosure) == [.available, .none, .none])
        #expect(calls.map { !$0.evidence.isEmpty } == [true, false, false])
    }

    /// A result with nothing in it is no result: the row stays, unopenable.
    @Test
    func `a result with nothing in it is not something to open`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("edit", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            // A mutation whose patch nothing could read — a binary file, an unparsed shape.
            .toolCallOutcome(FeedFixture.answered("edit", FeedFixture.patch(
                .modify,
                added: 0,
                removed: 0,
                hunks: [],
            ))),
        ])

        #expect(calls.first?.disclosure == FeedCall.Disclosure.none)
    }

    /// The panel is where a mutation's patch is read, so the projection keeps more than the counts
    /// the ROW draws.
    @Test
    func `a mutation carries its whole patch through to the panel, not just its counts`() throws {
        let patch = FeedFixture.patch(.modify, added: 1, removed: 1)
        let call = try #require(FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("edit", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(FeedFixture.answered("edit", patch)),
        ]).first)

        #expect(call.churn == FeedCall.Churn(added: 1, removed: 1))
        #expect(call.evidence == [patch])
    }
}

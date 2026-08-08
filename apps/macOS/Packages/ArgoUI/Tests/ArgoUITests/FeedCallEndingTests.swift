import ArgoEngine
@testable import ArgoUI
import Testing

/// How a call ended, and what the row is entitled to say about it — which is one line, whatever
/// happened. The rest is the evidence panel's, and these are the claims that keep the two apart.
@Suite("Feed call ending")
struct FeedCallEndingTests {
    /// The row keeps its ONE line whatever went wrong. What the command printed does not appear
    /// there at any length — the exit status is the whole of what the sentence says about it.
    @Test
    func `a failed command carries its exit status and none of its output`() throws {
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

        #expect(call.ending == .failed(status: "Exit code 65"))
        #expect(call.ending.outcome == "Exit code 65")
        // Whole and unabridged, and only behind the disclosure.
        #expect(call.evidence == .output(OutputEvidence(tier: .direct, text: printed)))
    }

    /// Something has to say the call went wrong where the host wrote no status, and a red mark
    /// alone is a difference a reader who cannot see it loses entirely.
    @Test
    func `a failure the host gave no exit line still reads as an error`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "build",
                tool: "Bash",
                kind: .execute,
                naming: "swift build",
            )),
            .toolCallOutcome(FeedFixture.failed("build", printing: nil)),
        ])

        #expect(calls.first?.ending == .failed(status: nil))
        #expect(calls.first?.ending.outcome == "Error")
        #expect(calls.first?.ending.hasFailed == true)
    }

    /// One line, and it is the command's OWN last one — not a count of what came before it, which
    /// is the moment the feed would start writing its own summary of a record it can only read.
    @Test
    func `a call that succeeded reduces to the last line it printed`() {
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

        #expect(calls.first?.ending == .succeeded(outcome: "Executed 151 tests, with 0 failures"))
        #expect(calls.first?.ending.hasFailed == false)
    }

    /// A successful read's payload is the whole file, so the engine keeps none of it. The row says
    /// the read happened and claims nothing about what came back.
    @Test
    func `a call whose result the engine kept nothing of claims no outcome`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("read", tool: "Read", kind: .read, naming: "Token.swift")),
            .toolCallOutcome(FeedFixture.answered("read", nil)),
        ])

        #expect(calls.first?.ending == .succeeded(outcome: nil))
    }

    /// A call the record has not answered yet HAPPENED, and it is a row. Reading it as a success
    /// would be the feed's first lie, and dropping it would hide the work in flight.
    @Test
    func `a call the transcript has not answered is open, not quietly successful`() {
        let calls = FeedFixture.read("Token.swift")

        #expect(calls.first?.ending == .pending)
        #expect(calls.first?.ending.outcome == nil)
    }

    // MARK: - What opens

    /// The marker follows the EVIDENCE and never the kind — two reads of the same file, one
    /// answered by the record and one not, are two different rows. They are one field now, so the
    /// marker and what opens behind it cannot disagree: a row advertising evidence it has none of
    /// is the one failure this surface could not recover from.
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
        #expect(calls.map { $0.evidence != nil } == [true, false, false])
    }

    /// The panel is where a mutation's patch is read, so a projection that kept only what the ROW
    /// draws would leave it with a churn count and nothing to show.
    @Test
    func `a mutation carries its whole patch through to the panel, not just its counts`() throws {
        let patch = FeedFixture.patch(.modify, added: 1, removed: 1)
        let call = try #require(FeedFixture.calls(in: [
            .toolCall(FeedFixture.call("edit", tool: "Edit", kind: .edit, naming: "Feed.swift")),
            .toolCallOutcome(FeedFixture.answered("edit", patch)),
        ]).first)

        #expect(call.churn == FeedCall.Churn(added: 1, removed: 1))
        #expect(call.evidence == patch)
    }
}

@testable import ArgoEngine
import Testing

/// A file folded into one reading TWICE (#1204). `HubJoin.add` keeps the reading of a transcript
/// already in the set, so a re-tailed transcript hands the same records to the same reading again;
/// only `HubJoin.reread` drops one.
@Suite("Hub join refold")
struct HubJoinRefoldTests {
    /// The claim, at the grain the rail draws: one `tool_use` of a delegating kind is one call,
    /// however many times the file is read into the reading that already holds it.
    @Test
    func `a file folded twice holds one call per tool use`() {
        var join = joinOfOneFile()

        join.apply(twoDelegations, to: transcriptID)

        #expect(delegations(in: join) == ["Standards review", "Spec review"])
    }

    /// And at the grain the header draws: a spend is a SUM, so a record folded twice is a bill
    /// stated at twice what it was.
    @Test
    func `a file folded twice is billed once`() {
        var join = joinOfOneFile()

        join.apply(twoDelegations, to: transcriptID)

        #expect(join.sessions.first?.spentTokens == 300)
    }

    /// The other half of the same claim: what is skipped is the records already READ, never the
    /// file. A live tail's next record has an identity nothing has folded, and it folds.
    @Test
    func `a record the reading has not seen still folds`() {
        var join = joinOfOneFile()
        let next = delegation(record: "r3", brief: "Pixel review")

        join.apply(twoDelegations + next, to: transcriptID)

        #expect(delegations(in: join) == ["Standards review", "Spec review", "Pixel review"])
    }

    /// Re-reading is not re-folding: selecting a Session drops the reading and takes a fresh one
    /// (`HubJoin.reread`), and every record of the file belongs in it.
    @Test
    func `a transcript read again folds the whole file into the fresh reading`() {
        var join = joinOfOneFile()

        _ = join.reread(hubTestObservation(id: transcriptID, events: []))
        join.apply(twoDelegations, to: transcriptID)

        #expect(delegations(in: join) == ["Standards review", "Spec review"])
        #expect(join.sessions.first?.spentTokens == 300)
    }

    /// The record-less events are their own lines (`TranscriptReader.events(of:)`), never bundled
    /// under the record before them — so a duplicate stretch closing must not swallow a genuinely
    /// fresh one landing right after it. A re-tail resends its file's PAST and then keeps going
    /// live, and a title renamed the moment after is exactly that shape.
    @Test
    func `a title renamed right after a duplicate stretch still lands`() {
        var join = joinOfOneFile()

        join.apply(twoDelegations + [.title("Renamed")], to: transcriptID)

        #expect(join.sessions.first?.title == "Renamed")
    }

    private let transcriptID = "delegating-session"

    /// One file already read: the two delegations it holds, folded once.
    private func joinOfOneFile() -> HubJoin {
        var join = HubJoin()
        join.add(hubTestObservation(id: transcriptID, events: []))
        join.apply(twoDelegations, to: transcriptID)
        return join
    }

    /// The shape a transcript actually has: each record's identity first, then what that record
    /// said (`TranscriptReader.read`).
    private var twoDelegations: [TranscriptEvent] {
        delegation(record: "r1", brief: "Standards review")
            + delegation(record: "r2", brief: "Spec review")
    }

    private func delegation(record uuid: String, brief: String) -> [TranscriptEvent] {
        [
            .recordIdentity(uuid: uuid),
            .toolCall(
                ToolCall(
                    id: "toolu_\(uuid)", name: "Agent", kind: .delegate, target: brief, atMs: 1,
                ),
            ),
            .usage(
                Usage(
                    inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheCreationTokens: 0,
                ),
            ),
        ]
    }

    private func delegations(in join: HubJoin) -> [String] {
        (join.sessions.first?.events ?? []).compactMap { event -> String? in
            guard case let .toolCall(call) = event, call.kind == .delegate else { return nil }
            return call.target
        }
    }
}

@testable import ArgoEngine
import Foundation
import Testing

/// A Session's OWN batch, written into its row rather than refolding the world for it (ADR-0028
/// Rule 1) — and the proof that doing so changes no answer.
///
/// Every case here asserts against a join that was NOT written incrementally rather than against a
/// hand-written expectation. The reference is built by handing each transcript its whole reading in
/// ONE batch: the first batch a transcript delivers is its backfill, which settles it, and a
/// settling batch always refolds. So the two joins see the same events in the same order, and the
/// only difference between them is which path published the later half.
///
/// A join that silently misses a re-parent is worse than a slow one — the honesty tiers rest on the
/// chain graph being right — so the split is exercised once per fact that can move it.
@Suite("Hub join, written in place")
struct HubJoinIncrementalTests {
    /// The control: nothing in a content batch moves the graph, so this is the case the fast path
    /// is FOR — and it must still come out identical, ordering included.
    @Test
    func `a content batch publishes what a refold would have published`() {
        let backfill = [prompt(at: 10), TranscriptEvent.message(markdown: "first")]
        let batch: [TranscriptEvent] = [
            .recordIdentity(uuid: "record-2"),
            .message(markdown: "second"),
            .usage(Usage(
                inputTokens: 12,
                outputTokens: 3,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            )),
            prompt(at: 40),
            .turnEnded(.endTurn),
        ]

        expectSameJoin(backfill: ["alpha": backfill], batches: [("alpha", batch)])
    }

    /// The sort key moves with the batch, and the row does not move with it — so a roster written
    /// in place is out of order until something puts it back. Read order is the assertion.
    @Test
    func `a content batch leaves the roster in the order a refold would have left it`() {
        let batches = (0 ..< 3).map { index in ("s-\(index)", [prompt(at: 900 - index * 100)]) }

        expectSameJoin(backfill: backfills(of: 4), batches: batches)
    }

    /// A record identity is what a resume LINKS against: the claim can hand another transcript's
    /// `headLeaf` an owner, which parents that transcript under this one.
    @Test
    func `a batch claiming a record another transcript resumes from still folds the chain`() {
        expectSameJoin(
            backfill: ["root": [prompt(at: 10)], "child": [.headLeaf(uuid: "leaf")]],
            batches: [("root", [.recordIdentity(uuid: "leaf"), .message(markdown: "said")])],
        )
    }

    /// The same edge reached from the other end: the leaf moves rather than its owner.
    @Test
    func `a batch naming a new head leaf still folds the chain`() {
        expectSameJoin(
            backfill: ["root": [.recordIdentity(uuid: "leaf"), prompt(at: 10)], "child": [
                prompt(at: 20),
            ]],
            batches: [("child", [.headLeaf(uuid: "leaf")])],
        )
    }

    /// The graph's other edge: a relocated file names no shared record, only the session it started
    /// as (#735).
    @Test
    func `a batch naming an origin session still folds the chain`() {
        expectSameJoin(
            backfill: ["root": [prompt(at: 10)], "moved": [prompt(at: 20)]],
            batches: [("moved", [.originSession(id: "root")])],
        )
    }

    /// Membership, not shape: a queued prompt nothing answered is not a Session, so this batch has
    /// to take a row AWAY that the incremental path was holding open.
    @Test
    func `a batch queuing an unanswered prompt still takes its row off the roster`() {
        expectSameJoin(
            backfill: ["alpha": [.title("Queued")], "beta": [prompt(at: 20)]],
            batches: [("alpha", [.queued])],
        )
    }

    /// And back the other way: a queued file an agent then answered IS a Session.
    @Test
    func `a batch answering a queued prompt still puts its row on the roster`() {
        expectSameJoin(
            backfill: ["alpha": [.queued, .title("Queued")], "beta": [prompt(at: 20)]],
            batches: [("alpha", [.message(markdown: "answered")])],
        )
    }

    /// A transcript leaving the set renumbers ownership and can orphan a chain, so `remove` refolds
    /// — asserted against the join the same set would have folded to from scratch.
    @Test
    func `a removal publishes what a refold would have published`() {
        var subject = join(backfill: backfills(of: 3))
        subject.apply([.message(markdown: "said")], to: "s-1")

        subject.remove(transcriptID: "s-1")

        var reference = join(backfill: backfills(of: 3).filter { $0.key != "s-1" })
        #expect(subject.sessions == reference.sessions)
        #expect(subject.transcripts.map(\.id) == reference.transcripts.map(\.id))
    }

    /// The subject takes each batch after its backfill; the reference takes backfill and batches as
    /// one, which settles and refolds. Same events, same order, one incremental path.
    private func expectSameJoin(
        backfill: [String: [TranscriptEvent]],
        batches: [(String, [TranscriptEvent])],
    ) {
        var subject = join(backfill: backfill)
        for (transcriptID, batch) in batches {
            subject.apply(batch, to: transcriptID)
        }
        var whole = backfill
        for (transcriptID, batch) in batches {
            whole[transcriptID, default: []] += batch
        }

        #expect(subject.sessions == join(backfill: whole).sessions)
    }

    /// Admitted in a settled key order, so the reference and the subject fold the same array.
    private func join(backfill: [String: [TranscriptEvent]]) -> HubJoin {
        var join = HubJoin()
        for transcriptID in backfill.keys.sorted() {
            join.add(hubTestObservation(id: transcriptID, events: []))
        }
        for transcriptID in backfill.keys.sorted() {
            join.apply(backfill[transcriptID] ?? [], to: transcriptID)
        }
        return join
    }

    private func backfills(of count: Int) -> [String: [TranscriptEvent]] {
        Dictionary(uniqueKeysWithValues: (0 ..< count).map { index in
            ("s-\(index)", [prompt(at: (index + 1) * 100)])
        })
    }

    private func prompt(at atMs: Int) -> TranscriptEvent {
        .prompt(text: "Asked at \(atMs)", images: [], atMs: atMs)
    }
}

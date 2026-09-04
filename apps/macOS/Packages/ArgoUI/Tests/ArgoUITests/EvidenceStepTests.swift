import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The panel is a LIST of results, each under the address it came from: every result carries its
/// own address, churn and place, and a folded row's names point at those places.
@Suite("Evidence steps")
struct EvidenceStepTests {
    /// Every step captioned, including the three patches of one file a collapsed run leaves — the
    /// address is where the copy control lives.
    @Test
    func `every result carries the address it came from`() throws {
        let call = try Self.edited("Sources/ArgoUI/FeedRow.swift", patches: 3)

        #expect(call.opened.steps.count == 3)
        #expect(call.opened.steps.allSatisfy {
            $0.address == .filed("Sources/ArgoUI/FeedRow.swift")
        })
    }

    /// The panel's count and not the row's: a run of edits shows what EACH of them did.
    @Test
    func `churn is read per result, from the patch itself`() throws {
        let call = try Self.edited("a.swift", patches: 2)

        #expect(call.opened.steps.map(\.churn) == [
            FeedCall.Churn(added: 1, removed: 1), FeedCall.Churn(added: 1, removed: 1),
        ])
    }

    /// A patch nothing could read counts nothing. `+0 −0` claims an edit that changed nothing,
    /// which is a different statement from a patch that could not be parsed.
    @Test
    func `a result with nothing to count carries no churn`() {
        let printed = FeedEvidence.Step(
            id: 0, address: .typed("ls"), language: nil, isExternal: false,
            result: .output(OutputEvidence(tier: .direct, text: "a.swift")),
        )

        #expect(printed.churn == nil)
    }

    /// A step's id is its place down the whole pane, which is what the feed points at. Counted
    /// across the calls in the run, because one call can produce more than one result.
    @Test
    func `a folded run numbers its steps by their place down the pane`() throws {
        let survey = try #require(FeedFixture.surveys(in: FeedProjection.rows(from: Self.looking))
            .first)

        #expect(survey.opened.steps.map(\.id) == [0, 1, 2])
        #expect(survey.steps.map(\.goesTo) == [0, 1, 2])
    }

    /// A call the record answered with nothing is still listed under the open row — it happened —
    /// and points at nothing, so its name is inert rather than a click onto another call's step.
    @Test
    func `a call that produced nothing has no step to point at`() throws {
        let unanswered: [TranscriptEvent] = ["a.swift", "b.swift"].enumerated()
            .flatMap { at, path in
                var events: [TranscriptEvent] = [
                    .toolCall(FeedFixture.call(
                        "read-\(at)",
                        tool: "Read",
                        kind: .read,
                        naming: path,
                    )),
                ]
                if at == 1 {
                    events.append(.toolCallOutcome(TranscriptFixtures.printed("read-\(at)", "…")))
                }
                return events
            }
        let survey = try #require(FeedFixture.surveys(in: FeedProjection.rows(from: unanswered))
            .first)

        #expect(survey.steps.map(\.goesTo) == [nil, 0])
    }

    /// What a press on ONE name opens: that call's own result and nothing else. The step a name
    /// points at is an index down the WHOLE pane, so the claim only bites where the calls produce
    /// different numbers of results — a run of one-each is numbered correctly by any off-by-one.
    @Test
    func `each name in a fold points at its own call's first result`() throws {
        let calls = try [
            Self.edited("first.swift", patches: 1),
            Self.edited("middle.swift", patches: 3),
            Self.edited("last.swift", patches: 2),
        ]
        let pane = FeedFold.steps(of: calls)

        let aimed = FeedFold.listed(calls).map { name in name.goesTo.map { pane[$0].address } }
        #expect(aimed == calls.map { Optional($0.caption) })
    }

    // MARK: - Fixtures

    private static var looking: [TranscriptEvent] {
        ["a.swift", "b.swift", "c.swift"].enumerated().flatMap { at, path -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call("read-\(at)", tool: "Read", kind: .read, naming: path)),
                .toolCallOutcome(TranscriptFixtures.printed("read-\(at)", "…")),
            ]
        }
    }

    private static func edited(_ path: String, patches: Int) throws -> FeedCall {
        let file = try #require(FeedCall.FileName(path: path))
        return FeedCall(
            kind: .edit,
            subject: .file(file),
            churn: FeedCall.Churn(added: patches, removed: patches),
            ending: .succeeded,
            evidence: Array(repeating: .diff(Self.patch), count: patches),
            repeats: patches,
            spend: nil,
        )
    }

    private static let patch = DiffEvidence(
        tier: .direct,
        mutation: DiffEvidence.Mutation(change: .modify, destination: nil),
        patch: DiffEvidence.Patch(
            added: 1,
            removed: 1,
            hunks: [DiffHunk(oldStart: 1, newStart: 1, lines: [
                DiffLine(side: .del, text: "let a = 1"),
                DiffLine(side: .add, text: "let a = 2"),
            ])],
        ),
    )
}

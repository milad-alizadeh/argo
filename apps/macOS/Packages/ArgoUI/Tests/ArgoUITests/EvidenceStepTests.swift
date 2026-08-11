import ArgoEngine
@testable import ArgoUI
import Testing

/// The panel is a LIST of results, each under the address it came from. These are the claims that
/// keeps that list navigable: every result carries its own address, its own churn and its own
/// place,
/// and the names listed under a folded row point at those places.
@Suite("Evidence steps")
struct EvidenceStepTests {
    /// Every step captioned, including the three patches of one file a collapsed run leaves. The
    /// address is where the copy control lives, so a step without one is a patch whose path the
    /// reader cannot take.
    @Test
    func `every result carries the address it came from`() throws {
        let call = try Self.edited("Sources/ArgoUI/FeedRow.swift", patches: 3)

        #expect(call.opened.steps.count == 3)
        #expect(call.opened.steps.allSatisfy {
            $0.address == .filed("Sources/ArgoUI/FeedRow.swift")
        })
    }

    /// The panel's count and not the row's: a run of three edits shows what EACH of them did, which
    /// is the whole reason the three were kept apart behind one line.
    @Test
    func `churn is read per result, from the patch itself`() throws {
        let call = try Self.edited("a.swift", patches: 2)

        #expect(call.opened.steps.map(\.churn) == [
            FeedCall.Churn(added: 1, removed: 1), FeedCall.Churn(added: 1, removed: 1),
        ])
    }

    /// A patch nothing could read counts nothing. `+0 −0` claims an edit that changed nothing,
    /// which
    /// is a different statement from a patch that could not be parsed.
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
        #expect(survey.step(of: 0) == 0)
        #expect(survey.step(of: 2) == 2)
    }

    /// A call the record answered with nothing is still listed under the open row — it happened —
    /// and points at nothing, which is what makes its name inert rather than a click onto a step
    /// belonging to some other call.
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
                    events.append(.toolCallOutcome(FeedFixture.answered(
                        "read-\(at)",
                        .output(OutputEvidence(tier: .direct, text: "…")),
                    )))
                }
                return events
            }
        let survey = try #require(FeedFixture.surveys(in: FeedProjection.rows(from: unanswered))
            .first)

        #expect(survey.step(of: 0) == nil)
        #expect(survey.step(of: 1) == 0)
        #expect(survey.step(of: 9) == nil)
    }

    // MARK: - Fixtures

    private static var looking: [TranscriptEvent] {
        ["a.swift", "b.swift", "c.swift"].enumerated().flatMap { at, path -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call("read-\(at)", tool: "Read", kind: .read, naming: path)),
                .toolCallOutcome(FeedFixture.answered(
                    "read-\(at)",
                    .output(OutputEvidence(tier: .direct, text: "…")),
                )),
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
        tier: .direct, change: .modify, destination: nil, added: 1, removed: 1,
        hunks: [DiffHunk(oldStart: 1, newStart: 1, lines: [
            DiffLine(side: .del, text: "let a = 1"),
            DiffLine(side: .add, text: "let a = 2"),
        ])],
    )
}

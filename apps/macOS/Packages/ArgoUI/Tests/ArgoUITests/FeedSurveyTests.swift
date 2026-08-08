import ArgoEngine
@testable import ArgoUI
import Testing

/// Looking is quiet. A turn that reads nine files before it changes one is nine rows of traffic
/// above the row worth seeing, so a run of reads and searches folds to a single line of counts —
/// and the claims here are mostly about where that fold is NOT allowed to reach.
@Suite("Feed surveys")
struct FeedSurveyTests {
    @Test
    func `a run of reads and searches folds into one line of counts`() throws {
        let rows = FeedProjection.rows(from: looking(at: ["a.swift", "b.swift", "c.swift"]))
        let survey = try #require(FeedFixture.surveys(in: rows).first)

        #expect(rows.count == 1)
        #expect(survey.label == "Searched 1 · Read 3")
    }

    /// The break rule is the whole point: it makes "Edited a file, ran a command, read a file" mush
    /// structurally impossible rather than merely discouraged.
    @Test
    func `a mutation breaks the run, and the reads either side of it are two surveys`() {
        let interrupted = looking(at: ["a.swift", "b.swift"])
            + [
                .toolCall(FeedFixture.call(
                    "edit",
                    tool: "Edit",
                    kind: .edit,
                    naming: "Feed.swift",
                )),
                .toolCallOutcome(FeedFixture.answered(
                    "edit",
                    FeedFixture.patch(.modify, added: 1),
                )),
            ]
            + looking(at: ["c.swift", "d.swift"])

        let rows = FeedProjection.rows(from: interrupted)

        #expect(rows.count == 3)
        #expect(FeedFixture.surveys(in: rows).map(\.label) == [
            "Searched 1 · Read 2", "Searched 1 · Read 2",
        ])
    }

    /// A run of reads sits directly above the message that follows it, and never absorbs the reads
    /// that came after. Prose is where one piece of work ends and the next begins.
    @Test
    func `prose breaks the run`() {
        let interrupted = looking(at: ["a.swift", "b.swift"])
            + [.message(markdown: "Found it.")]
            + looking(at: ["c.swift", "d.swift"])

        #expect(FeedProjection.rows(from: interrupted).count == 3)
    }

    /// A failed read is not quiet. It is the one thing on the line worth seeing, and a fold would
    /// bury it inside a count that says everything went fine.
    @Test
    func `a read that failed stays its own row and breaks the run`() {
        let broken: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("a", tool: "Read", kind: .read, naming: "a.swift")),
            .toolCall(FeedFixture.call("gone", tool: "Read", kind: .read, naming: "missing.swift")),
            .toolCallOutcome(FeedFixture.failed("gone", printing: "No such file")),
            .toolCall(FeedFixture.call("b", tool: "Read", kind: .read, naming: "b.swift")),
        ]

        let rows = FeedProjection.rows(from: broken)

        #expect(rows.count == 3)
        #expect(FeedFixture.surveys(in: rows).isEmpty)
        #expect(FeedFixture.calls(in: broken).map(\.ending) == [.pending, .failed, .pending])
    }

    /// `Read 1` is the same line with the filename taken off it — a fold that loses information and
    /// saves no room. One quiet call is already as short as it gets.
    @Test
    func `a single read keeps its filename rather than folding to a count of one`() throws {
        let alone: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("read", tool: "Read", kind: .read, naming: "Token.swift")),
            .toolCallOutcome(FeedFixture.answered(
                "read",
                .output(OutputEvidence(tier: .direct, text: "let token = 1")),
            )),
        ]
        let call = try #require(FeedFixture.calls(in: alone).first)

        #expect(FeedFixture.surveys(in: FeedProjection.rows(from: alone)).isEmpty)
        #expect(call.subject.spoken == "Token.swift")
    }

    /// Counts follow the CALLS and not the rows: three reads of one file are already one collapsed
    /// row, and a survey saying `Read 1` about it would be counting lines rather than work.
    @Test
    func `a collapsed run inside a survey counts every call it stands for`() throws {
        let repeated: [TranscriptEvent] = (0 ..< 3).map { position in
            .toolCall(FeedFixture.call(
                "r\(position)",
                tool: "Read",
                kind: .read,
                naming: "a.swift",
            ))
        } + [.toolCall(FeedFixture.call("other", tool: "Read", kind: .read, naming: "b.swift"))]

        let survey = try #require(FeedFixture.surveys(in: FeedProjection.rows(from: repeated))
            .first)

        #expect(survey.label == "Read 4")
    }

    /// Folding is not discarding. Everything the run produced is still one click away, and each
    /// result says which of the files it came from — the one thing the folded line no longer does.
    @Test
    func `the fold keeps every result, each captioned by the call that produced it`() throws {
        let survey = try #require(
            FeedFixture.surveys(in: FeedProjection.rows(from: looking(at: ["a.swift", "b.swift"])))
                .first,
        )

        #expect(survey.disclosure == .available)
        #expect(survey.opened.steps.map(\.caption) == ["*Row", "a.swift", "b.swift"])
    }

    /// A run with nothing kept behind it does not offer a click that opens onto nothing.
    @Test
    func `a survey whose calls produced nothing is inert`() throws {
        let unanswered: [TranscriptEvent] = ["a.swift", "b.swift"].enumerated().map { at, path in
            .toolCall(FeedFixture.call("read-\(at)", tool: "Read", kind: .read, naming: path))
        }
        let survey = try #require(
            FeedFixture.surveys(in: FeedProjection.rows(from: unanswered)).first,
        )

        #expect(survey.disclosure == .none)
    }

    /// One search and N reads, each answered — the shape a turn's reconnaissance actually has.
    private func looking(at paths: [String]) -> [TranscriptEvent] {
        let search = "grep-\(paths.joined())"
        return [
            .toolCall(FeedFixture.call(search, tool: "Grep", kind: .search, naming: "*Row")),
            .toolCallOutcome(FeedFixture.answered(
                search,
                .output(OutputEvidence(tier: .direct, text: "4 matches")),
            )),
        ] + paths.flatMap { path -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    "read-\(path)",
                    tool: "Read",
                    kind: .read,
                    naming: path,
                )),
                .toolCallOutcome(FeedFixture.answered(
                    "read-\(path)",
                    .output(OutputEvidence(tier: .direct, text: "the contents of \(path)")),
                )),
            ]
        }
    }
}

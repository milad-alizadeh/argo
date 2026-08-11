import ArgoEngine
@testable import ArgoUI
import Testing

/// A stretch of looking costs one row even where the looking was done through a shell. Which
/// commands are let into that fold is answered from the command TEXT alone.
@Suite("Feed command folds")
struct FeedCommandFoldTests {
    @Test
    func `a run of recognised read-only commands folds into one counted line`() throws {
        let rows = FeedProjection.rows(from: ran("ls apps", "cat FeedCall.swift", "git status"))
        let survey = try #require(FeedFixture.surveys(in: rows).first)

        #expect(rows.count == 1)
        #expect(survey.label == "Ran 3")
    }

    @Test
    func `the folded line counts the commands beside the files`() throws {
        let mixed = ran("git status") + opened("a.swift") + ran("rtk cat a.swift")
        let survey = try #require(
            FeedFixture.surveys(in: FeedProjection.rows(from: mixed)).first,
        )

        #expect(survey.label == "Ran 2 · Read 1")
    }

    /// A command the allowlist does not name is loud, and no reading of it is attempted at all.
    @Test
    func `an unrecognised command stays its own row`() {
        let rows = FeedProjection.rows(from: ran("ls apps", "swift build", "git status"))

        #expect(rows.count == 3)
        #expect(FeedFixture.surveys(in: rows).isEmpty)
    }

    /// A chain is unrecognised by construction: the judgement never works out which half ran.
    @Test
    func `a chained line never folds, however read-only its first half looks`() {
        let rows = FeedProjection.rows(
            from: ran("git status && git commit -m x", "ls apps", "cat a.swift"),
        )

        #expect(rows.count == 2)
        #expect(FeedFixture.surveys(in: rows).map(\.label) == ["Ran 2"])
    }

    /// Every shape that has ever smuggled a command past a prefix check. One row per shape, so a
    /// failure names the shape that folded.
    @Test(arguments: [
        "git push", "rtk git push", "git status && git push", "git status; git push",
        "ls -la | git push", "git push origin main 2>&1", "git status | cat && git push",
        "cat log > pushed.txt", "find . -name '*.swift' -fprint pushed.txt",
    ])
    func `a mutation cannot appear inside a fold`(_ mutation: String) {
        #expect(FeedProjection.rows(from: ran("ls apps", mutation, "cat a.swift")).count == 3)
    }

    @Test
    func `a failed command breaks the run, however it would otherwise be judged`() {
        let broken: [TranscriptEvent] = ran("ls apps") + [
            .toolCall(FeedFixture.call("bad", tool: "shell", kind: .execute, naming: "cat gone")),
            .toolCallOutcome(FeedFixture.failed("bad", printing: "No such file")),
        ] + ran("git status")

        let rows = FeedProjection.rows(from: broken)

        #expect(rows.count == 3)
        #expect(FeedFixture.surveys(in: rows).isEmpty)
    }

    @Test
    func `a mutation breaks a run of commands into two surveys`() {
        let rows = FeedProjection.rows(from: interrupted)

        #expect(FeedFixture.surveys(in: rows).map(\.label) == ["Ran 2", "Ran 2"])
    }

    @Test
    func `the mutation that broke the run is a row between the two surveys`() {
        #expect(FeedProjection.rows(from: interrupted).count == 3)
    }

    /// The folded line no longer says which command printed what, so each step has to.
    @Test
    func `every folded command's result is in the panel, captioned by the call that produced it`()
        throws {
        let survey = try #require(
            FeedFixture.surveys(in: FeedProjection.rows(from: ran("ls apps", "git status"))).first,
        )

        #expect(survey.disclosure == .available)
        #expect(survey.opened.steps.map(\.address.text) == ["ls apps", "git status"])
    }

    /// Where the host wrote one, the agent's own account is what the step is addressed by.
    @Test
    func `a folded command's narration is what captions it`() throws {
        let narrated: [TranscriptEvent] = [
            (said: "Read the call vocabulary", command: "cat FeedCall.swift"),
            (said: "Check the working tree", command: "git status"),
        ].flatMap { said, command -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    command,
                    tool: "Bash",
                    kind: .execute,
                    naming: command,
                    saying: said,
                )),
                .toolCallOutcome(FeedFixture.answered(
                    command,
                    .output(OutputEvidence(tier: .direct, text: "…")),
                )),
            ]
        }
        let survey = try #require(
            FeedFixture.surveys(in: FeedProjection.rows(from: narrated)).first,
        )

        #expect(survey.opened.steps.map(\.address.text) == [
            "Read the call vocabulary", "Check the working tree",
        ])
    }

    /// The judgement reads the command and never the narration, so it works on a Codex Session —
    /// the host that writes no descriptions.
    @Test
    func `the fold works on a session with no narrations at all`() throws {
        let survey = try #require(
            FeedFixture.surveys(in: FeedProjection.rows(from: ran("rg Feed", "wc -l a.swift")))
                .first,
        )

        #expect(survey.label == "Ran 2")
    }

    @Test
    func `a run of one command is still not a fold`() throws {
        let alone = ran("git status")
        let call = try #require(FeedFixture.calls(in: alone).first)

        #expect(FeedFixture.surveys(in: FeedProjection.rows(from: alone)).isEmpty)
        #expect(call.subject.captioned == "git status")
    }

    /// Asserted here so a fixture change that quietly stopped it folding fails the suite rather
    /// than producing a screenshot that no longer shows what its caption says.
    @Test
    func `the specimen folds seven quiet calls into one counted line`() throws {
        let survey = try #require(FeedFixture.surveys(in: FeedProjection.previewFoldRows).first)

        #expect(survey.label == "Read 2 · Ran 5")
    }

    /// The four rows are the fold, the change it was for, and the two loud commands after it.
    @Test
    func `the specimen leaves the mutation and the two loud commands as rows`() {
        #expect(FeedProjection.previewFoldRows.count == 4)
    }

    /// A turn that looked at two files and ran a command, then changed something, then looked
    /// again.
    private var interrupted: [TranscriptEvent] {
        ran("ls apps", "cat a.swift")
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
            + ran("git status", "git diff")
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
                .toolCallOutcome(FeedFixture.answered(
                    command,
                    .output(OutputEvidence(tier: .direct, text: "what \(command) printed")),
                )),
            ]
        }
    }

    /// One file read the ordinary way. Not named `read` — `FeedFixture` already spells that with
    /// a different return type.
    private func opened(_ path: String) -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call("read-\(path)", tool: "Read", kind: .read, naming: path)),
            .toolCallOutcome(FeedFixture.answered(
                "read-\(path)",
                .output(OutputEvidence(tier: .direct, text: "the contents of \(path)")),
            )),
        ]
    }
}

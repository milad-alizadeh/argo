import ArgoEngine
@testable import ArgoUI
import Testing

/// The feed saying a Session was handed a skill (#688) — in the sequence it happened, and opening
/// on exactly the text Argo read rather than a summary of it.
@Suite("Feed skill loaded")
struct FeedSkillLoadedTests {
    private func load(
        _ name: String = "code-review",
        body: SkillBody? = .read("Two-axis review."),
    )
        -> SkillLoad {
        SkillLoad(
            name: name,
            directory: "/Users/x/argo/.claude/skills/\(name)",
            body: body,
        )
    }

    private func read(
        _ name: String = "code-review",
        body: SkillBody? = .read("Two-axis review."),
    )
        -> FeedSkillLoad {
        FeedSkillLoad(load(name, body: body))
    }

    @Test
    func `a skill load is a row of its own, where the record put it`() {
        let rows = FeedProjection.rows(from: [
            .prompt(text: "/code-review since main", atMs: 1000),
            .skillLoaded(load()),
            .message(markdown: "Reviewing the diff on two axes."),
        ])

        #expect(rows.map(\.content) == [
            .prompt("/code-review since main"),
            .skillLoaded(read()),
            .message("Reviewing the diff on two axes."),
        ])
    }

    /// The one thing this ticket must NOT do: a command the user typed stays their own line,
    /// verbatim. The expanded body is the marker's, and it appears nowhere as prose.
    @Test
    func `the user's own line is untouched by the load beside it`() {
        let rows = FeedProjection.rows(from: [
            .prompt(text: "/code-review since main", atMs: 1000),
            .skillLoaded(load()),
        ])

        #expect(rows.first?.content == .prompt("/code-review since main"))
        #expect(rows.count == 2)
        #expect(!rows.contains { $0.content == .message("Two-axis review.") })
    }

    @Test
    func `the marker opens on the SKILL_md body, as the text Argo read`() throws {
        let opened = try #require(FeedRow.Content.skillLoaded(read()).opened)
        let step = try #require(opened.steps.first)

        #expect(opened.steps.count == 1)
        #expect(step.address == .filed("/Users/x/argo/.claude/skills/code-review/SKILL.md"))
        #expect(step.result == .output(OutputEvidence(
            tier: .derived,
            text: "Two-axis review.",
        )))
    }

    /// A body Argo could not read is a marker with nothing behind it — no panel, and no claim about
    /// a file it never opened.
    @Test
    func `a load with nothing readable behind it opens nothing`() {
        let content = FeedRow.Content.skillLoaded(read(body: nil))

        #expect(!content.traits.opensEvidence)
        #expect(content.opened == nil)
    }

    /// The read that FAILED is a different case: the marker stands, the panel opens, and it states
    /// what went wrong rather than passing over it in silence.
    @Test
    func `a skill file that could not be read says so in the panel`() throws {
        let why = "Argo could not read /Users/x/argo/.claude/skills/code-review/SKILL.md."
        let content = FeedRow.Content.skillLoaded(read(body: .unreadable(why)))
        let opened = try #require(content.opened)

        #expect(content.traits.opensEvidence)
        #expect(opened.ending == .failed)
        #expect(opened.steps.first?.result == .output(OutputEvidence(tier: .derived, text: why)))
    }

    /// And said on the ROW, not only behind the click: a marker drawn like every other would leave
    /// the failure stated nowhere a reader has a reason to look.
    @Test
    func `a failed read colours the marker, as a failed call colours its line`() {
        #expect(read(body: .unreadable("Argo could not read it.")).ink == .failure)
        #expect(read().ink == .boundary)
        #expect(read(body: nil).ink == .boundary)
    }

    /// `Loaded` alone reads as truncated copy at the moment the reader is confirming which of
    /// several markers they opened.
    @Test
    func `the panel's header names the skill beside the verb`() throws {
        let opened = try #require(read().opened)

        #expect(opened.verb == "Loaded")
        #expect(opened.label == "code-review")
    }

    /// The marker is punctuation, not work and not prose: it must not join a run of looking, and it
    /// must not be counted among what anybody said.
    @Test
    func `the marker is neither work nor prose`() {
        let traits = FeedRow.Content.skillLoaded(read()).traits

        #expect(!traits.isCall)
        #expect(!traits.isProse)
        #expect(!traits.isPrompt)
        #expect(!traits.isMessage)
    }

    /// A shape does not carry: what the row draws in two runs is one sentence to a listener.
    @Test
    func `the marker names the skill to a listener`() {
        #expect(read().spoken == "Skill loaded: code-review")
    }
}

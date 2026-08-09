import ArgoEngine
@testable import ArgoUI
import Testing

/// What a row says when the agent already said it.
///
/// A Claude Code host requires a description on every command it runs, so the sentence the feed
/// wants was written before Argo opened the file. The claims here are that the row takes it, that
/// it takes it whole, and that taking it costs nothing the row already had.
@Suite("Feed narration")
struct FeedNarrationTests {
    @Test
    func `a described command's subject is what the agent said it was doing`() {
        #expect(ran(saying: "List open issues").first?.subject
            == .narration("List open issues", standingIn: "gh issue list --limit 20"))
    }

    /// Verbatim is the whole tier. The narrations are imperative-present and the feed's verbs are
    /// past, so a described row reads `Ran · List open issues` — a clash kept rather than fixed,
    /// because re-tensing is Argo putting words in the agent's mouth and it fails outright on a
    /// description like `Check PRs, main, open issues`.
    @Test
    func `the sentence is drawn in the agent's own words`() throws {
        let call = try #require(ran(saying: "Check PRs, main, open issues").first)

        #expect(call.subject.captioned == "Check PRs, main, open issues")
        #expect(call.kind.verb == "Ran")
    }

    /// The mark column is the thing a reader scans, so a described row keeps the same shape as
    /// every other: a verb, and after it the name of the thing.
    @Test
    func `a described row still says what kind of call it was`() throws {
        let call = try #require(ran(saying: "Build the UI package").first)

        #expect(call.kind == .execute)
        #expect(call.kind.symbol == ArgoSymbol.ran)
    }

    /// The command is what the row could not say, so it is exactly what the panel is open on.
    @Test
    func `the panel behind a described row opens on the command and not the sentence`() throws {
        let call = try #require(ran(saying: "List open issues").first)

        #expect(call.opened.address == .typed("gh issue list --limit 20"))
    }

    /// A CLI that narrates nothing — Codex's shell call carries a command and never a description.
    @Test
    func `a call with no narration falls back to its command exactly as before`() {
        #expect(ran(saying: nil).first?.subject == .command("gh issue list --limit 20"))
    }

    /// The delegating call's other input is the whole brief. A row that took THAT would be a
    /// paragraph where every other row is a line.
    @Test
    func `a delegated row says the short description`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "fan", tool: "Agent", kind: .delegate,
                naming: "Review the feed's call reading",
                saying: "Review the feed's call reading",
            )),
        ])

        // The description is the only thing the delegating call names, so it is both — and the
        // brief, which is the input the row is NOT allowed to grow into, is nowhere in either.
        #expect(calls.first?.subject.captioned == "Review the feed's call reading")
        #expect(calls.first?.kind.verb == "Delegated")
    }

    /// A tool nobody classified used to be named by itself, because the field its target was
    /// scraped from means nothing without a kind to read it under. A description is not a scraped
    /// field: it is the host asking the agent what the call was FOR.
    @Test
    func `an unclassified tool that narrated itself says the narration`() {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "artifact", tool: "Artifact", kind: .other,
                naming: "scratchpad/report.html", saying: "Publish the legibility report",
            )),
        ])

        #expect(calls.first?.subject == .narration(
            "Publish the legibility report", standingIn: "scratchpad/report.html",
        ))
    }

    /// A subject that already identifies itself keeps doing so. `Read`/`Edit`/`Write` and `Skill`
    /// carry no description at all, and an MCP tool's own input is arbitrary — the claim is that a
    /// row which somehow arrived with one still says the address it always said.
    @Test(arguments: [
        Addressed(tool: "Read", kind: .read, named: "Sources/Feed.swift", says: "Feed.swift"),
        Addressed(tool: "Skill", kind: .skill, named: "grill", says: "grill"),
        Addressed(
            tool: "mcp__linear__list_issues", kind: .mcp,
            named: "open issues", says: "linear · list_issues",
        ),
    ])
    func `a subject with an address of its own is not displaced`(_ row: Addressed) {
        let calls = FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "call", tool: row.tool, kind: row.kind,
                naming: row.named, saying: "An account of the call",
            )),
        ])

        #expect(calls.first?.subject.captioned == row.says)
    }

    /// One row of that table: a call already addressed by something of its own, and the address it
    /// has to keep saying.
    struct Addressed: Sendable {
        let tool: String
        let kind: ToolCallKind
        let named: String
        let says: String
    }

    /// The disclosure is derived from the evidence and from nothing else, which a new subject shape
    /// is exactly the sort of change that could quietly break: a chevron on a row with nothing
    /// behind it is a click the feed asked for and then wasted.
    @Test
    func `a described row the record answered with nothing stays inert`() throws {
        let call = try #require(FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "run", tool: "Bash", kind: .execute,
                naming: "git push", saying: "Push the ticket branch",
            )),
            .toolCallOutcome(FeedFixture.answered("run", nil)),
        ]).first)

        #expect(call.disclosure == .none)
    }

    @Test
    func `the spoken row reads as the drawn one`() {
        #expect(ran(saying: "List open issues").first?.spoken
            == "Ran List open issues still running")
    }

    /// One command, narrated or not — the fixture every claim above is a reading of, so the only
    /// thing that ever differs between two of them is whether the agent said anything.
    private func ran(saying narration: String?) -> [FeedCall] {
        FeedFixture.calls(in: [
            .toolCall(FeedFixture.call(
                "run", tool: "Bash", kind: .execute,
                naming: "gh issue list --limit 20", saying: narration,
            )),
        ])
    }
}

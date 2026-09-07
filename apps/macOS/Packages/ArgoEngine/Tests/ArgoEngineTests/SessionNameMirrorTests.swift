@testable import ArgoEngine
import Testing

/// Typing the name the roster draws at the Session's own prompt (#1623).
///
/// #1494 typed a name on two triggers — the rename dialog and a settled Ticket — so every row
/// wearing a prompt-derived name read as `milads-mac-mini-local-fuzzy-thimble` on the phone. Half
/// of 488 transcripts held no Claude-side title at all, so reading alone leaves half the roster
/// nameless there. The rule since #1653 is ONE TYPIST, and it is Argo: whatever the roster draws
/// is typed at the Session's own prompt, whether or not the CLI already holds a title. The single
/// exception is a floor under a name Argo derived itself, and it is a timing rule rather than a
/// preference — see the actor.
///
/// The name is read back with `/list-agents`, which is what the two surfaces agreeing means in
/// practice: the row and that listing spell the Session the same way, character for character,
/// while the agent is still working.
@Suite("Session name mirror")
struct SessionNameMirrorTests {
    @Test
    func `a prompt-derived name is typed at a Session whose CLI holds no title`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": SessionNameFixture.derived("Fix the roster titles")],
            against: ["chain-a": SessionNameFixture.unnamed],
        )

        #expect(await mirrored.calls()
            == [MirroredNames.Call(title: "Fix the roster titles", sessionID: "chain-a")])
    }

    /// #1623's open decision, taken the other way (#1653). It USED to yield here — "Claude wins
    /// where Claude has a name" — and that reversed reading is the whole of this claim.
    ///
    /// Two surfaces disagreeing permanently was the cost: the roster drew the Ticket's sentence,
    /// the CLI kept the summariser's, and nothing corrected either. Which one a Session ended up
    /// with was decided by whether Argo's sweep or Claude's summariser got there first, so the
    /// rows that agreed were the ones that won a race.
    @Test
    func `a Session whose summariser has named it is renamed to the roster's words`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": SessionNameFixture.derived("Fix the roster titles")],
            against: ["chain-a": SessionNameFixture.named("Roster titles and the mirror")],
        )

        #expect(await mirrored.calls()
            == [MirroredNames.Call(title: "Fix the roster titles", sessionID: "chain-a")])
    }

    /// The bug both #1653 and #1658 were really about, and the one a passing suite hid.
    ///
    /// A Session started from a Ticket is drawn under its opening PROMPT for the first seconds —
    /// `/implement 1665` — because the Ticket's words have not been resolved yet. The mirror types
    /// that, and the CLI writes it as a `custom-title`. Under the old gate the standing read back
    /// non-nil from then on, so the Ticket's real words, when they landed a moment later, were
    /// refused against a title ARGO HAD WRITTEN ITSELF.
    ///
    /// Measured on #1665 before the fix: five title records in the transcript, all five
    /// `/implement 1665`, while the row read "The unknown stance has no test pinning that it
    /// refuses a slash command too". `/list-agents` read the placeholder.
    @Test
    func `a placeholder Argo typed itself is replaced by the Ticket's words`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)

        await mirror.carry(
            ["chain-a": SessionNameFixture.drawn("/implement 1665")],
            against: ["chain-a": SessionNameFixture.unnamed],
        )
        // What the next sweep reads back: the CLI now holds the placeholder BECAUSE the line above
        // went, which is exactly the standing the old gate mistook for Claude having named it.
        await mirror.carry(
            ["chain-a": SessionNameFixture.drawn("The unknown stance has no test pinning it")],
            against: ["chain-a": SessionNameFixture.named("/implement 1665")],
        )

        #expect(await mirrored.calls().map(\.title) == [
            "/implement 1665",
            "The unknown stance has no test pinning it",
        ])
    }

    /// A person's rename over a CLI title, which used to be the ONE exception the gate carried and
    /// is now just the general rule applied to one more row (#1653). Kept as its own claim because
    /// the case is the one a reader can see happening to them.
    @Test
    func `a name the reader typed is mirrored over a title the CLI already holds`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": SessionNameFixture.readerNamed("Tonight's run")],
            against: ["chain-a": SessionNameFixture.named("Roster titles and the mirror")],
        )

        #expect(await mirrored.calls()
            == [MirroredNames.Call(title: "Tonight's run", sessionID: "chain-a")])
    }

    /// The sweep runs whenever a drawn name or a Session's readiness moves, so a mirror per sweep
    /// would retype `/rename` at a Session that has been on the right name for hours.
    @Test
    func `a name that has not changed is typed once and never again`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)
        let draws = ["chain-a": SessionNameFixture.derived("Fix the roster titles")]

        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.unnamed])
        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.unnamed])

        #expect(await mirrored.calls().count == 1)
    }

    /// The other half of that rule: a row whose words MOVE after the CLI was told the earlier ones
    /// has to be told again (#1656). The memory above is what a standing row is skipped on, so what
    /// it must never read as "done" is "typed once".
    @Test
    func `a name that changed since it was typed is typed again`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)

        await mirror.carry(
            ["chain-a": SessionNameFixture.derived("Read the ticket")],
            against: ["chain-a": SessionNameFixture.unnamed],
        )
        // The standing a later sweep reads back: the CLI is holding the FIRST name, because the
        // line above put it there.
        await mirror.carry(
            ["chain-a": SessionNameFixture.derived("Pin the retype the mirror has no test for")],
            against: ["chain-a": SessionNameFixture.named("Read the ticket")],
        )

        #expect(await mirrored.calls().map(\.title) == [
            "Read the ticket",
            "Pin the retype the mirror has no test for",
        ])
    }

    /// The refusal is the ordinary case — a Turn in flight, a pending Permission, a question — and
    /// it must not be permanent. This is the retry the rename dialog never had: a Session busy at
    /// the moment the reader renamed it kept the Argo name and never got the CLI one.
    @Test
    func `a name the prompt could not take is offered again on the next sweep`() async {
        let mirrored = MirroredNames(takes: false)
        let mirror = SessionNameMirror(mirror: mirrored.mirror)
        let draws = ["chain-a": SessionNameFixture.readerNamed("Tonight's run")]

        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.unnamed])
        await mirrored.nowTakes(true)
        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.unnamed])
        // And once it has landed, it stops being offered.
        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.unnamed])

        #expect(await mirrored.calls().count == 2)
    }

    /// What a launch after a successful mirror reads: nothing carried the memory across it, and the
    /// CLI is already on these words. Filed rather than typed, so it is asked once and not once per
    /// sweep — and a `/rename` storm at every launch is what this claim is watching for.
    @Test
    func `a CLI already on these words is filed and never typed at`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)
        let draws = ["chain-a": SessionNameFixture.readerNamed("Tonight's run")]

        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.named("Tonight's run")])
        await mirror.carry(draws, against: ["chain-a": SessionNameFixture.unnamed])

        #expect(await mirrored.calls().isEmpty)
    }

    /// A `codex` Session has no `/rename` and no title of its own (#1494), so its driver refuses
    /// the line and nothing stays filed. It keeps the name Argo derives, and the refusal is
    /// silence.
    @Test
    func `a Session whose CLI will not take a rename keeps its derived name silently`() async {
        let mirrored = MirroredNames(takes: false)

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["codex-a": SessionNameFixture.derived("Fix the roster titles")],
            against: ["codex-a": SessionNameFixture.unnamed],
        )

        #expect(await mirrored.calls().count == 1)
    }

    @Test
    func `every row on the roster is offered, not just the first`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            [
                "chain-a": SessionNameFixture.derived("Fix the roster titles"),
                "chain-b": SessionNameFixture.readerNamed("Tonight's run"),
                // Refused by the FLOOR, not by any title the CLI holds — that gate is gone
                // (#1653), so a row still has to be refusable for this claim to say anything.
                "chain-c": SessionNameFixture.derived("/clear"),
            ],
            against: [
                "chain-a": SessionNameFixture.unnamed,
                "chain-b": SessionNameFixture.unnamed,
                "chain-c": SessionNameFixture.unworded,
            ],
        )

        #expect(await mirrored.calls().map(\.sessionID).sorted() == ["chain-a", "chain-b"])
    }
}

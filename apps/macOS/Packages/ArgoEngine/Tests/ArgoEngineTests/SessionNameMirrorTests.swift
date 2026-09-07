@testable import ArgoEngine
import Testing

/// Typing the name the roster draws at the Session's own prompt (#1623).
///
/// #1494 typed a name on two triggers — the rename dialog and a settled Ticket — so every row
/// wearing a prompt-derived name read as `milads-mac-mini-local-fuzzy-thimble` on the phone. Half
/// of 488 transcripts held no Claude-side title at all, so reading alone leaves half the roster
/// nameless there. The rule is that the name travels both ways: Claude wins where Claude has a
/// name, and Argo speaks where it does not.
@Suite("Session name mirror")
struct SessionNameMirrorTests {
    @Test
    func `a prompt-derived name is typed at a Session whose CLI holds no title`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": Self.derived("Fix the roster titles")],
            against: ["chain-a": Self.unnamed],
        )

        #expect(await mirrored.calls()
            == [MirroredNames.Call(title: "Fix the roster titles", sessionID: "chain-a")])
    }

    /// The open decision in #1623, taken the way the ticket asked: Argo mirrors only while the CLI
    /// holds no title of its own, and yields the moment the summariser writes one. Replacing it
    /// would put Argo's derived sentence over the CLI's own reading of the conversation, which is
    /// what `Hub+Drive` refused to do.
    @Test
    func `a Session whose summariser has named it is left alone`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": Self.derived("Fix the roster titles")],
            against: ["chain-a": Self.named("Roster titles and the mirror")],
        )

        #expect(await mirrored.calls().isEmpty)
    }

    /// The one exception, and the reason the gate is not a single question: a person naming this
    /// Session in Argo is not a reading Argo may yield to a summariser's sentence.
    @Test
    func `a name the reader typed is mirrored over a title the CLI already holds`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": Self.readerNamed("Tonight's run")],
            against: ["chain-a": Self.named("Roster titles and the mirror")],
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
        let draws = ["chain-a": Self.derived("Fix the roster titles")]

        await mirror.carry(draws, against: ["chain-a": Self.unnamed])
        await mirror.carry(draws, against: ["chain-a": Self.unnamed])

        #expect(await mirrored.calls().count == 1)
    }

    /// The refusal is the ordinary case — a Turn in flight, a pending Permission, a question — and
    /// it must not be permanent. This is the retry the rename dialog never had: a Session busy at
    /// the moment the reader renamed it kept the Argo name and never got the CLI one.
    @Test
    func `a name the prompt could not take is offered again on the next sweep`() async {
        let mirrored = MirroredNames(takes: false)
        let mirror = SessionNameMirror(mirror: mirrored.mirror)
        let draws = ["chain-a": Self.readerNamed("Tonight's run")]

        await mirror.carry(draws, against: ["chain-a": Self.unnamed])
        await mirrored.nowTakes(true)
        await mirror.carry(draws, against: ["chain-a": Self.unnamed])
        // And once it has landed, it stops being offered.
        await mirror.carry(draws, against: ["chain-a": Self.unnamed])

        #expect(await mirrored.calls().count == 2)
    }

    /// What a launch after a successful mirror reads: nothing carried the memory across it, and the
    /// CLI is already on these words. Filed rather than typed, so it is asked once and not once per
    /// sweep — and a `/rename` storm at every launch is what this claim is watching for.
    @Test
    func `a CLI already on these words is filed and never typed at`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)
        let draws = ["chain-a": Self.readerNamed("Tonight's run")]

        await mirror.carry(draws, against: ["chain-a": Self.named("Tonight's run")])
        await mirror.carry(draws, against: ["chain-a": Self.unnamed])

        #expect(await mirrored.calls().isEmpty)
    }

    /// A `codex` Session has no `/rename` and no title of its own (#1494), so its driver refuses
    /// the line and nothing stays filed. It keeps the name Argo derives, and the refusal is
    /// silence.
    @Test
    func `a Session whose CLI will not take a rename keeps its derived name silently`() async {
        let mirrored = MirroredNames(takes: false)

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["codex-a": Self.derived("Fix the roster titles")],
            against: ["codex-a": Self.unnamed],
        )

        #expect(await mirrored.calls().count == 1)
    }

    @Test
    func `every row on the roster is offered, not just the first`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            [
                "chain-a": Self.derived("Fix the roster titles"),
                "chain-b": Self.readerNamed("Tonight's run"),
                "chain-c": Self.derived("Read the ticket"),
            ],
            against: [
                "chain-a": Self.unnamed,
                "chain-b": Self.unnamed,
                "chain-c": Self.named("Reading the ticket"),
            ],
        )

        #expect(await mirrored.calls().map(\.sessionID).sorted() == ["chain-a", "chain-b"])
    }

    /// The floor under a name of Argo's OWN making, and it has to be a floor: typing
    /// `/rename <uuid>` makes the CLI write a `custom-title`, which is the TOP of the ladder — so
    /// the row would outrank every prompt and every summariser title that followed, and wear a
    /// transcript filename on both surfaces for good. The bare `/clear` that opens a fresh
    /// transcript is the same trap, and `SessionTitle` calls it takeable for exactly that reason.
    @Test
    func `a derived name that says nothing about the work is never typed`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            [
                "placeholder": Self.derived("6f3ab2c1-90d4-4e1a-8b77-2c5f0e9a1d33"),
                "provisional": Self.derived("/clear"),
            ],
            against: ["placeholder": Self.unworded, "provisional": Self.unworded],
        )

        #expect(await mirrored.calls().isEmpty)
    }

    /// The floor is on the DERIVED name alone. A Ticket's sentence says what the work is whatever
    /// the transcript has managed to say about it, so a row wearing one is typed even where the
    /// Session's own name has not risen past its filename.
    @Test
    func `a name Argo did not derive clears the floor without it`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror).carry(
            ["chain-a": Self.drawn("Derive the link", isReaderNamed: false)],
            against: ["chain-a": Self.unworded],
        )

        #expect(await mirrored.calls()
            == [MirroredNames.Call(title: "Derive the link", sessionID: "chain-a")])
    }

    /// A row the sweep was handed no standing for. Nothing should produce one — both maps are built
    /// off the same roster pass — so the honest answer is the quieter one: say nothing rather than
    /// type at a Session Argo cannot state a thing about (`CONTEXT.md` L2 · degrade-down).
    @Test
    func `a row with no standing to read is left alone`() async {
        let mirrored = MirroredNames()

        await SessionNameMirror(mirror: mirrored.mirror)
            .carry(["chain-a": Self.derived("Fix the roster titles")], against: [:])

        #expect(await mirrored.calls().isEmpty)
    }

    /// The window fires an unstructured `Task` per roster change and this actor suspends inside the
    /// keystroke, so two sweeps interleave there. Filed BEFORE the await, or the second sweep finds
    /// no memory for the row and types the same `/rename` again — the duplicate keystroke removed
    /// from the rename dialog, back by another route.
    @Test
    func `two sweeps racing on one row type the name once`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)
        let draws = ["chain-a": Self.derived("Fix the roster titles")]
        let standings = ["chain-a": Self.unnamed]

        async let first: Void = mirror.carry(draws, against: standings)
        async let second: Void = mirror.carry(draws, against: standings)
        _ = await (first, second)

        #expect(await mirrored.calls().count == 1)
    }

    /// A Session whose CLI holds no title and whose own name says something about the work — the
    /// ordinary row, and the one the reported bug was about.
    private static let unnamed = SessionNameStanding(cliTitle: nil, namesTheWork: true)

    /// The same, before its first real prompt: a filename or a bare `/clear`, and nothing to say.
    private static let unworded = SessionNameStanding(cliTitle: nil, namesTheWork: false)

    private static func named(_ title: String) -> SessionNameStanding {
        SessionNameStanding(cliTitle: title, namesTheWork: true)
    }

    private static func derived(_ name: String) -> SessionNameDraw {
        drawn(name, isReaderNamed: false, drawsDerivedTitle: true)
    }

    private static func readerNamed(_ name: String) -> SessionNameDraw {
        drawn(name, isReaderNamed: true)
    }

    private static func drawn(
        _ name: String, isReaderNamed: Bool, drawsDerivedTitle: Bool = false,
    )
        -> SessionNameDraw {
        SessionNameDraw(
            name: name,
            isReaderNamed: isReaderNamed,
            drawsDerivedTitle: drawsDerivedTitle,
            takesTypedLine: true,
        )
    }
}

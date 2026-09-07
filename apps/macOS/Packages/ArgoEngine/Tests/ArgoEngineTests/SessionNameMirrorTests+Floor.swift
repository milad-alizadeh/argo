@testable import ArgoEngine
import Testing

/// The FLOOR under a name of Argo's own making, and the two readings that refuse a row outright
/// (#1623). Apart from `SessionNameMirrorTests` because it is the exception to it: the rule says
/// every name the roster draws is typed, and these are the rows where nothing is.
@Suite("Session name mirror floor")
struct SessionNameMirrorFloorTests {
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
                "placeholder": SessionNameFixture.derived("6f3ab2c1-90d4-4e1a-8b77-2c5f0e9a1d33"),
                "provisional": SessionNameFixture.derived("/clear"),
            ],
            against: [
                "placeholder": SessionNameFixture.unworded,
                "provisional": SessionNameFixture.unworded,
            ],
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
            ["chain-a": SessionNameFixture.drawn("Derive the link")],
            against: ["chain-a": SessionNameFixture.unworded],
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
            .carry(["chain-a": SessionNameFixture.derived("Fix the roster titles")], against: [:])

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
        let draws = ["chain-a": SessionNameFixture.derived("Fix the roster titles")]
        let standings = ["chain-a": SessionNameFixture.unnamed]

        async let first: Void = mirror.carry(draws, against: standings)
        async let second: Void = mirror.carry(draws, against: standings)
        _ = await (first, second)

        #expect(await mirrored.calls().count == 1)
    }

    /// The retype meets this floor on its way through too, which is the one shape
    /// `a name that changed since it was typed is typed again` cannot also carry (#1656): a row
    /// whose DERIVED words move DOWN to a placeholder — a `/clear`
    /// opening a fresh transcript, a summary that lost the thread — is not typed, because typing it
    /// would write `/clear` as a `custom-title` and pin the row at the top of the ladder for good.
    /// The CLI keeps the real name it already has, and the memory keeps the words it sent.
    @Test
    func `a retype whose new words say nothing about the work is refused`() async {
        let mirrored = MirroredNames()
        let mirror = SessionNameMirror(mirror: mirrored.mirror)

        await mirror.carry(
            ["chain-a": SessionNameFixture.derived("Read the ticket")],
            against: ["chain-a": SessionNameFixture.unnamed],
        )
        await mirror.carry(
            ["chain-a": SessionNameFixture.derived("/clear")],
            against: ["chain-a": SessionNameFixture.unworded],
        )
        // And the first name is still filed, so the row is not retyped with words it already has
        // once the floor lifts on a later sweep.
        await mirror.carry(
            ["chain-a": SessionNameFixture.derived("Read the ticket")],
            against: ["chain-a": SessionNameFixture.named("Read the ticket")],
        )

        #expect(await mirrored.calls().map(\.title) == ["Read the ticket"])
    }
}

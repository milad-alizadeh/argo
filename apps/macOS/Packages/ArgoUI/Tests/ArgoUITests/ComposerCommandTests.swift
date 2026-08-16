import ArgoEngine
@testable import ArgoUI
import Testing

/// What picking a command out of the `/` menu does to the draft (#685, design decision 1).
@Suite("Composer commands")
struct ComposerCommandTests {
    /// It inserts and never sends. The trailing space is the caret's landing place, so an argument
    /// is typed as ordinary text after it.
    @Test
    func `picking a command leaves it in the draft with room after it`() {
        var draft = ComposerDraft(text: "/impl")
        draft.take("/implement")

        #expect(draft.text == "/implement ")
        #expect(draft.isSendable)
    }

    /// That space is also what puts the menu away, so the line the reader goes on typing is one
    /// they can send — `slash-args.png` has no menu over it.
    @Test
    func `the space it leaves closes the menu`() {
        var draft = ComposerDraft(text: "/impl")
        draft.take("/implement")

        #expect(CommandMenuProjection.query(in: draft.text) == nil)
        #expect(CommandMenuProjection.menu(for: draft.text, in: catalog) == nil)
    }

    /// The whole line is replaced, not patched: the menu only opens on a line that is a `/` and a
    /// run of non-space, so the fragment IS the line.
    @Test
    func `it replaces the fragment rather than appending to it`() {
        var draft = ComposerDraft(text: "/co")
        draft.take("/code-review")

        #expect(draft.text == "/code-review ")
    }

    /// A plugin's skills are namespaced, and the namespace is part of what the CLI answers to.
    @Test
    func `a plugin's command carries its plugin`() {
        var draft = ComposerDraft(text: "/simp")
        draft.take("/argo:simplify")

        #expect(draft.text == "/argo:simplify ")
    }

    private let catalog = CommandCatalog(
        commands: [Command(name: "implement", description: nil, origin: .project)],
        builtins: .read,
    )
}

import ArgoEngine
@testable import ArgoUI
import Testing

/// What both composer sigils share once they are one module (#751): the shape a derive returns,
/// and what a pick off it does to the line.
@Suite("Composer menu")
struct ComposerMenuTests {
    private static let tree = ["README.md", "docs/adr/ADR-0024-session-drive-port.md"]

    private static let catalog = CommandCatalog(
        commands: [Command(name: "implement", description: "Build it.", origin: .project)],
        builtins: .read,
    )

    /// The token is the tail of the line for both sigils, and a pick replaces exactly it: `/` takes
    /// the whole line, `@` takes the last token and leaves the sentence before it standing.
    @Test(arguments: [
        ("/impl", "/implement "),
        ("Have a look at @adr", "Have a look at @docs/adr/ADR-0024-session-drive-port.md "),
    ])
    func `a pick replaces the token and nothing before it`(line: String, taken: String) throws {
        var draft = ComposerDraft(text: line)
        let listing = try #require(Self.listing(for: line))
        let row = try #require(listing.rows.first)

        draft.take(listing.pick(row))

        #expect(draft.text == taken)
    }

    /// Counted off the query rather than carried as a `String.Index`, so a pick can never be taken
    /// against a line the index no longer fits.
    @Test(arguments: ["/impl", "Have a look at @adr"])
    func `a pick drops the sigil and everything typed after it`(line: String) throws {
        let listing = try #require(Self.listing(for: line))
        let row = try #require(listing.rows.first)

        #expect(listing.pick(row).dropping == listing.query.count + 1)
    }

    /// Each sigil names its own subject on the zero line — the reassurance after it is shared, so
    /// the only thing that may differ is the part naming what was looked in.
    @Test
    func `each sigil names its own subject on the zero line`() {
        #expect(ComposerMenu.Sigil.command.nothingMatched != ComposerMenu.Sigil.file.nothingMatched)
    }

    @Test(arguments: [(ComposerMenu.Sigil.command, Character("/")), (.file, "@")])
    func `each sigil says back the character the reader typed`(
        sigil: ComposerMenu.Sigil,
        mark: Character,
    ) {
        #expect(sigil.mark == mark)
    }

    /// A sigil that reads from one place groups nothing: one unlabelled section, so the shared
    /// list draws no header over it.
    @Test
    func `a sigil with one source returns one unlabelled section`() throws {
        let listing = try #require(ComposerMenu.files(for: "@", in: Self.tree, touched: []))

        #expect(listing.sections.map(\.label) == [nil])
    }

    /// And reports nothing: one clock read the tree, so there is no slower half to say is late.
    @Test
    func `a sigil with one source carries no status strip`() throws {
        let listing = try #require(ComposerMenu.files(for: "@", in: Self.tree, touched: []))

        #expect(listing.status == nil)
    }

    /// Nothing matched is no sections rather than an empty one, for both sigils — that is what the
    /// shared list reads to draw its zero line instead of a list of nothing.
    @Test(arguments: ["/graphify", "@zzzz"])
    func `nothing matched leaves no sections at all`(line: String) throws {
        let listing = try #require(Self.listing(for: line))

        #expect(listing.sections.isEmpty)
        #expect(listing.isEmpty)
    }

    private static func listing(for line: String) -> ComposerMenu.Listing? {
        ComposerMenu.commands(for: line, in: catalog)
            ?? ComposerMenu.files(for: line, in: tree, touched: [])
    }
}

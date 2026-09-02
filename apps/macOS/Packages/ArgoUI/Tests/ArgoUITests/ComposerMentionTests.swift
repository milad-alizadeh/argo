@testable import ArgoUI
import Testing

/// What picking a file out of the `@` menu does to the draft, and what the line does next (#687,
/// design decision 12).
@Suite("Composer mentions")
struct ComposerMentionTests {
    private static let path =
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionDriver.swift"
    private static let tree = [path, "README.md"]

    @Test
    func `picking a file puts the whole path where the token was`() {
        var draft = ComposerDraft(text: "Have a look at @sesdri")
        take(into: &draft)

        #expect(draft.text == "Have a look at @\(Self.path) ")
    }

    /// Unlike `take(_ command:)`, which replaces the whole line. A mention is said mid-sentence,
    /// so everything before the token has to survive.
    @Test
    func `the words before the token are left alone`() {
        var draft = ComposerDraft(text: "Compare this against @sesdri")
        take(into: &draft)

        #expect(draft.text.hasPrefix("Compare this against @apps/"))
    }

    /// The space the insertion leaves settles the token, which closes the menu — and THAT is what
    /// leaves the next ⏎ to the field. Without it a mention could never be sent, because Return
    /// would go on picking the row under the cursor forever.
    @Test
    func `the space it leaves closes the menu, so the next Return sends`() {
        var draft = ComposerDraft(text: "Have a look at @sesdri")
        take(into: &draft)

        #expect(ComposerMenu.mention(in: draft.text) == nil)
        #expect(draft.isSendable)
    }

    /// #682's defect read at this composer: a Turn whose text carries an `@` token must submit on
    /// the FIRST send. The engine half is `ClaudeTurnTests`, which asserts the Return goes as its
    /// own write; this is the half above it — the picker must not leave a menu standing over the
    /// ⏎ that would send.
    @Test
    func `a Turn carrying a mention submits on the first send`() {
        var draft = ComposerDraft(text: "Have a look at @sesdri")
        take(into: &draft)
        var sent: [String] = []

        draft.submit(whileRunning: false) { text, _ in sent.append(text) }

        #expect(sent == ["Have a look at @\(Self.path) "])
        #expect(draft.text.isEmpty)
    }

    /// It stays TEXT. Dropping and pasting make `AttachmentChip`s (#540) — a different act with a
    /// different result — and a chip here would be a second representation of the same intent.
    @Test
    func `a mention makes no attachment chip`() {
        var draft = ComposerDraft(text: "@sesdri")
        take(into: &draft)

        #expect(draft.attachments.isEmpty)
    }

    /// The two menus cannot both be open, and by construction rather than by a guard: `/` opens
    /// only at the head of the line, `@` only on a token still being typed.
    @Test(arguments: ["/implement", "/", "Have a look at @ses", "@", "/impl @x"])
    func `at most one composer menu is open on any line`(_ text: String) {
        let commands = ComposerMenu.command(in: text) != nil
        let files = ComposerMenu.mention(in: text) != nil

        #expect(!(commands && files))
    }

    private func take(into draft: inout ComposerDraft) {
        guard let listing = ComposerMenu.files(for: draft.text, in: Self.tree, touched: []),
              let row = listing.rows.first else { return }
        draft.take(listing.pick(row))
    }
}

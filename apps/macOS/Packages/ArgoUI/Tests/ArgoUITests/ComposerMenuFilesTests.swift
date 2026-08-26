@testable import ArgoUI
import Testing

/// Where the `@` menu opens, what it lists and in what order (#687, `cockpit-composer-picker.md`
/// decisions 2, 12 and 13).
@Suite("Composer menu — files")
struct ComposerMenuFilesTests {
    private static let tree = [
        "README.md",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionDriver.swift",
        "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/SessionComposer.swift",
        "docs/adr/ADR-0024-session-drive-port.md",
    ]

    /// Case folding happens once when the `Tree` is built, not per keystroke, so the matcher reads
    /// an already-lowercased path. A regression here is silent: an uppercase path simply stops
    /// matching a lowercase query.
    @Test(arguments: ["@readme", "@README", "@ReAdMe", "@ADR", "@adr"])
    func `matching ignores case in both the query and the path`(_ line: String) {
        let rows = ComposerMenu.files(for: line, in: Self.tree, touched: [])?.rows ?? []

        #expect(!rows.isEmpty)
    }

    // MARK: - Where it opens

    @Test
    func `an at sign at the head of the line opens the menu`() {
        #expect(ComposerMenu.mention(in: "@")?.query.isEmpty == true)
    }

    @Test
    func `an at sign after a space opens it too, because a mention is a token`() {
        // Unlike `/`, which decision 2 holds to the head of the line: naming a file is something
        // said in the middle of a sentence.
        #expect(ComposerMenu.mention(in: "Have a look at @sesdri")?.query == "sesdri")
    }

    @Test
    func `an at sign inside a word opens nothing`() {
        // `milad@example.com` is an address, not a mention — the same shape of rule that keeps
        // `/usr/local` from opening the command menu.
        #expect(ComposerMenu.mention(in: "mail milad@example.com") == nil)
    }

    @Test
    func `a space after the token closes it, which is what makes the line sendable`() {
        #expect(ComposerMenu.mention(in: "look at @README.md now") == nil)
    }

    @Test
    func `only the last token is live, so an earlier mention does not reopen`() {
        let mention = ComposerMenu.mention(in: "@README.md and @Session")

        #expect(mention?.query == "Session")
    }

    @Test
    func `a line with no at sign in it opens nothing`() {
        #expect(ComposerMenu.mention(in: "just some prose") == nil)
    }

    // MARK: - What it lists

    @Test
    func `a bare at sign lists the whole tree`() {
        #expect(menu(for: "@")?.rows.count == 4)
    }

    @Test
    func `matching is a subsequence over the WHOLE path`() {
        // Decision 13: `sesdri` reaches `…/Session/SessionDriver.swift` in six keystrokes, and
        // the characters are nowhere near consecutive.
        let rows = menu(for: "@sesdri")?.rows ?? []

        #expect(rows.contains { $0.id.hasSuffix("SessionDriver.swift") })
    }

    @Test
    func `a subsequence out of order does not match`() {
        #expect(menu(for: "@driverses")?.rows.isEmpty == true)
    }

    @Test
    func `matching ignores case`() {
        #expect(menu(for: "@readme")?.rows.first?.id == "README.md")
    }

    @Test
    func `a row splits the filename off the directory that holds it`() {
        let row = menu(for: "@ADR-0024")?.rows.first

        #expect(row?.lead == "ADR-0024-session-drive-port.md")
        #expect(row?.detail?.words == "docs/adr")
    }

    @Test
    func `a file at the root of the tree names no directory`() {
        #expect(menu(for: "@README")?.rows.first?.detail?.words == nil)
    }

    // MARK: - Order

    @Test
    func `files this Session has touched sort first`() {
        let touched = ["docs/adr/ADR-0024-session-drive-port.md"]
        let rows = menu(for: "@", touched: touched)?.rows ?? []

        #expect(rows.first?.id == touched[0])
        #expect(rows.first?.badges.map(\.words) == [ComposerMenu.touched])
    }

    @Test
    func `the untouched rest keeps the order the tree was listed in`() {
        let rows = menu(for: "@", touched: ["README.md"])?.rows ?? []

        #expect(rows.dropFirst().map(\.id) == Array(Self.tree.dropFirst()))
    }

    @Test
    func `touched files keep the order they were touched in, newest first`() {
        let touched = ["README.md", "docs/adr/ADR-0024-session-drive-port.md"]
        let rows = menu(for: "@", touched: touched)?.rows ?? []

        #expect(rows.prefix(2).map(\.id) == touched)
    }

    @Test
    func `a touched path the tree does not carry is not listed`() {
        // The agent read something outside the Workspace. It is not a file this picker offers.
        let rows = menu(for: "@", touched: ["/etc/hosts"])?.rows ?? []

        #expect(rows.map(\.id) == Self.tree)
    }

    // MARK: - Scale

    @Test
    func `a very large tree yields no more rows than the ceiling`() {
        let huge = (0 ..< 5000).map { "src/file\($0).swift" }
        let rows = ComposerMenu.files(for: "@file", in: huge, touched: [])?.rows ?? []

        #expect(rows.count == ComposerMenu.fileCeiling)
    }

    @Test
    func `nothing matching keeps the surface and says what did not match`() {
        let menu = menu(for: "@zzzz")

        #expect(menu?.rows.isEmpty == true)
        #expect(menu?.query == "zzzz")
    }

    private func menu(for text: String, touched: [String] = []) -> ComposerMenu.Listing? {
        ComposerMenu.files(for: text, in: Self.tree, touched: touched)
    }
}

@testable import ArgoUI
import Testing

/// What the evidence panel is open ON, per subject.
///
/// The header was designed for a File and a command inherited it — a generic document for a mark,
/// and one line cut from the front for an address. Both are right for a path and wrong for a
/// command,
/// which is identified by its first word and by the arguments in its middle. These are the claims
/// that keep the two apart without either growing a rule of its own.
@Suite("Evidence address")
struct EvidenceAddressTests {
    /// The panel's whole justification is that it says the one thing the row could not. Under
    /// #468's first ticket the row says the narration, so the header has to say the command.
    @Test
    func `a narrated command opens on the command and not on the sentence`() {
        let call = Self.execute(narrating: "Run the UI package's tests", standingIn: "swift test")

        #expect(call.address == .typed("swift test"))
    }

    /// A narration is only ever standing in for a command where the call RAN one. The same shape
    /// carries a pattern for a search and a URL for a fetch, and neither is something to retype.
    @Test
    func `a narrated search opens on its pattern, read as an address`() {
        let call = Self.call(
            kind: .search,
            subject: .narration("Find the command line rule", standingIn: "FeedCommandLine"),
        )

        #expect(call.address == .named("FeedCommandLine"))
    }

    /// The one honest gap: a narrating call that named nothing else. The sentence is all there was,
    /// and setting it as a command would say the agent's words were something to run.
    @Test
    func `a narration standing in for nothing is read as an address`() {
        let call = Self.call(
            kind: .execute,
            subject: .narration("Tidy the worktree", standingIn: nil),
        )

        #expect(call.address == .named("Tidy the worktree"))
    }

    @Test
    func `a file opens on its whole path, read as an address`() {
        let file = FeedCall.FileName(path: "Sources/ArgoUI/Shell/Deck/Feed/FeedRow.swift")
        let call = file.map { Self.call(kind: .read, subject: .file($0)) }

        #expect(call?.address == .named("Sources/ArgoUI/Shell/Deck/Feed/FeedRow.swift"))
    }

    /// The AC that the File's header is UNCHANGED. A path is handed to the layout whole and cut
    /// there, from the front — no rule of this file's touches it, however long it is.
    @Test
    func `a path is drawn whole, however long, and left to be cut from the front`() {
        let path = String(repeating: "Packages/ArgoUI/Sources/", count: 8) + "FeedRow.swift"

        #expect(EvidenceAddress.named(path).drawn == path)
    }

    // MARK: - Three lines, and the middle cut past them

    @Test
    func `a command short enough for three lines is drawn whole, with no ellipsis`() {
        let command = "swift build --package-path Packages/ArgoUI"

        #expect(EvidenceAddress.typed(command).drawn == command)
        #expect(!EvidenceAddress.typed(command).drawn.contains("…"))
    }

    /// Not the row's cut. The row shortens to its first clause; the header shows what RAN, whole,
    /// and only spends an ellipsis where three lines cannot hold it.
    @Test
    func `a command keeps the plumbing and the preamble the row drops`() {
        let command = "ARGO_SPECIMEN=feed sh scripts/screenshot.sh out.png 2>&1 | tail -4"

        #expect(EvidenceAddress.typed(command).drawn == command)
        #expect(FeedCommandLine.head(of: command) == "… sh scripts/screenshot.sh out.png …")
    }

    /// Cut in the MIDDLE and nowhere else: the verb it opens on and the file it ends on are the two
    /// halves that identify it, and either end-cut takes one of them.
    @Test
    func `a command too long for three lines is cut in its middle`() {
        let command = "ARGO_SPECIMEN=feedCommands ARGO_WINDOW_SIZE=960x600 sh scripts/render.sh "
            + "/private/tmp/claude-501/-Users-milad-Developer-argo-worktrees-470/feed.png"
        let drawn = EvidenceAddress.typed(command).drawn

        #expect(drawn.hasPrefix("ARGO_SPECIMEN=feedCommands ARGO"))
        #expect(drawn.hasSuffix("worktrees-470/feed.png"))
        #expect(drawn.filter { $0 == "…" }.count == 1)
    }

    /// It is the SHARED rule, reached with a longer reading rather than reimplemented: three lines
    /// of what one line already measures.
    @Test
    func `the header's cut is the row's rule, over three lines`() {
        let command = String(repeating: "sh scripts/render.sh ", count: 20)

        #expect(EvidenceAddress.typed(command).drawn
            == DeckMiddleCut.applied(to: command, over: EvidenceAddress.commandLines))
        #expect(EvidenceAddress.commandLines == 3)
    }

    /// The cap is not decoration. Unbounded wrapping grew the header with whatever happened to be
    /// open and pushed the close control down the pane, which is what the length is bounded for.
    @Test
    func `however long the command, what is drawn is bounded`() {
        let ceiling = DeckMiddleCut.applied(
            to: String(repeating: "x", count: 200),
            over: EvidenceAddress.commandLines,
        ).count

        for length in [200, 2000, 20000] {
            let command = String(repeating: "sh render.sh ", count: length)
            #expect(EvidenceAddress.typed(command).drawn.count == ceiling)
        }
    }

    /// The ear takes the address whole either way — a cut is a thing about a width, and a listener
    /// has none.
    @Test
    func `the spoken address is never the cut one`() {
        let command = String(repeating: "sh scripts/render.sh ", count: 20)

        #expect(EvidenceAddress.typed(command).text == command)
    }

    // MARK: - Fixtures

    private static func execute(narrating said: String, standingIn target: String) -> FeedCall {
        call(kind: .execute, subject: .narration(said, standingIn: target))
    }

    private static func call(kind: FeedCall.Kind, subject: FeedCall.Subject) -> FeedCall {
        FeedCall(
            kind: kind, subject: subject, churn: nil, ending: .succeeded,
            evidence: [], repeats: 1, spend: nil,
        )
    }
}

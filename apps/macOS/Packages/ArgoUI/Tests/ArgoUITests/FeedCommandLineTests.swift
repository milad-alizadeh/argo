@testable import ArgoUI
import Testing

/// A command with nobody to narrate it, drawn so it is still readable on its own row.
///
/// The claim under all of these is one rule with two halves: what is drawn is a CUT of what the
/// agent typed — same characters, same order, never a rewrite — and an ellipsis marks every place
/// something was left behind, so a whole command and a shortened one can be told apart.
@Suite("Feed command line")
struct FeedCommandLineTests {
    /// The pipeline is real and the panel shows it whole. On the row it is two clauses about where
    /// the text went, in front of the verb that says what happened.
    @Test
    func `a command is shown as what ran, not as where its output went`() {
        #expect(FeedCommandLine.head(of: "bun run test 2>&1 | tail -4") == "bun run test …")
        #expect(FeedCommandLine.head(of: "swift build > out.log") == "swift build …")
    }

    @Test
    func `a command with no plumbing on it is shown exactly as it was typed`() {
        #expect(FeedCommandLine.head(of: "swift build --package-path Packages/ArgoUI")
            == "swift build --package-path Packages/ArgoUI")
    }

    /// A `;`, `&&` or `||` chain is left alone. Those are separate commands that RAN — cutting them
    /// would hide work rather than plumbing, which is the one thing this must not do.
    @Test
    func `a chain of commands keeps every command in it`() {
        let chained = "git add -A && git commit -m 'Fold the ran rows' || git status"

        #expect(FeedCommandLine.head(of: chained) == chained)
    }

    // MARK: - The preamble, which is not the work

    /// An assignment is a scratchpad path where the verb should be, and the row opened on it.
    @Test
    func `a leading assignment is dropped and marked`() {
        #expect(FeedCommandLine.head(of: "ARGO_SPECIMEN=feed sh scripts/screenshot.sh out.png")
            == "… sh scripts/screenshot.sh out.png")
    }

    @Test
    func `several leading assignments are all dropped`() {
        let command = "ARGO_SPECIMEN=feed ARGO_WINDOW_SIZE=960x600 TERM='xterm 256' swift test"

        #expect(FeedCommandLine.head(of: command) == "… swift test")
    }

    /// The one chain link that hides nothing: `cd` moved the shell and ran no work, so the command
    /// after it is the whole command.
    @Test
    func `a leading cd prelude is dropped and the command after it is drawn`() {
        #expect(FeedCommandLine.head(of: "cd apps/macOS && sh scripts/specimens.sh out")
            == "… sh scripts/specimens.sh out")
    }

    /// Only as a prelude. A `cd` the agent ran on its own is a command like any other.
    @Test
    func `a cd that is the whole command stays drawn`() {
        #expect(FeedCommandLine.head(of: "cd apps/macOS") == "cd apps/macOS")
    }

    // MARK: - A long path, cut in its middle

    /// Cut at its end, the row says which machine wrote the path and nothing about the file. Cut in
    /// its middle, the command and the file it named both survive.
    @Test
    func `a long path inside a command is cut in its middle`() {
        let command = "sh /private/tmp/claude-501/-Users-milad-Developer-argo/render.sh"

        #expect(FeedCommandLine.head(of: command) == "sh /private/t…eloper-argo/render.sh")
    }

    /// The cut falls inside the address, not across the word carrying it: `f=` and a flag are what
    /// says which argument this is.
    @Test
    func `what precedes the address survives the cut whole`() {
        let command = "tail -f /private/tmp/claude-501/-Users-milad-Developer-argo/render.sh"

        #expect(FeedCommandLine.head(of: command) == "tail -f /private/t…eloper-argo/render.sh")
    }

    /// One rule, not two: the evidence panel cuts the same kind of thing and reaches the same rule
    /// rather than growing a second answer for one address.
    @Test
    func `the middle-elision rule cuts a bare address the same way`() {
        let address = "/private/tmp/claude-501/-Users-milad-Developer-argo/render.sh"

        #expect(DeckMiddleCut.applied(to: address) == "/private/t…eloper-argo/render.sh")
        #expect(DeckMiddleCut.applied(to: "Sources/ArgoUI/Feed.swift")
            == "Sources/ArgoUI/Feed.swift")
    }
}

import Foundation

/// One Turn spelled as the keystrokes an interactive `claude` would have received from a person.
/// The Session is a real TUI in a PTY Argo owns and never draws (ADR-0024): there is no API on the
/// other end, only a terminal program reading a descriptor.
enum ClaudeTurn {
    /// The text as a bracketed paste, then the Return that submits it — as two writes, never one.
    ///
    /// A newline at that prompt SUBMITS, so a multi-line message written straight through would
    /// arrive as one Turn per line. The brackets are how a terminal says "this is text, not
    /// typing".
    static func keystrokes(for text: String) -> PacedKeystrokes {
        PacedKeystrokes(
            first: "\(pasteStart)\(pasted(text))\(pasteEnd)",
            second: submit,
            gap: gap,
        )
    }

    /// `ESC [ 200 ~` / `ESC [ 201 ~` — the DEC private mode the whole terminal world spells the
    /// same way, which is why they are literals here and not a capability read off `terminfo`.
    private static let pasteStart = "\u{1B}[200~"
    private static let pasteEnd = "\u{1B}[201~"
    /// CR, not LF: Return arrives at a PTY as a carriage return, and a TUI listening for the key
    /// does not hear a line feed.
    private static let submit = "\r"

    /// What separates the paste from the Return.
    ///
    /// The TUI handles one read as one input batch, and an `@` token in the pasted text opens the
    /// file-mention popup inside that batch — the popup then takes the Return as its own accept key
    /// and the Turn sits in the composer, looking sent and never sent (#682). Verified against
    /// `claude` 2.1.228 on 2026-08-12 in a PTY harness: one burst left the Turn unsent 2 times in
    /// 13, while every split trial submitted, from 50 ms out to 2.5 s. This is that floor, which is
    /// also the mode walk's (`ClaudeModeCycle.gap`) — measured separately, because the two are the
    /// same batching read at different keys and either could move without the other.
    private static let gap = Duration.milliseconds(50)

    /// The text made safe to sit between the brackets.
    ///
    /// Both markers are removed rather than escaped, because a bracketed paste has no escape: a
    /// terminator inside the payload ends the paste, and everything after it is read as keystrokes
    /// — an arbitrary command typed at an agent's prompt by a message that merely quoted a
    /// transcript. Removed to a FIXED POINT, because one pass is not removal: deleting a marker
    /// splices its neighbours together, and the right fragments either side of a terminator
    /// assemble into a fresh opener the single pass had already been run for. The markers go
    /// before the line endings are normalised — neither marker contains a CR, so the
    /// normalisation cannot splice one, while the reverse order could leave a spliced raw CR
    /// standing, and a CR in the payload is a Return.
    private static func pasted(_ text: String) -> String {
        var stripped = text
        while stripped.contains(pasteStart) || stripped.contains(pasteEnd) {
            stripped = stripped
                .replacingOccurrences(of: pasteStart, with: "")
                .replacingOccurrences(of: pasteEnd, with: "")
        }
        return stripped
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
    }
}

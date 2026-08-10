import Foundation

/// One Turn spelled as the keystrokes an interactive `claude` would have received from a person.
///
/// The Session is a real TUI in a PTY Argo owns and never draws (ADR-0024), so this is the whole of
/// what "send" means: there is no API on the other end, only a terminal program reading a
/// descriptor. Which is why the encoding is a type with tests rather than a string built at a call
/// site — the difference between one Turn and five is four escape bytes.
enum ClaudeTurn {
    /// The text as a bracketed paste, then the Return that submits it.
    ///
    /// A newline at that prompt SUBMITS, so a multi-line message written straight through would
    /// arrive as one Turn per line — the first answered while the rest queued behind it, which is
    /// both a wrong reading of what was asked and impossible to tell from the agent misbehaving.
    /// The brackets are how a terminal says "this is text, not typing", and are the same thing that
    /// stops ⌘V of a paragraph firing on its first line.
    static func keystrokes(for text: String) -> String {
        "\(pasteStart)\(pasted(text))\(pasteEnd)\(submit)"
    }

    /// `ESC [ 200 ~` / `ESC [ 201 ~` — the DEC private mode the whole terminal world spells the
    /// same way, which is why they are literals here and not a capability read off `terminfo`.
    private static let pasteStart = "\u{1B}[200~"
    private static let pasteEnd = "\u{1B}[201~"
    /// CR, not LF: Return arrives at a PTY as a carriage return, and a TUI listening for the key
    /// does not hear a line feed.
    private static let submit = "\r"

    /// The text made safe to sit between the brackets.
    ///
    /// Both markers are removed rather than escaped, because a bracketed paste has no escape: a
    /// terminator inside the payload ends the paste, and everything after it is read as keystrokes
    /// — an arbitrary command typed at an agent's prompt by a message that merely quoted a
    /// transcript. Line endings are normalised for the same reason CR is the submit: a CR in the
    /// payload is a Return.
    private static func pasted(_ text: String) -> String {
        text
            .replacingOccurrences(of: pasteStart, with: "")
            .replacingOccurrences(of: pasteEnd, with: "")
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
    }
}

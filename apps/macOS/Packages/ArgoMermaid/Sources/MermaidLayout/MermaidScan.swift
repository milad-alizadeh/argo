import Foundation

/// A cursor over one line of a mermaid source, whatever type declared it.
///
/// A cursor and not a split, because such a line is not separable by any one character: `|` is a
/// label's fence AND the pipe inside a quoted label, and `-` opens a link AND sits inside
/// `-. text .->`. Only a left-to-right read knows which it is looking at.
struct MermaidScan {
    private let characters: [Character]
    private var at = 0

    init(_ line: String) {
        self.characters = Array(line)
    }

    var isDone: Bool {
        at >= characters.count
    }

    /// What is left, unread. The reader's own error messages have no reader, so this exists for
    /// the tests and for `matches`.
    var rest: String {
        String(characters[at...])
    }

    mutating func skipSpaces() {
        while at < characters.count, characters[at] == " " || characters[at] == "\t" {
            at += 1
        }
    }

    func peek() -> Character? {
        at < characters.count ? characters[at] : nil
    }

    /// Whether the text at the cursor opens with `token`.
    func matches(_ token: String) -> Bool {
        let token = Array(token)
        guard at + token.count <= characters.count else { return false }
        return Array(characters[at ..< (at + token.count)]) == token
    }

    /// Steps over `token` when it is there, and says whether it was.
    mutating func take(_ token: String) -> Bool {
        guard matches(token) else { return false }
        at += token.count
        return true
    }

    /// Everything from the cursor up to `token`, leaving the cursor ON it. `nil` when the line
    /// never closes — an unterminated label is a line this reader refuses rather than guesses at.
    mutating func takeUpTo(_ token: String) -> String? {
        var end = at
        let token = Array(token)
        while end + token.count <= characters.count {
            if Array(characters[end ..< (end + token.count)]) == token {
                defer { at = end }
                return String(characters[at ..< end])
            }
            end += 1
        }
        return nil
    }

    /// The bare identifier at the cursor, empty where there is none — a flowchart's node name, a
    /// sequence diagram's participant, a mindmap's own optional handle.
    mutating func takeIdentifier() -> String {
        takeRun(where: Self.isIdentifier)
    }

    /// A character mermaid would accept in one. Deliberately narrow, and ONE rule for every reader
    /// here: `-` opens a link and a space ends the token, so a reader that widened this would
    /// swallow syntax — and a reader pointing at another type's copy would change with it.
    static func isIdentifier(_ character: Character) -> Bool {
        character.isLetter || character.isNumber || character == "_"
    }

    /// A run of characters the caller still wants, taken while they last.
    mutating func takeRun(where allowed: (Character) -> Bool) -> String {
        let start = at
        while at < characters.count, allowed(characters[at]) {
            at += 1
        }
        return String(characters[start ..< at])
    }
}

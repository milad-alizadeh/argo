import Foundation

/// What the Session's own screen says about the Turn Argo typed at it (#1266).
///
/// DERIVED, and three-valued on purpose: "Argo cannot see" is not "the CLI did not hear". A wrong
/// `unheard` puts the words back under a notice saying they never ran, and the reader sends them a
/// second time — so where the screen cannot be read the Turn is left standing instead.
enum TurnEcho: Equatable, Sendable {
    /// The composer let the Turn go. Whatever the CLI then did with it — answer it, or run it as
    /// one of its own commands and write nothing — it took the Return.
    case heard
    /// The composer is still holding the Turn, so the Return never submitted it (#682).
    case unheard
    /// No composer was on the screen Argo can see, or there is no screen at all.
    case unreadable
}

/// Whether the composer at the bottom of a `claude` screen is still holding the Turn Argo typed.
///
/// The record cannot answer that. A local command — `/clear` and the 56 others the #1234 survey
/// found — is heard the instant it is typed and writes NOTHING, so a watch that reads the
/// transcript alone sees a Session that took the Turn and one that dropped it as the same silence
/// (#1266). The screen tells them apart, because the one thing every Turn the CLI takes does is
/// leave the composer.
///
/// The composer is the LAST prompt row on the screen. The CLI echoes a Turn it accepted back into
/// the scrollback under the same marker, so "a row with the prompt on it" would find that echo —
/// but the composer is always below it, because it is the bottom of the TUI.
///
/// Verified against `claude` 2.1.260 in a PTY at 120×40 on 2026-09-04: idle draws `❯` alone, a
/// bracketed paste of `/clear` draws `❯ /clear`, and the Return moves that text to a scrollback row
/// and leaves `❯` alone again.
enum ComposerEcho {
    /// U+276F, the marker `claude` draws its prompt with. A literal, like the paste brackets in
    /// `ClaudeTurn`: there is nothing to read it off, and a version that draws something else reads
    /// `unreadable` — which is the quiet answer rather than a wrong one.
    static let prompt: Character = "❯"

    /// What that screen says about `text`, having just been typed at it.
    static func reading(of text: String, on rows: [String]) -> TurnEcho {
        guard let held = composed(on: rows) else { return .unreadable }
        guard !held.isEmpty else { return .heard }
        // A prefix and not equality: the composer is one terminal row wide, so a Turn longer than
        // it is held with its tail on the rows below. Read the other way round — a composer
        // holding something that is NOT the start of this Turn — the Turn has left it, whether the
        // reader has since typed the next one or the CLI put something else there.
        return firstLine(of: text).hasPrefix(held) ? .unheard : .heard
    }

    /// What the composer is holding, and `nil` where no composer was drawn at all.
    private static func composed(on rows: [String]) -> String? {
        guard let row = rows.last(where: { trimmed($0).first == prompt }) else { return nil }
        return trimmed(String(trimmed(row).dropFirst()))
    }

    /// The Turn's first line, which is the whole of what a composer row can be compared against:
    /// `ClaudeTurn` pastes the rest below it, and the rows those wrap onto are the CLI's to lay out
    /// rather than anything Argo can predict.
    private static func firstLine(of text: String) -> String {
        trimmed(String(text.split(whereSeparator: \.isNewline).first ?? ""))
    }

    private static func trimmed(_ row: String) -> String {
        row.trimmingCharacters(in: .whitespaces)
    }
}

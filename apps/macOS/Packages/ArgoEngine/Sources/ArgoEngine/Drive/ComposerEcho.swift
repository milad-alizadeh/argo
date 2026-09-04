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
/// The composer is found BETWEEN ITS RULES and not by looking for the lowest prompt marker on the
/// screen. The CLI echoes a Turn it accepted back into the scrollback under the same marker, and a
/// screen whose composer has been replaced — by a permission prompt, by a question — would then
/// offer that echo as the composer and read a Turn that was taken as one still sitting unsent.
///
/// Measured against `claude` 2.1.260 in a 120×40 PTY on 2026-09-04, painted by the emulator this
/// app ships (`ComposerEchoScreenTests` holds the bytes):
///
///     34 │ ────────────────────────────────────────  the opening rule
///     35 │ ❯ /clear                                  the composer
///     36 │ ────────────────────────────────────────  the closing rule
///     37 │ ⚠ …                                       the CLI's own status rows
///
/// Idle draws `❯` alone, with no placeholder to mistake for a Turn. A paste too big to show is
/// collapsed to a marker rather than echoed, which is why `pasted` is read as holding rather than
/// as some other text: the Turns that collapse are the long ones, and a long Turn carrying an `@`
/// is exactly the shape whose Return #682 gets eaten.
enum ComposerEcho {
    /// U+276F, the marker `claude` draws its prompt with. A literal, like the paste brackets in
    /// `ClaudeTurn`: there is nothing to read it off, and a version that draws something else reads
    /// `unreadable` — which is the quiet answer rather than a wrong one.
    static let prompt: Character = "❯"
    /// What the CLI shows INSTEAD of a paste it judged too long to echo — `[Pasted text #1 +15
    /// lines]`. Only the stable head of it is matched: the number and the count are the paste's.
    static let pasted = "[Pasted text"
    /// U+2500, what both of the composer's rules are drawn out of.
    static let rule: Character = "─"
    /// How wide a run of rule has to be before it counts as one of the composer's own, rather than
    /// a divider inside a popup drawn above it.
    static let ruleWidth = 20

    /// What that screen says about `text`, having just been typed at it.
    static func reading(of text: String, on rows: [String]) -> TurnEcho {
        guard let held = composed(on: rows) else { return .unreadable }
        // Empty is the whole of the ticket: a local command writes no record, and this is the only
        // thing that says the CLI took it.
        guard !held.isEmpty else { return .heard }
        // A collapsed paste is the composer saying it holds a Turn without saying which. Read as
        // holding, because the alternative is calling the #682 shape heard.
        guard !held.hasPrefix(pasted) else { return .unheard }
        // A prefix and not equality: the composer is one terminal row wide, so a Turn longer than
        // it is held with its tail on the rows below. Read the other way round — a composer
        // holding something that is NOT the start of this Turn — the Turn has left it, whether the
        // reader has since typed the next one or the CLI put something else there.
        return firstLine(of: text).hasPrefix(held) ? .unheard : .heard
    }

    /// What the composer is holding, and `nil` where no composer was drawn at all.
    ///
    /// The rows between the last two rules, of which the composer's own first row is the one
    /// carrying the prompt. A Turn tall enough to wrap holds the rows under that one, which this
    /// does not read: what a continuation row carries is the CLI's line-breaking rather than
    /// anything Argo can predict.
    private static func composed(on rows: [String]) -> String? {
        guard let closing = rows.lastIndex(where: isRule),
              let opening = rows[..<closing].lastIndex(where: isRule),
              let row = rows[rows.index(after: opening) ..< closing]
              .first(where: { trimmed($0).first == prompt })
        else {
            return nil
        }
        return trimmed(String(trimmed(row).dropFirst()))
    }

    /// One of the composer's rules: a row that is nothing but rule, and wide enough to be the
    /// CLI's own rather than a popup's divider.
    private static func isRule(_ row: String) -> Bool {
        let painted = trimmed(row)
        return painted.count >= ruleWidth && painted.allSatisfy { $0 == rule }
    }

    /// The Turn's first line, which is the whole of what a composer row can be compared against:
    /// `ClaudeTurn` pastes the rest below it, and the rows those wrap onto are the CLI's to lay out
    /// rather than anything Argo can predict.
    private static func firstLine(of text: String) -> String {
        trimmed(String(text.split(whereSeparator: \.isNewline).first ?? ""))
    }

    /// Trimmed of every kind of space the CLI puts round what it draws — the marker is followed by
    /// a NO-BREAK SPACE where a paste was collapsed, and by an ordinary one everywhere else.
    private static func trimmed(_ row: String) -> String {
        row.trimmingCharacters(in: .whitespaces)
    }
}

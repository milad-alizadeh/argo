import Foundation

/// Stopping a running Turn on `claude`: the byte that stops it, and the entry the CLI writes about
/// it afterwards.
///
/// Both halves in one place because they are one act seen from two sides — Argo puts the keystroke
/// on a descriptor, and the CLI's own record is where anybody finds out it happened. A reader that
/// kept the sentence somewhere else would be free to drift from the keystroke that produces it, and
/// the drift would look exactly like an interrupt that never landed.
public enum ClaudeInterrupt {
    /// `ESC`, and nothing after it. Not a signal and not a kill: the TUI reads the key, ends the
    /// turn where it stands and keeps the process — which is the whole reason the Session is still
    /// there to take the next thing typed (ADR-0024's live check).
    static let keystroke = "\u{1B}"

    /// What the transcript records for it, verbatim. It arrives on the USER side of the record,
    /// which is why the reader has to know the sentence: read as a prompt it would draw Argo's
    /// own act as something the reader typed, and would OPEN a Turn on the act that ended one.
    public static let mark = "[Request interrupted by user]"

    /// The same act stopped inside a tool call, which the CLI files under its own sentence. The
    /// commoner half of a real record, and the one #1189 was reported from — a reader that knows
    /// only the line above leaves those Sessions running for good.
    public static let toolUseMark = "[Request interrupted by user for tool use]"

    /// Every sentence the CLI writes for the act. Both, and not a prefix test: a prefix would take
    /// a reader's own paragraph that merely STARTS with the marker.
    public static let marks: Set<String> = [mark, toolUseMark]

    /// Whether one user entry IS one of those sentences rather than a message containing one.
    /// Compared whole, so a reader quoting a marker in a message of their own gets their message
    /// back rather than a Turn boundary drawn across the middle of it.
    public static func isMark(_ text: String) -> Bool {
        marks.contains(text.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

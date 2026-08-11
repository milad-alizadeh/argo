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
    /// which is why the feed has to know the sentence: read as a prompt it would draw Argo's
    /// own act as something the reader typed.
    public static let mark = "[Request interrupted by user]"

    /// Whether one user entry IS that sentence rather than a message containing it. Compared whole,
    /// so a reader quoting the marker in a message of their own gets their message back rather than
    /// a Turn boundary drawn across the middle of it.
    public static func isMark(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines) == mark
    }
}

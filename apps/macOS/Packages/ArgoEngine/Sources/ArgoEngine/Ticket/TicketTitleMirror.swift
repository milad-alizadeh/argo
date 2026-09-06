/// Where a Ticket's words go once they are settled, besides the annotation file (#1494).
///
/// A value the resolver is built with: what is on the other end is a Session's own prompt, and the
/// resolver asks a code host what a number is called. Who types it at which CLI is the window's.
public struct TicketTitleMirror: Sendable {
    /// `true` where the title reached a live prompt. `false` is the ordinary case and never an
    /// error — a `codex` Session, a Session Argo owns no terminal for, a Turn in flight, a
    /// Permission or a question holding the keyboard. The resolver retries on its next sweep.
    let carry: @Sendable (String, String) async -> Bool

    /// `title`, then the Session it belongs to — the argument order every act in the drive port
    /// takes.
    public init(_ carry: @escaping @Sendable (String, String) async -> Bool) {
        self.carry = carry
    }

    /// A resolve that files a title and types nowhere: the resolver's default, and every suite's
    /// that is not asserting the mirror.
    ///
    /// Not spelled `none`, which a call site reads as `Optional.none`.
    public static let silent = TicketTitleMirror { _, _ in false }
}

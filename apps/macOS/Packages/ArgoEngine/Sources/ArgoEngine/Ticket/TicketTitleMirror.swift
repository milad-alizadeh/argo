/// Where a Ticket's words go once they are settled, besides the annotation file (#1494).
///
/// A value the resolver is BUILT with rather than a call it makes, because what is on the other end
/// is a Session's own prompt and the resolver has no business reaching one: it asks a code host
/// what a number is called and files the answer. Who types it at which CLI is the window's.
///
/// One-way, and it answers nothing. A mirror that could not go — a Turn in flight, a `codex`
/// Session, a Session Argo owns no terminal for — leaves the annotation exactly where it is, which
/// is the whole of what the roster reads either way.
public struct TicketTitleMirror: Sendable {
    let carry: @Sendable (String, String) async -> Void

    /// `title`, then the Session it belongs to — the argument order every act in the drive port
    /// takes, so the two cannot be swapped by a caller reading from that side.
    public init(_ carry: @escaping @Sendable (String, String) async -> Void) {
        self.carry = carry
    }

    /// The resolver's default, and every suite's that is not asserting the mirror: a resolve that
    /// files a title and types nowhere.
    public static let none = TicketTitleMirror { _, _ in }
}

/// Where a settled name goes once it is settled, besides the annotation file (#1494, #1623).
///
/// A value its callers are built with: what is on the other end is a Session's own prompt, and the
/// two callers know only what a name IS — a code host's words for a Ticket number
/// (`TicketTitleResolver`), or the name the cockpit draws on a row (`SessionNameMirror`). Who types
/// it at which CLI is the window's.
public struct NameMirror: Sendable {
    /// `true` where the name reached a live prompt. `false` is the ordinary case and never an
    /// error — a `codex` Session, a Session Argo owns no terminal for, a Turn in flight, a
    /// Permission or a question holding the keyboard. Every caller retries on its next sweep.
    let carry: @Sendable (String, String) async -> Bool

    /// `title`, then the Session it belongs to — the argument order every act in the drive port
    /// takes.
    public init(_ carry: @escaping @Sendable (String, String) async -> Bool) {
        self.carry = carry
    }

    /// A pass that files a name and types nowhere: every caller's default, and every suite's that
    /// is not asserting the mirror.
    ///
    /// Not spelled `none`, which a call site reads as `Optional.none`.
    public static let silent = NameMirror { _, _ in false }
}

@MainActor
public extension NameMirror {
    /// The mirror that types at whichever Session this Hub holds (#1494).
    ///
    /// Built here and not at the window: the Hub's driver is the whole of what a settled name
    /// needs, so a window assembling this by hand would be holding engine wiring in the app target
    /// where no suite can reach it (ADR-0022).
    static func typing(through hub: Hub) -> NameMirror {
        NameMirror { title, sessionID in
            await hub.mirrorTitle(title, to: sessionID)
        }
    }
}

/// What Argo learned when it asked a code host what a Ticket number is called (#745).
///
/// Two cases and not an optional string, because `CONTEXT.md`'s degrade-down rule needs two kinds
/// of "no title" told apart. A host that answered and has nothing behind the number leaves no link
/// to draw at all; a host that did not answer establishes nothing, and the absence of a reading is
/// what that is. So `nil` — never asked, or asked and unreachable — is the third state, and it
/// keeps whatever Argo already held.
public enum TicketTitleReading: Equatable, Sendable {
    case named(String)
    /// Asked, and there is no Ticket behind that number. The number came off a branch name by
    /// convention, so this is a branch naming a ticket that does not exist.
    case absent

    /// The words, and `nil` for the case that has none.
    public var title: String? {
        switch self {
        case let .named(title): title
        case .absent: nil
        }
    }
}

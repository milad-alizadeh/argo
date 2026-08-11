/// Something that did not work, in three parts: what happened, why, and what to do about it.
///
/// The shape is the house error pattern, and it is a TYPE rather than a paragraph so a surface
/// cannot ship two of the three. Half an error is the failure mode this exists to make impossible:
/// "Could not bind" says nothing a user can act on, and a fix with no cause reads as a guess.
///
/// The panel stays usable underneath one. A note is a thing that happened to one row, never a
/// screen the user has to get out of before they can try the next thing.
public struct ConnectNote: Equatable, Sendable {
    public let what: String
    public let why: String
    public let fix: String

    public init(what: String, why: String, fix: String) {
        self.what = what
        self.why = why
        self.fix = fix
    }

    /// The three parts as one line, for the accessibility label and nothing else. On screen they
    /// are three lines, because a reader scanning for the fix should not have to read the cause
    /// again to find it.
    public var spoken: String {
        [what, why, fix].joined(separator: " ")
    }
}

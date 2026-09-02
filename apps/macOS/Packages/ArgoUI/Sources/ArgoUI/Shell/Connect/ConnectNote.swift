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
    /// Everything the provider printed behind `why`, and `nil` where Argo wrote that middle line
    /// itself — a sentence with no provider output behind it is the whole of what there is (§5 of
    /// `cockpit-failure-states-spec.md`).
    private(set) var output: RawOutput?

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

extension ConnectNote {
    /// A note whose middle line is not Argo's: `words` are the provider's or the transport's own,
    /// so the line is their FIRST line and the whole of them is one gesture behind it (§5). Argo's
    /// wording around them is unchanged — what happened and what to do are still Argo's to say.
    ///
    /// In this file rather than beside the refusals it serves, because `output` is settable only
    /// here.
    init(what: String, verbatim words: String, fix: String) {
        let output = RawOutput(words)
        self.init(what: what, why: output?.summary ?? words, fix: fix)
        self.output = output
    }
}

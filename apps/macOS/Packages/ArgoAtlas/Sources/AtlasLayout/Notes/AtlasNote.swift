/// One written sentence about a file or a folder: what it is for, which is the one thing no
/// Measure can say (#1159).
///
/// **Read, never counted.** Nothing bands by a Note, nothing tiles by one, and no Measure is
/// derived from one. That is why it is a value apart from `AtlasFileReading` rather than a field
/// on it: the measured reading is what the map is drawn from, and a repository with no written
/// layer has to draw exactly the same map.
public struct AtlasNote: Equatable, Sendable {
    /// The sentence itself, exactly as it was written.
    public let words: String

    /// The FLAG, in the domain's own word for it: the question the measurements asked that got
    /// this written — "One of the largest files here." Kept beside the answer, because a sentence
    /// about somebody's code with no question in front of it reads as an unprompted opinion. One
    /// entry per question, each a sentence of its own. Empty for a subject nothing flagged, which
    /// is every folder caption.
    public let flag: [String]

    /// What the subject held when the Note was written, digested. Absent where the writer recorded
    /// none, which is not the same as a subject that has not changed — see `AtlasNoteStanding`.
    public let subject: String?

    /// Whether the subject still holds what it held when this was written. Resolved by
    /// `checked(against:)` and `unchecked` until then: nothing in this package opens a file, so
    /// the digest to compare against arrives from outside (ADR-0028 rule 6).
    public let standing: AtlasNoteStanding

    public init(
        words: String,
        flag: [String] = [],
        subject: String? = nil,
        standing: AtlasNoteStanding = .unchecked,
    ) {
        self.words = words
        self.flag = flag
        self.subject = subject
        self.standing = standing
    }

    /// The same Note, read against what its subject holds now.
    ///
    /// A Note whose subject cannot be digested — a file that has gone, a caption over a folder
    /// that has no content to hash — stays `unchecked`, which is not a claim either way. Saying
    /// "current" of a subject nobody compared would be the one thing worse than saying nothing:
    /// it is the reading a stale note gets when the check quietly fails.
    public func checked(against digest: String?) -> AtlasNote {
        guard let subject, let digest else { return self }
        return AtlasNote(
            words: words,
            flag: flag,
            subject: subject,
            standing: subject == digest ? .current : .stale,
        )
    }
}

/// How a Note stands against the thing it was written about (#1159).
///
/// Three readings rather than a boolean, because "nobody checked" is a different fact from "it
/// still holds", and only one of the three is drawn: a stale Note is marked, and the other two are
/// left to be read as the sentence they are.
public enum AtlasNoteStanding: Equatable, Sendable {
    /// Nothing compared this Note to its subject — no digest was recorded, or the subject could
    /// not be read. Marked as neither, because it is a claim about the check and not about the
    /// note.
    case unchecked

    /// The subject holds what it held when the Note was written.
    case current

    /// The subject has changed since. The Note **stays and is marked**: it was true of a version
    /// of the file the reader may still be reading, and a sentence that vanished would take that
    /// with it (#1159's last criterion).
    case stale
}

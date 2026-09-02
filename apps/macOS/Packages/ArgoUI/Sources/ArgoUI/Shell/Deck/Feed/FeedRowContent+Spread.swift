import Foundation

// How a row's content is SPREAD across a hash — see `FeedGeometry.Ground`, the one caller.

extension FeedRow.Content {
    /// What a ground's hash spreads on — a BUCKET and never an answer, so a coarse spread costs a
    /// comparison and can never cost a wrong height.
    ///
    /// Cheap on purpose, because a ground is hashed for every row of every whole-document walk.
    /// Hashing the content whole would walk every byte of a message and every byte of the evidence
    /// behind a call, where `==` between two rows out of one projection stops at the first byte
    /// that differs — and stops at once where the two share their storage.
    ///
    /// The three crowded kinds get their words' length and both ends, which tells a run of
    /// near-identical lines apart in constant time. A call gets what its sentence NAMES. Every
    /// other kind is a handful of rows in a reading, so its shape and a count spread it enough.
    func spread(into hasher: inout Hasher) {
        hasher.combine(shape)
        switch self {
        case let .prompt(text, shots):
            hasher.combine(shots.count)
            Self.spread(text, into: &hasher)
        case let .message(text), let .thought(text):
            Self.spread(text, into: &hasher)
        case let .call(call):
            hasher.combine(call.repeats)
            Self.spread(call.subject.captioned, into: &hasher)
        case let .survey(survey): hasher.combine(survey.calls.count)
        case let .gallery(gallery): hasher.combine(gallery.shots.count)
        case let .ask(ask): hasher.combine(ask.isAnswered)
        case let .skillLoaded(skill): Self.spread(skill.address, into: &hasher)
        case let .mark(mark): hasher.combine(mark.ink)
        case let .unreadable(unreadable): hasher.combine(unreadable.count)
        }
    }

    /// The length and both ends of a string, which is as much of it as a bucket needs. Constant
    /// time: a `String`'s UTF-8 count is O(1), and so is a bounded walk in from either end.
    private static func spread(_ text: String, into hasher: inout Hasher) {
        let bytes = text.utf8
        hasher.combine(bytes.count)
        for byte in bytes.prefix(Self.spreadBytes) {
            hasher.combine(byte)
        }
        for byte in bytes.suffix(Self.spreadBytes) {
            hasher.combine(byte)
        }
    }

    /// How much of either end a string is spread by. Eight, because the rows a real reading crowds
    /// a bucket with are lines of one length differing near an end — a numbered line, a repeated
    /// sentence — and eight bytes is past the digits.
    private static let spreadBytes = 8
}

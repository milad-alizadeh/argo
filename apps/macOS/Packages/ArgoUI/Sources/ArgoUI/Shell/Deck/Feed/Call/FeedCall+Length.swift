extension FeedCall {
    /// How long this row's line runs, in characters, without building it. `spoken` joins five
    /// pieces, and joining them once per call row per reshape is a string nobody draws. UTF-8
    /// counts, which a `String` answers in constant time where `count` walks graphemes.
    var length: Int {
        kind.verb.utf8.count + 1 + subject.length
    }
}

extension FeedCall.Subject {
    /// How many characters the subject spells.
    var length: Int {
        switch self {
        case let .file(file): file.name.utf8.count + (file.qualifier?.utf8.count ?? 0)
        case let .command(command): command.utf8.count
        case let .plain(text): text.utf8.count
        case let .narration(text, _): text.utf8.count
        }
    }
}

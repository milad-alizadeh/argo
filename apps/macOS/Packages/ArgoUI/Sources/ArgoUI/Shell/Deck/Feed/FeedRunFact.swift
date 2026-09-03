import ArgoEngine

/// Which of the CLI's two knobs moved mid-Session, and what it moved to (#558).
///
/// The record's honesty depends on this being drawn: a Turn that ran on Sonnet, read under a
/// composer that now says Opus, is a Turn the reader will attribute to the wrong model. The
/// composer states what the Session runs at NOW; this states where that changed, in the record's
/// own order, so every Turn above a row belongs to what the row replaced.
///
/// Only a change draws one — `TranscriptContextCursor` emits both facts on change alone, and the
/// projection additionally drops each fact's FIRST reading, which is the Session's opening value
/// and not news (`FeedProjection.runFacts`).
package enum FeedRunFact: Equatable, Sendable {
    /// The model id as the records report it, unread.
    case model(String)
    /// The effort level in the CLI's own word, unread.
    case effort(String)

    /// The caption on the rule — `model · Sonnet 5`. The value is said the way the composer says
    /// it, which is what lets a reader match the row against the fact line without translating: a
    /// model id the readable table knows becomes its name, and one it does not is VERBATIM.
    var words: String {
        switch self {
        case let .model(id): "model · \(ReadableModelName.readable(id))"
        case let .effort(cli): "effort · \(ClaudeEffort.reading(of: cli).words)"
        }
    }

    /// What a screen reader is told. A sentence, because the caption is two nouns and read out
    /// they are a pair of words with no verb between them.
    var spoken: String {
        switch self {
        case let .model(id): "The model changed to \(ReadableModelName.readable(id))"
        case let .effort(cli): "The effort changed to \(ClaudeEffort.reading(of: cli).words)"
        }
    }
}

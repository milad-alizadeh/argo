/// How full a Session's context is, as one reading with its own absence in it (#1249).
///
/// Three states and not an `Int?`, because an optional folds two opposite claims into one word:
/// a Session Argo has not heard from yet has NOTHING to say about its window, and a Session whose
/// spend Argo read and could not use has said something Argo cannot render. The first draws
/// nothing; only the second is `unknown` (`CONTEXT.md` Honesty tier · degrade-down).
public enum ContextReading: Sendable, Equatable {
    /// No record has reported a spend yet. An ABSENCE — a surface draws no reading and no meter.
    case unread
    /// A spend Argo read and cannot put against a window. Drawn as `unknown`.
    case unreadable
    /// The tokens the latest reported spend was made against.
    case held(Int)

    /// The reading as a number, and `nil` for both of the states that have none. For a caller that
    /// only needs the figure; the two absences are told apart by matching the cases.
    public var tokens: Int? {
        guard case let .held(tokens) = self else { return nil }
        return tokens
    }

    /// What one reported spend leaves the reading at.
    ///
    /// A spend totalling zero is the host writing a record of its OWN — the CLI's `<synthetic>`
    /// message, priced at nothing because no request was made — and no real request is made
    /// against an empty window. So it never replaces a reading Argo already has: it degrades an
    /// unread context down to `unreadable` and leaves a held one standing, because a note the CLI
    /// wrote to itself did not empty the conversation it was written into.
    func updated(by usage: Usage) -> ContextReading {
        guard usage.contextTokens > 0 else {
            if case .held = self {
                return self
            }
            return .unreadable
        }
        return .held(usage.contextTokens)
    }

    /// The later link of a resume-chain joined onto the reading its root left.
    ///
    /// A held reading in the continuation wins, being the newest thing said about the window.
    /// Failing that the root's own reading stands: a resume file with no spend in it yet is not a
    /// Session that has emptied its context, and one carrying only a spend Argo cannot use has not
    /// unsaid what the root already read.
    func merged(with continuation: ContextReading) -> ContextReading {
        if case .held = continuation {
            return continuation
        }
        if case .unread = self {
            return continuation
        }
        return self
    }
}

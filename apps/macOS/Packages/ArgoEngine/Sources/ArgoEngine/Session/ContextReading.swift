/// How full a Session's context is, as one reading with its own absence in it (#1249).
///
/// A Session Argo has not heard from yet says NOTHING about its window; a Session whose spend Argo
/// read and cannot use has said something Argo cannot render. The first draws nothing, and only the
/// second is `unknown` (`CONTEXT.md` Honesty tier · degrade-down).
public enum ContextReading: Sendable, Equatable {
    /// No record has reported a spend yet. An ABSENCE — a surface draws no reading and no meter.
    case unread
    /// A spend Argo read and cannot put against a window. Drawn as `unknown`.
    case unreadable
    /// The tokens the latest reported spend was made against.
    case held(Int)

    /// What one reported spend leaves the reading at.
    ///
    /// A spend Argo READ and cannot use degrades an unread context to `unknown` and leaves a held
    /// one standing: a window Argo once read is still the last thing the Session truthfully said
    /// about itself, and a later unreadable spend does not unsay it.
    ///
    /// A spend totalling ZERO says nothing at all and moves nothing. It is the host writing a
    /// record of its own — the CLI's `<synthetic>` message, priced at nothing because no request
    /// was made — and no real request is made against an empty window. The feed drops that same
    /// record's model for the same reason, so the two halves of one record are read alike; a
    /// reading that moved on it would put `unknown` back on a Session that has only just started,
    /// which is the placeholder this type exists to stop drawing.
    func updated(by reading: UsageReading) -> ContextReading {
        switch reading {
        case .unreadable:
            switch self {
            case .held: self
            case .unread, .unreadable: .unreadable
            }
        case let .read(usage):
            usage.contextTokens > 0 ? .held(usage.contextTokens) : self
        }
    }

    /// The later link of a resume-chain joined onto the reading its root left.
    ///
    /// A held reading in the continuation wins, being the newest thing said about the window.
    /// Failing that the root's own reading stands: a resume file with no spend in it yet is not a
    /// Session that has emptied its context, and one carrying only a spend Argo cannot use has not
    /// unsaid what the root already read.
    func merged(with continuation: ContextReading) -> ContextReading {
        switch (self, continuation) {
        case (_, .held): continuation
        case (.unread, _): continuation
        case (.unreadable, _), (.held, _): self
        }
    }
}

import ArgoEngine

/// Where one provider-port write has got to. Not a queue: §4 rules out auto-retry, so there is
/// never a second attempt waiting.
enum WriteAttempt: Equatable, Sendable {
    case idle
    case pending
    /// The error rather than a sentence, so the provider's own words reach the control unedited.
    case failed(TicketWriteError)
}

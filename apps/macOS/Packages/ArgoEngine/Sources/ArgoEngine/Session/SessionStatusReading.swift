/// A Session's status and how we know it (CONTEXT.md, "Honesty tier").
///
/// The tier rides with the status rather than beside it, because the two are one answer: what the
/// status is worth depends entirely on what established it.
public struct SessionStatusReading: Sendable, Equatable {
    public let tier: Tier
    public let status: SessionStatus
}

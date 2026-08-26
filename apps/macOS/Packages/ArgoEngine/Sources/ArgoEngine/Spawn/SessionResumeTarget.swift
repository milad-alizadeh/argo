/// The chain a resume continues, under BOTH keys it is known by (#731).
///
/// A Session has two ids and they are not interchangeable: the roster and the ownership ledger key
/// it by transcript path, while `--resume` takes the chain's own uuid. Held together so neither
/// caller can name one without the other.
public struct SessionResumeTarget: Sendable, Equatable {
    /// What `--resume` is given: the CLI's own id for the chain's latest link.
    public let chainID: String
    /// What the roster carries this Session as, and what ownership is keyed by.
    public let sessionID: String

    public init(chainID: String, sessionID: String) {
        self.chainID = chainID
        self.sessionID = sessionID
    }
}

/// What a Session is doing, as far as colour is concerned.
///
/// The four roles the contract owes the rest of the app. They are independent of the brand
/// by construction: a view asks for a state's tint and gets a status colour, and there is no
/// path from here to Ion Blue. The words each state is announced with are the roster's
/// business (#377), not the palette's.
public enum ArgoOperationalState: Sendable, CaseIterable, Equatable {
    /// A turn is in progress.
    case running
    /// Idle, or complete. The quiet end of the vocabulary.
    case idle
    /// Needs you: a permission prompt, a question, a degraded connection.
    case attention
    /// Failed, refused, errored.
    case failure

    public func tint(in palette: ArgoPalette) -> ArgoColor {
        switch self {
        case .running: palette.state.running
        case .idle: palette.state.idle
        case .attention: palette.state.attention
        case .failure: palette.state.failure
        }
    }

    /// The same tint as a ground rather than an ink, for a chip.
    public func ground(in palette: ArgoPalette) -> ArgoColor {
        palette.state.muted(tint(in: palette))
    }
}

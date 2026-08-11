import ArgoEngine

/// What the connection chip draws: one line, one operational state, and at most one thing to press.
///
/// A reading rather than a switch inside the view, because two different subjects draw this one
/// chip — Argo's own observation of the transcripts, and the health of the active Project's
/// provider Bindings. One chip is the whole point: a second failure chrome beside it would be a
/// second failure language, and the words below are the registry's, not new ones.
///
/// `nil` is how both subjects say "nothing to draw". Healthy renders nothing at all — no green
/// light, because a permanently-lit indicator trains the eye to skip the spot the warning appears
/// in.
struct ConnectionChipReading: Equatable {
    let label: String
    let state: ArgoOperationalState
    /// The one thing to press, where there is one. Absent for everything you can only wait out.
    let action: String?
}

extension ConnectionChipReading {
    /// Argo observing itself: whether it is reading any transcript at all. Not a provider fact and
    /// never routed through connection health — an observation failure is not a work failure.
    init?(observing connection: HubConnection) {
        switch connection {
        case .connected:
            return nil
        case .connecting:
            self.init(label: "Connecting", state: .attention, action: nil)
        // Drawn rather than left blank because it is a different fact from being connected, and the
        // blank would be read as the connected one.
        case .idle:
            self.init(label: "No live sessions", state: .idle, action: nil)
        case let .failed(message):
            self.init(label: message, state: .failure, action: "Retry")
        }
    }
}

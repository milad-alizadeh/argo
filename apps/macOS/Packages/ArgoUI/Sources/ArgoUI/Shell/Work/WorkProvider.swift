import ArgoEngine

/// The bound provider, as the sidebar's foot names it (`cockpit-work-room.md` — the connection
/// chip lives at the sidebar's foot, because it is a property of the provider whose views these
/// are).
struct WorkProvider: Sendable, Equatable {
    /// The provider's own name, verbatim — `GitHub`, `Linear`.
    let name: String
    /// The account the Binding authenticated as.
    let account: String
    /// How the Binding is reading. `nil` is the honest unknown the tier rules owe, drawn as the
    /// same outlined dot a roster row uses for it.
    let state: ArgoOperationalState?
}

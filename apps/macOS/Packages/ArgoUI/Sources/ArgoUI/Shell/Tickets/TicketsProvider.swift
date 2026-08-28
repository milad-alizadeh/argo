import ArgoEngine

/// The bound provider, as the sidebar's foot names it (`cockpit-work-room.md` — the connection
/// chip lives at the sidebar's foot, because it is a property of the provider whose views these
/// are).
struct TicketsProvider: Sendable, Equatable {
    /// The provider's own name, verbatim — `GitHub`, `Linear`.
    let name: String
    /// The account the Binding authenticated as.
    let account: String
    /// How the Binding is reading. `nil` is the honest unknown the tier rules owe, drawn as the
    /// same outlined dot a roster row uses for it.
    let state: ArgoOperationalState?
    /// Whether a read through this Binding has ever LANDED. It is what separates "the provider
    /// answered, and the answer was nothing" from "nobody has answered yet" — an empty listing
    /// looks identical either way, and only one of the two may be said out loud.
    let hasAnswered: Bool

    /// The Ticket port's own connection, and `nil` where nothing is bound to it — which is what
    /// makes the whole room vacant rather than an empty foot under a full one.
    ///
    /// The Ticket port ALONE. A window whose code host is failing still has a Ticket provider
    /// that is reading fine, and a foot that folded the two would name the wrong thing to repair.
    init?(reading: ConnectionHealthReading) {
        guard let connection = reading.connections.first(where: { $0.port == .ticket })
        else { return nil }
        self.init(
            name: connection.account.provider.readableName,
            account: connection.account.displayName,
            state: Self.state(of: connection.health),
            hasAnswered: connection.health.lastSuccess != nil,
        )
    }

    init(name: String, account: String, state: ArgoOperationalState?, hasAnswered: Bool) {
        self.name = name
        self.account = account
        self.state = state
        self.hasAnswered = hasAnswered
    }

    /// How a Binding's health reads as a dot. A Binding nothing has ever read through is `nil` and
    /// not idle: a green dot over a read that has never landed is the false DIRECT the tier rules
    /// exist to refuse (`CONTEXT.md` L2 · degrade-down).
    private static func state(of health: BindingHealth) -> ArgoOperationalState? {
        switch health.fault {
        case .none: health.lastSuccess == nil ? nil : .idle
        case .grantRefused: .failure
        case .read: .attention
        }
    }
}

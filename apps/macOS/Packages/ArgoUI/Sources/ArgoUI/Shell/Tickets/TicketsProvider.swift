import ArgoDesign
import ArgoEngine

/// The bound provider, as the sidebar's foot names it (`cockpit-work-room.md` — the connection
/// chip lives at the sidebar's foot, because it is a property of the provider whose views these
/// are).
package struct TicketsProvider: Sendable, Equatable {
    /// The provider's own name, verbatim — `GitHub`, `Linear`.
    let name: String
    /// The account the Binding authenticated as.
    let account: String
    /// How the Binding's connection is doing — both facts off the one health read, so they can
    /// never be constructed to disagree (rules/house.md, 4-parameter init cap).
    let connection: Connection
    /// Whether this adapter declares the `.closure` write (#1333) — read here rather than asked of
    /// a Binding at the seam, because the surface takes no Binding either: it is a fact about the
    /// PROVIDER, and every ticket this room draws shares one.
    let closureOffered: Bool

    /// How a Binding's health reads as a dot, plus whether a read through it has ever LANDED.
    package struct Connection: Sendable, Equatable {
        /// `nil` is the honest unknown the tier rules owe, drawn as the same outlined dot a roster
        /// row uses for it.
        let state: ArgoOperationalState?
        /// It is what separates "the provider answered, and the answer was nothing" from "nobody
        /// has answered yet" — an empty listing looks identical either way, and only one of the
        /// two may be said out loud.
        let hasAnswered: Bool

        package init(state: ArgoOperationalState?, hasAnswered: Bool) {
            self.state = state
            self.hasAnswered = hasAnswered
        }

        /// The one health read, folded into both facts at once.
        init(of health: BindingHealth) {
            self.init(state: Self.state(of: health), hasAnswered: health.lastSuccess != nil)
        }

        /// How a Binding's health reads as a dot. A Binding nothing has ever read through is `nil`
        /// and not idle: a green dot over a read that has never landed is the false DIRECT the
        /// tier rules exist to refuse (`CONTEXT.md` L2 · degrade-down).
        private static func state(of health: BindingHealth) -> ArgoOperationalState? {
            switch health.fault {
            case .none: health.lastSuccess == nil ? nil : .idle
            case .grantRefused: .failure
            case .read: .attention
            }
        }
    }

    var state: ArgoOperationalState? {
        connection.state
    }

    var hasAnswered: Bool {
        connection.hasAnswered
    }

    /// The Ticket port's own connection, and `nil` where nothing is bound to it — which is what
    /// makes the whole room vacant rather than an empty foot under a full one.
    ///
    /// The Ticket port ALONE. A window whose code host is failing still has a Ticket provider
    /// that is reading fine, and a foot that folded the two would name the wrong thing to repair.
    init?(reading: ConnectionHealthReading) {
        guard let found = reading.connections.first(where: { $0.port == .ticket })
        else { return nil }
        self.init(
            name: found.account.provider.readableName,
            account: found.account.displayName,
            connection: Connection(of: found.health),
            closureOffered: ProviderTicketWrites().port(of: found.account.provider)
                .surface.offers(.closure),
        )
    }

    package init(
        name: String,
        account: String,
        connection: Connection,
        closureOffered: Bool = true,
    ) {
        self.name = name
        self.account = account
        self.connection = connection
        self.closureOffered = closureOffered
    }
}

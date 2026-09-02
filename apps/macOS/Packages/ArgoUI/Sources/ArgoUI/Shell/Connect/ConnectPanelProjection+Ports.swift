import ArgoEngine

/// The two port rows: what each one reads through, what else it could read through, and how a new
/// identity is added when neither answer is the right one. Each port takes its own Account, so no
/// row may assume one grant feeds both (#414).
extension ConnectPanelProjection {
    /// One authorized identity, offered for a port it can fill. Picking one binds with no OAuth
    /// round-trip.
    struct AccountChoice: Identifiable, Equatable {
        let id: String
        /// Provider first, then the identity: two Accounts on one provider are told apart by the
        /// login, and two providers by the name in front of it. Neither reading needs a token.
        let title: String
    }

    /// Authorizing one more identity with a provider. One per provider that both serves this port
    /// and has a flow behind it in this build.
    struct Offer: Identifiable, Equatable {
        let id: AccountProvider
        let title: String
    }

    package struct PortRow: Identifiable, Equatable {
        package let id: AccountPort
        let row: Row
        let choices: [AccountChoice]
        let offers: [Offer]
        /// The scope picker, present only while it is open ON THIS PORT — the reading holds one for
        /// the whole panel, and matching it here is what keeps two rows from drawing it at once.
        let picker: Picker?
        /// What this port currently reads through, carried apart from the detail line so a rebind
        /// can open on it.
        let scope: String?
        /// What has come undone about this row. On the row rather than at the foot of the panel:
        /// it is a fact about this port and stays true while the user does something else.
        let note: ConnectNote?
        let isBound: Bool
    }

    /// An open picker, with the Account it is choosing a scope for already resolved: the row draws
    /// the provider's own noun ("Repository") and never has to look an Account up itself.
    struct Picker: Equatable {
        let accountID: String
        /// Whose grant this is, so a refused one can be authorized again from the picker itself.
        let provider: AccountProvider
        let scopeNoun: String
        let state: ConnectScopes.State
        /// What the port already reads through, so a rebind opens on it rather than on nothing.
        let current: String?
    }

    static func portRows(from reading: ConnectReading) -> [PortRow] {
        AccountPort.allCases.map { portRow(reading.port($0), in: reading) }
    }

    private static func portRow(_ port: ConnectPort, in reading: ConnectReading) -> PortRow {
        PortRow(
            id: port.port,
            row: row(
                title: port.port.readableName,
                detail: detail(of: port, in: reading),
                isMachine: port.accountID != nil,
            ),
            // A Binding is a fact about a Project, so with no folder there is nothing to bind to
            // and the choices are withheld. Authorizing is NOT: that is Account-level and needs
            // no Project.
            choices: reading.folder == nil ? [] : choices(for: port.port, in: reading),
            offers: offers(for: port.port, in: reading),
            picker: picker(for: port.port, in: reading),
            scope: port.scope,
            note: fault(of: port).map(ConnectNote.init(fault:)),
            isBound: port.accountID != nil,
        )
    }

    /// An open picker resolves to nothing when its Account has gone: there is no provider left to
    /// name the scope in, and a picker over an identity the Mac no longer holds offers a bind that
    /// `ProjectBindings` refuses anyway.
    private static func picker(for port: AccountPort, in reading: ConnectReading) -> Picker? {
        guard let scopes = reading.scopes, scopes.port == port,
              let account = reading.account(scopes.accountID) else { return nil }
        return Picker(
            accountID: account.id,
            provider: account.provider,
            scopeNoun: account.provider.scopeNoun,
            state: scopes.state,
            current: reading.port(port).scope,
        )
    }

    /// Which Account this port reads through, and through what. A broken row still names the
    /// Binding it had, which is what makes it re-bindable rather than quietly empty.
    private static func detail(of port: ConnectPort, in reading: ConnectReading) -> String {
        guard let accountID = port.accountID, let scope = port.scope else {
            return unbound(port.port, in: reading)
        }
        guard let account = reading.account(accountID) else {
            return scope
        }
        return "\(account.provider.readableName) · \(account.displayName) · \(scope)"
    }

    /// A port with no Binding on it — which is NOT the same as a port with no Account behind it.
    /// An identity that has just been authorized has to be visible on the row that asked for it, or
    /// the device-code card simply vanishes and the screen says what it said before (#821).
    private static func unbound(_ port: AccountPort, in reading: ConnectReading) -> String {
        // The one dependency between the rows, said where it applies: connecting an account works
        // here, but pointing it at a repository needs a Project to point it FOR.
        guard reading.folder != nil else {
            return "\(port.benefit) Choose a folder first to say which one."
        }
        let held = reading.accounts.filter { $0.provider.serves(port) }
        // The identity the row is mid-choice on wins over the count, and a grant that has just
        // landed opens its own picker — so the account #821 asked to see named is named even on a
        // Mac that already held three.
        guard let named = chosen(for: port, in: reading) ?? (held.count == 1 ? held.first : nil)
        else {
            guard let any = held.first else { return port.benefit }
            let noun = any.provider.scopeNoun.lowercased()
            return "\(held.count) accounts connected. Choose one, then a \(noun)."
        }
        return "Connected as \(named.provider.readableName) · \(named.displayName)."
            + " Choose a \(named.provider.scopeNoun.lowercased())."
    }

    private static func chosen(
        for port: AccountPort,
        in reading: ConnectReading,
    )
        -> AccountRecord? {
        guard let scopes = reading.scopes, scopes.port == port else { return nil }
        return reading.account(scopes.accountID)
    }

    private static func fault(of port: ConnectPort) -> BindingFault? {
        switch port.state {
        case .unbound, .bound: nil
        case let .broken(_, _, fault): fault
        }
    }

    /// Every Account that could fill this port, the one already on it included: rebinding to the
    /// same Account under a different scope is a move the row has to allow.
    private static func choices(
        for port: AccountPort,
        in reading: ConnectReading,
    )
        -> [AccountChoice] {
        reading.accounts
            .filter { $0.provider.serves(port) }
            .map { account in
                AccountChoice(
                    id: account.id,
                    title: "\(account.provider.readableName) · \(account.displayName)",
                )
            }
    }

    private static func offers(for port: AccountPort, in reading: ConnectReading) -> [Offer] {
        reading.authorizable
            .filter { $0.serves(port) }
            .map { Offer(id: $0, title: "Connect a \($0.readableName) account") }
    }
}

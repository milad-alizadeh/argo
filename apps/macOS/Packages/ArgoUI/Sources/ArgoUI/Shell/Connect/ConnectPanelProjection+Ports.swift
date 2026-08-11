import ArgoEngine

/// The two port rows: what each one reads through, what else it could read through, and how a new
/// identity is added when neither answer is the right one.
///
/// This is the half of the panel the account level changed. A single sign-in button was honest
/// while one grant fed both ports; it is not now (#414), so a row names its Account, offers every
/// other Account that could fill it, and keeps the way to authorize one more.
extension ConnectPanelProjection {
    /// One authorized identity, offered for a port it can fill. Picking one binds with no OAuth
    /// round-trip, which is the whole point of Accounts and Bindings being two levels.
    struct AccountChoice: Identifiable, Equatable {
        let id: String
        /// Provider first, then the identity: two Accounts on one provider are told apart by the
        /// login, and two providers by the name in front of it. Neither reading needs a token.
        let title: String
        /// What this provider calls the thing a Binding points at, and the shape it is typed in.
        let scopeNoun: String
        let scopeHint: String
    }

    /// Authorizing one more identity with a provider. One per provider that both serves this port
    /// and has a flow behind it in this build.
    struct Offer: Identifiable, Equatable {
        let id: AccountProvider
        let title: String
    }

    struct PortRow: Identifiable, Equatable {
        let id: AccountPort
        let row: Row
        let choices: [AccountChoice]
        let offers: [Offer]
        /// What this port currently reads through, carried apart from the detail line so a rebind
        /// can open on it. Re-typing a scope to change which identity reads it is the busywork the
        /// account level exists to remove.
        let scope: String?
        /// What has come undone about this row, where something has. It sits on the row rather
        /// than at the foot of the panel because it is a fact about this port and stays true while
        /// the user does something else.
        let note: ConnectNote?
        let isBound: Bool
    }

    static func portRows(from reading: ConnectReading) -> [PortRow] {
        AccountPort.allCases.map { portRow(reading.port($0), in: reading) }
    }

    private static func portRow(_ port: ConnectPort, in reading: ConnectReading) -> PortRow {
        PortRow(
            id: port.port,
            row: row(title: port.port.readableName, detail: detail(of: port, in: reading)),
            choices: choices(for: port.port, in: reading),
            offers: offers(for: port.port, in: reading),
            scope: port.scope,
            note: fault(of: port).map(ConnectNote.init(fault:)),
            isBound: port.accountID != nil,
        )
    }

    /// Which Account this port reads through, and through what. A broken row leads with what has
    /// come undone and keeps the choice underneath it: the Binding is still recorded, and saying
    /// what it was is what makes it re-bindable rather than a row that quietly emptied itself.
    private static func detail(of port: ConnectPort, in reading: ConnectReading) -> String {
        guard let accountID = port.accountID, let scope = port.scope else {
            return port.port.benefit
        }
        guard let account = reading.account(accountID) else {
            return scope
        }
        return "\(account.provider.readableName) · \(account.displayName) · \(scope)"
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
                    scopeNoun: account.provider.scopeNoun,
                    scopeHint: account.provider.scopeHint,
                )
            }
    }

    private static func offers(for port: AccountPort, in reading: ConnectReading) -> [Offer] {
        reading.authorizable
            .filter { $0.serves(port) }
            .map { Offer(id: $0, title: "Connect a \($0.readableName) account") }
    }
}

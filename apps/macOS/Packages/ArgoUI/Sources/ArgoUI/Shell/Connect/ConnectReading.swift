import ArgoEngine

/// Everything the Connect panel renders, as values: the folder, the Accounts this Mac holds, what
/// fills each port, and whatever is currently in flight or has just gone wrong. A second value
/// beside `CockpitPresentation` because Accounts and Bindings are registry facts the Hub has never
/// heard of.
public struct ConnectReading: Equatable, Sendable {
    /// The Project's folder, and `nil` before one is chosen. A folder is the floor — everything
    /// else on this panel is optional beside it (#265), so the call to action reads off this field
    /// alone.
    public let folder: String?
    /// Every identity this Mac holds, in the registry's own order.
    public let accounts: [AccountRecord]
    public let ports: [ConnectPort]
    public let companion: ConnectCompanion
    /// A grant waiting on the browser, absent the rest of the time.
    public let challenge: ConnectChallenge?
    /// The one port whose scope picker is open, and absent while none is. One at a time by
    /// construction: two open pickers would be two half-made Bindings on one panel.
    public let scopes: ConnectScopes?
    /// The last thing that did not work. Cleared by the app the moment the user acts again, so a
    /// note never outlives the attempt it belongs to.
    public let note: ConnectNote?
    /// The providers this build can actually start a grant with — never `AccountProvider.allCases`,
    /// since a provider with no flow behind it is a control that does nothing when pressed.
    /// Injectable so a test can render either answer.
    public let authorizable: [AccountProvider]

    /// What this build can authorize, in one place.
    ///
    /// Linear's flow is built (#371) and its OAuth App is registered by hand, so the offer is
    /// gated on the registration rather than named outright: a `Connect a Linear account` whose
    /// only outcome is "Argo cannot sign in to Linear yet" is worse than no menu item.
    public static let authorizableToday: [AccountProvider] = LinearOAuthApp.isRegistered
        ? [.github, .linear]
        : [.github]
    public let mode: ConnectPanelMode

    public init(
        folder: String? = nil,
        accounts: [AccountRecord] = [],
        ports: [ConnectPort] = [],
        companion: ConnectCompanion = .includedWithSpawns,
        challenge: ConnectChallenge? = nil,
        scopes: ConnectScopes? = nil,
        note: ConnectNote? = nil,
        authorizable: [AccountProvider] = ConnectReading.authorizableToday,
        mode: ConnectPanelMode = .creating,
    ) {
        self.folder = folder
        self.accounts = accounts
        self.ports = ports
        self.companion = companion
        self.challenge = challenge
        self.scopes = scopes
        self.note = note
        self.authorizable = authorizable
        self.mode = mode
    }

    /// What fills one port, including the answer "nothing" — every port the app knows about has a
    /// row, so a port the reading forgot to mention is still drawn as unbound rather than missing.
    func port(_ port: AccountPort) -> ConnectPort {
        ports.first { $0.port == port } ?? ConnectPort(port: port, state: .unbound)
    }

    func account(_ accountID: String?) -> AccountRecord? {
        accounts.first { $0.id == accountID }
    }
}

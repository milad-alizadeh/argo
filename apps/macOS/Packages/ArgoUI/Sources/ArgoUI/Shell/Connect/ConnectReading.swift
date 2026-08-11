import ArgoEngine

/// Everything the Connect panel renders, as values: the folder, the Accounts this Mac holds, what
/// fills each port, and whatever is currently in flight or has just gone wrong.
///
/// The panel's whole input, the way `CockpitPresentation` is the shell's. It is a second value
/// rather than fields on that one because the two are assembled from different places: the cockpit
/// is a projection of the Hub, and none of this is — Accounts and Bindings are registry facts, and
/// the Hub has never heard of them.
public struct ConnectReading: Equatable, Sendable {
    /// The Project's folder, and `nil` before one is chosen. A folder is the floor: everything
    /// else on this panel is optional beside it (#265), which is why the call to action reads off
    /// this field alone.
    public let folder: String?
    /// Every identity this Mac holds, in the registry's own order. Listing them is what makes a
    /// second Account on one provider a thing you pick rather than a thing you re-authorize.
    public let accounts: [AccountRecord]
    public let ports: [ConnectPort]
    public let companion: ConnectCompanion
    /// A grant waiting on the browser, absent the rest of the time.
    public let challenge: ConnectChallenge?
    /// The last thing that did not work. Cleared by the app the moment the user acts again, so a
    /// note never outlives the attempt it belongs to.
    public let note: ConnectNote?
    /// The providers this build can actually start a grant with — never `AccountProvider.allCases`,
    /// because a provider with no flow behind it would be a control that does nothing when
    /// pressed: Linear's grant is #371's, and until it lands nothing here may offer it.
    ///
    /// Injectable so a test can render the day Linear arrives, and defaulted to `authorizableToday`
    /// so the list exists as ONE literal rather than one per caller.
    public let authorizable: [AccountProvider]

    /// What this build can authorize, in one place. Beside the panel's own value rather than in the
    /// app, because it is the answer every construction of this type defaults to.
    public static let authorizableToday: [AccountProvider] = [.github]
    public let mode: ConnectPanelMode

    public init(
        folder: String? = nil,
        accounts: [AccountRecord] = [],
        ports: [ConnectPort] = [],
        companion: ConnectCompanion = .includedWithSpawns,
        challenge: ConnectChallenge? = nil,
        note: ConnectNote? = nil,
        authorizable: [AccountProvider] = ConnectReading.authorizableToday,
        mode: ConnectPanelMode = .creating,
    ) {
        self.folder = folder
        self.accounts = accounts
        self.ports = ports
        self.companion = companion
        self.challenge = challenge
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

import ArgoEngine
import Foundation

/// The readings the Connect panel's previews, specimens and suites are all built from. In
/// `Sources` so the previews can reach it. Two GitHub Accounts, deliberately: the panel's
/// account-level claims need a second identity on screen to be judgeable.
enum ConnectFixture {
    static let personal = AccountRecord(
        provider: .github,
        providerAccountID: "9379343",
        displayName: "milad-alizadeh",
    )
    static let work = AccountRecord(
        provider: .github,
        providerAccountID: "5512201",
        displayName: "milad-at-trili",
    )
    static let linear = AccountRecord(
        provider: .linear,
        providerAccountID: "3f9c2b1e",
        displayName: "Trili",
    )

    static let folder = "~/Developer/argo"

    static let deviceURL = URL(string: "https://github.com/login/device")
        ?? URL(fileURLWithPath: "/")

    static let challenge = typed(.github)

    /// Linear's grant, which is a redirect: the browser carries the whole exchange, so there is no
    /// code to type and the card draws one row fewer.
    static let redirect = redirected(.linear)

    /// The two shapes the waiting card draws, per provider — the copy sweep walks both for every
    /// one, since half of each is behind a flow only that provider takes.
    static func typed(_ provider: AccountProvider) -> ConnectChallenge {
        ConnectChallenge(
            provider: provider, kind: .typed(code: "WDJB-MJHT"), verificationURL: deviceURL,
        )
    }

    static func redirected(_ provider: AccountProvider) -> ConnectChallenge {
        ConnectChallenge(
            provider: provider,
            kind: .redirect,
            verificationURL: URL(string: "https://linear.app/oauth/authorize")
                ?? URL(fileURLWithPath: "/"),
        )
    }

    /// Nothing chosen and nothing connected: what a first launch opens on.
    static let fresh = ConnectReading()

    /// A folder and nothing else. The observation floor, and a Project that already works.
    static let folderOnly = ConnectReading(folder: folder)

    /// Half connected, and usable: issues read through the work identity, pull requests through
    /// nothing yet.
    static let partly = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        ports: [ConnectPort(
            port: .ticket,
            state: .bound(accountID: work.id, scope: "trili/cockpit"),
        )],
    )

    /// Both ports filled, by two different identities on one provider, which the model allows.
    static let wired = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        ports: [
            ConnectPort(port: .ticket, state: .bound(
                accountID: personal.id,
                scope: "milad-alizadeh/argo",
            )),
            ConnectPort(port: .codeHost, state: .bound(
                accountID: work.id,
                scope: "trili/cockpit",
            )),
        ],
    )

    /// A Binding recorded against an Account this Mac no longer holds.
    static let broken = ConnectReading(
        folder: folder,
        accounts: [personal],
        ports: [ConnectPort(port: .ticket, state: .broken(
            accountID: work.id,
            scope: "trili/cockpit",
            fault: .accountRemoved,
        ))],
    )

    /// A grant waiting on the browser, over a panel that is still usable underneath it.
    static let waiting = ConnectReading(
        folder: folder,
        accounts: [personal],
        challenge: challenge,
    )

    /// A bind the provider refused, which changes nothing about the rest of the panel.
    static let refused = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        note: ConnectNote(refusal: .scopeNotVisible("trili/cockpit")),
    )

    /// The honest `Not available yet`: this build ships no plugin, so no spawn can write one.
    static let pluginMissing = ConnectReading(
        folder: folder,
        accounts: [personal],
        companion: .missingFromBuild,
    )

    /// The last spawn could not write its plugin, told with the refusal's own words.
    static let pluginFailed = ConnectReading(
        folder: folder,
        accounts: [personal],
        companion: .installFailed(why: "Companion socket could not be opened"),
    )

    /// The same panel re-entered on a Project that exists.
    static let settings = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        ports: wired.ports,
        mode: .settings(agent: .claude),
    )

    /// An identity just authorized, its repositories on the way. The state the device-code card
    /// hands over to (#821).
    static let connecting = ConnectReading(
        folder: folder,
        accounts: [personal],
        scopes: ConnectScopes(port: .ticket, accountID: personal.id, state: .loading),
    )

    /// The repositories, listed. The row underneath still has to say which identity they came from.
    static let choosing = ConnectReading(
        folder: folder,
        accounts: [personal],
        scopes: ConnectScopes(
            port: .ticket,
            accountID: personal.id,
            state: .listed(
                ["milad-alizadeh/argo", "milad-alizadeh/dotfiles", "trili/cockpit"],
                truncated: false,
            ),
        ),
    )

    /// The listing GitHub would not answer. No field to type into: a scope typed past a failed read
    /// is a guess with a button on it.
    static let scopesUnreadable = ConnectReading(
        folder: folder,
        accounts: [personal],
        scopes: ConnectScopes(
            port: .ticket,
            accountID: personal.id,
            state: .unreadable("GitHub could not be reached."),
        ),
    )

    /// The grant itself refused. Retrying reuses the same token, so the picker offers the one
    /// repair that can work.
    static let scopesUnauthorized = ConnectReading(
        folder: folder,
        accounts: [personal],
        scopes: ConnectScopes(
            port: .ticket,
            accountID: personal.id,
            state: .unauthorized,
        ),
    )

    /// One panel per state it can be in, each carrying the name it renders under.
    static let states: [(name: String, reading: ConnectReading)] = [
        ("connectFresh", fresh),
        ("connectFolderOnly", folderOnly),
        ("connectPartly", partly),
        ("connectWired", wired),
        ("connectWaiting", waiting),
        ("connectConnecting", connecting),
        ("connectChoosing", choosing),
        ("connectScopesUnreadable", scopesUnreadable),
        ("connectScopesUnauthorized", scopesUnauthorized),
        ("connectRefused", refused),
        ("connectRefusedAtLength", refusedAtLength),
        ("connectBroken", broken),
        ("connectPluginMissing", pluginMissing),
        ("connectPluginFailed", pluginFailed),
        ("projectSettings", settings),
    ]
}

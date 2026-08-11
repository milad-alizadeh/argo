import ArgoEngine
import Foundation

/// The readings the Connect panel's previews, specimens and suites are all built from.
///
/// One set for all three, in `Sources` where the previews can reach it: a fixture kept in the test
/// target as well would be the same states written twice, drifting from the day the first of them
/// changed.
///
/// Two GitHub Accounts, deliberately. One grant feeding both ports was the honest picture while a
/// machine held one identity, and every claim this panel makes about the account level needs a
/// second one on screen to be judgeable at all.
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

    static let challenge = ConnectChallenge(
        provider: .github,
        userCode: "WDJB-MJHT",
        verificationURL: URL(string: "https://github.com/login/device")
            ?? URL(fileURLWithPath: "/"),
    )

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
            port: .workItem,
            state: .bound(accountID: work.id, scope: "trili/cockpit"),
        )],
    )

    /// Both ports filled, by two different identities on one provider, which the model allows and
    /// this panel has to render without either row reading as the other's.
    static let wired = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        ports: [
            ConnectPort(port: .workItem, state: .bound(
                accountID: personal.id,
                scope: "milad-alizadeh/argo",
            )),
            ConnectPort(port: .codeHost, state: .bound(
                accountID: work.id,
                scope: "trili/cockpit",
            )),
        ],
    )

    /// A Binding recorded against an Account this Mac no longer holds. It keeps its place, says
    /// what came undone, and stays one pick away from working.
    static let broken = ConnectReading(
        folder: folder,
        accounts: [personal],
        ports: [ConnectPort(port: .workItem, state: .broken(
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

    /// The same panel re-entered on a Project that exists.
    static let settings = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        ports: wired.ports,
        mode: .settings(agent: .claude),
    )

    /// Which state each catalog case is a render of. A table rather than a `switch` on `Specimen`,
    /// for the reason the header fixtures are one: the case names the state it belongs to here, so
    /// neither side can be renamed into drawing the other's panel.
    static let states: [(specimen: Specimen, reading: ConnectReading)] = [
        (.connectFresh, fresh),
        (.connectFolderOnly, folderOnly),
        (.connectPartly, partly),
        (.connectWired, wired),
        (.connectWaiting, waiting),
        (.connectRefused, refused),
        (.connectBroken, broken),
        (.projectSettings, settings),
    ]
}

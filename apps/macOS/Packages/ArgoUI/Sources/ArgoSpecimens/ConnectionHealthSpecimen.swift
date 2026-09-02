import ArgoEngine
import ArgoUI
import Foundation

/// The chip over each level a connection fails at, so the two are looked at rather than reasoned
/// about.
///
/// They are structural rather than a value changing: one connection down names its provider and
/// waits, two roll up to a count, and a refused grant names the identity and grows a button. The
/// claim each carries is that the chip says which thing broke and what, if anything, to press.
enum ConnectionHealthSpecimen {
    struct State {
        /// The name this level renders under, so the chip and the PNG naming it are one value.
        let name: String
        let reading: ConnectionHealthReading
    }

    /// Two GitHub identities on one machine, which is the whole reason the account level exists.
    private static let work = AccountRecord(
        provider: .github,
        providerAccountID: "1",
        displayName: "work",
    )
    private static let personal = AccountRecord(
        provider: .github,
        providerAccountID: "2",
        displayName: "milad",
    )

    /// Four minutes back from whenever the render happens, rather than a fixed instant: the chip
    /// words an age against the wall clock, so a stamp from 1970 would render `20000d ago` and a
    /// relative one renders the same `4m ago` in every capture.
    private static let lastSuccess = Date().addingTimeInterval(-4 * 60)

    static let states: [State] = [
        State(name: "connectionStale", reading: ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .read(.offline), lastSuccess: lastSuccess),
            ),
        ])),
        State(name: "connectionsStale", reading: ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .read(.offline), lastSuccess: lastSuccess),
            ),
            PortConnection(
                port: .codeHost,
                account: personal,
                health: BindingHealth(fault: .read(.rateLimited), lastSuccess: lastSuccess),
            ),
        ])),
        State(name: "connectionNeedsReconnect", reading: ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .grantRefused, lastSuccess: lastSuccess),
            ),
        ])),
    ]
}

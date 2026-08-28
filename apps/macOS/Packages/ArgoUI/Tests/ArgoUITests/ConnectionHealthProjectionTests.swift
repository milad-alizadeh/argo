import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The chip's words over the two levels — and the fact that they are the registry's words, with
/// nothing coined beside them.
@Suite("Connection health roll-up")
struct ConnectionHealthProjectionTests {
    private let work = AccountRecord(
        provider: .github,
        providerAccountID: "1",
        displayName: "work",
    )
    private let personal = AccountRecord(
        provider: .github,
        providerAccountID: "2",
        displayName: "milad",
    )
    private let now = Date(timeIntervalSince1970: 10000)

    @Test
    func `a healthy connection draws no chip at all`() {
        let reading = ConnectionHealthReading(connections: [
            PortConnection(port: .ticket, account: work, health: .healthy),
        ])

        #expect(ConnectionHealthProjection.chip(from: reading, asOf: now) == nil)
    }

    @Test
    func `a stale connection carries its provider, its age and its cause`() {
        let chip = ConnectionHealthProjection.chip(
            from: stale(.offline, lastSuccess: now.addingTimeInterval(-240)),
            asOf: now,
        )

        #expect(chip?.label == "GitHub · 4m ago · offline")
        #expect(chip?.action == nil)
    }

    /// The cause words render as the registry spells them, `rate limited` included — an enum case
    /// leaking its camel case would be Argo's vocabulary written in Swift's.
    @Test
    func `rate limited reads as two words`() {
        let chip = ConnectionHealthProjection.chip(
            from: stale(.rateLimited, lastSuccess: now),
            asOf: now,
        )

        #expect(chip?.label == "GitHub · just now · rate limited")
    }

    /// A connection Argo has never had a good read through has no age, and says so by leaving it
    /// out rather than by claiming zero.
    @Test
    func `a connection that never landed a read carries no age`() {
        let chip = ConnectionHealthProjection.chip(
            from: stale(.unreachable, lastSuccess: nil),
            asOf: now,
        )

        #expect(chip?.label == "GitHub · unreachable")
    }

    /// The account level's one escalation past the roll-up. It names the identity because that is
    /// what has to be reconnected: with two GitHub Accounts on a machine, "GitHub" names neither
    /// the thing that broke nor the thing to press.
    @Test
    func `a refused grant names the account and offers the one act that fixes it`() {
        let reading = ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .grantRefused, lastSuccess: now),
            ),
        ])

        let chip = ConnectionHealthProjection.chip(from: reading, asOf: now)

        #expect(chip?.label == "GitHub · work · needs reconnect")
        #expect(chip?.action == "Reconnect")
    }

    /// Both ports on one Account is the ordinary case, and it is still **one** grant to obtain —
    /// so the chip says it once rather than counting the Bindings it took down.
    @Test
    func `one account filling both ports is one reconnect, not two`() {
        let reading = ConnectionHealthReading(connections: [
            refused(.ticket, work),
            refused(.codeHost, work),
        ])

        #expect(ConnectionHealthProjection.chip(from: reading, asOf: now)?.label
            == "GitHub · work · needs reconnect")
    }

    /// Two Accounts are two grants and two acts, so the chip stops naming one and counts instead.
    /// Naming the first would send the user to reconnect an identity and find the chip still lit.
    @Test
    func `two refused accounts are counted, not named`() {
        let reading = ConnectionHealthReading(connections: [
            refused(.ticket, work),
            refused(.codeHost, personal),
        ])

        #expect(ConnectionHealthProjection.chip(from: reading, asOf: now)?.label
            == "2 accounts need reconnect")
    }

    /// The escalation outranks the roll-up: where both are failing, the reconnect is the only one
    /// with an action, and the stale one is waiting on it anyway.
    @Test
    func `a refused grant outranks a stale read in the roll-up`() {
        let reading = ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .read(.offline), lastSuccess: now),
            ),
            refused(.codeHost, personal),
        ])

        let chip = ConnectionHealthProjection.chip(from: reading, asOf: now)

        #expect(chip?.label == "GitHub · milad · needs reconnect")
        #expect(chip?.action == "Reconnect")
    }

    /// Two stale connections roll up to a count, because the action in both is identical: you wait.
    /// Per-port truth exists; it just is not glanceable chrome.
    @Test
    func `two stale connections roll up to a count`() {
        let reading = ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .read(.offline), lastSuccess: now),
            ),
            PortConnection(
                port: .codeHost,
                account: work,
                health: BindingHealth(fault: .read(.unreachable), lastSuccess: now),
            ),
        ])

        #expect(ConnectionHealthProjection.chip(from: reading, asOf: now)?.label
            == "2 connections stale")
    }

    /// A stale connection is amber and a refused grant is red, which is the difference between
    /// something Argo is waiting out and something it knows will not fix itself.
    @Test
    func `staleness asks for attention and a refused grant reads as a failure`() {
        #expect(ConnectionHealthProjection.chip(from: stale(.offline, lastSuccess: now), asOf: now)?
            .state == .attention)
        #expect(ConnectionHealthProjection.chip(
            from: ConnectionHealthReading(connections: [refused(.ticket, work)]),
            asOf: now,
        )?.state == .failure)
    }

    /// Argo's own observation keeps the chip it already had, in the words it already used. The two
    /// subjects share one chrome so the app never grows a second failure language.
    @Test
    func `the observation chip keeps its own words`() {
        #expect(ConnectionChipReading(observing: .connected) == nil)
        #expect(ConnectionChipReading(observing: .idle)?.label == "No live sessions")
        #expect(ConnectionChipReading(observing: .failed(message: "Transcript unavailable"))?
            .action == "Retry")
    }

    /// The channel separation #260 locks: connection health never enters the one the session dot
    /// carries. Asserted over the projection rather than by reading the wiring — the roster is
    /// built from `CockpitPresentation`, which has no connection in it at all, so a change that
    /// piped health into a row would have to break this to compile.
    ///
    /// It cannot prove a dot will never change; it pins the seam that would have to move first.
    /// The reason is the dot's one channel says "your agent is waiting on you" — something to act
    /// on this second — and spending it on "GitHub is unreachable" trains the reader to distrust
    /// the loudest signal in the app.
    @Test
    func `connection health reaches no session's state`() {
        let sessions = [RosterSessionFixture.session(id: "a", status: .running)]
        let rows = SessionRosterProjection.rows(from: sessions)

        #expect(rows.map(\.state) == [SessionState.role(for: .running)])
        // The failing connection is a value beside the presentation, never inside it, so there is
        // nothing here for it to have changed.
        #expect(ConnectionHealthProjection.chip(
            from: stale(.offline, lastSuccess: now),
            asOf: now,
        ) != nil)
    }

    private func stale(_ cause: ConnectionCause, lastSuccess: Date?) -> ConnectionHealthReading {
        ConnectionHealthReading(connections: [
            PortConnection(
                port: .ticket,
                account: work,
                health: BindingHealth(fault: .read(cause), lastSuccess: lastSuccess),
            ),
        ])
    }

    private func refused(_ port: AccountPort, _ account: AccountRecord) -> PortConnection {
        PortConnection(
            port: port,
            account: account,
            health: BindingHealth(fault: .grantRefused, lastSuccess: nil),
        )
    }
}

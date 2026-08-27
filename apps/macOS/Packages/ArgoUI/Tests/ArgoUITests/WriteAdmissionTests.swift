import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What a write control asks the reading, and the three answers it can get.
///
/// A caller needs more than a Bool: a refusal has to name the identity to reconnect, because a
/// provider has N grants on a machine and "reconnect GitHub" points at none of them.
@Suite("Write admission")
struct WriteAdmissionTests {
    private let work = AccountRecord(
        provider: .github,
        providerAccountID: "1",
        displayName: "work",
    )
    private let now = Date(timeIntervalSince1970: 10000)

    @Test
    func `a healthy port is written through`() {
        #expect(reading(.healthy).writes(through: .workItem) == .admitted)
    }

    /// §7 of the failure spec: a failing read does not prove a write will fail, so the control
    /// stays live and the attempt reports the real reason.
    @Test
    func `a stale port is still written through`() {
        let stale = BindingHealth(fault: .read(.rateLimited), lastSuccess: now)

        #expect(reading(stale).writes(through: .workItem) == .admitted)
    }

    @Test
    func `a refused grant refuses the write, naming the account to reconnect`() {
        let refused = BindingHealth(fault: .grantRefused, lastSuccess: now)

        #expect(reading(refused).writes(through: .workItem) == .refused(work))
    }

    /// A port with nothing bound to it is a fully-onboarded state, not a refusal. There is no
    /// provider to write through, so there is no control to grey out either.
    @Test
    func `an unbound port has no write to admit`() {
        #expect(ConnectionHealthReading.quiet.writes(through: .workItem) == .unbound)
    }

    /// The ports fail independently, which is what keeping health per Binding is for: a dead Work
    /// Item grant leaves the code host writable.
    @Test
    func `one refused port leaves the other writable`() {
        let reading = ConnectionHealthReading(connections: [
            PortConnection(
                port: .workItem,
                account: work,
                health: BindingHealth(fault: .grantRefused, lastSuccess: now),
            ),
            PortConnection(port: .codeHost, account: work, health: .healthy),
        ])

        #expect(reading.writes(through: .workItem) == .refused(work))
        #expect(reading.writes(through: .codeHost) == .admitted)
    }

    private func reading(_ health: BindingHealth) -> ConnectionHealthReading {
        ConnectionHealthReading(connections: [
            PortConnection(port: .workItem, account: work, health: health),
        ])
    }
}

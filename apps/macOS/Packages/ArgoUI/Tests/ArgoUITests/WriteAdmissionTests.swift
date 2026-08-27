import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What a write control asks the reading, and the three answers it can get.
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

    /// A port the reading has no connection for is a fully-onboarded state, not a refusal — and
    /// the same answer covers a Binding that has come undone, which the fold drops for the same
    /// reason: there is no control to grey out because there is no control.
    @Test
    func `a port with no binding has no write to admit`() {
        #expect(ConnectionHealthReading.quiet.writes(through: .workItem) == .noBinding)
    }

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

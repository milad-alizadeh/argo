@testable import ArgoUI
import Testing

/// The debounce `ShellSidebar` runs a raw `controlActiveState` transition through before trusting
/// it as a genuine departure (#1402). `elapse` is substituted so these never actually sleep.
@Suite("Roster disengagement")
struct RosterDisengagementTests {
    /// A spurious blip: whatever undid the `.inactive` signal ran during the grace period, so
    /// `isStillInactive` reads false by the time `confirm` checks it.
    @Test
    func `a return during the grace period costs the roster nothing`() async {
        var released = false
        let disengagement = RosterDisengagement(grace: .milliseconds(10), elapse: { _ in
            // Simulates the reader coming back mid-wait: nothing has to happen for real time to
            // pass, only for the check after it to see the reversal.
        })

        await disengagement.confirm(isStillInactive: { false }, onDeparture: { released = true })

        #expect(!released)
    }

    /// A genuine departure: nothing reverses it during the wait, so `isStillInactive` still reads
    /// true once `confirm` asks.
    @Test
    func `a departure that survives the grace period releases`() async {
        var released = false
        let disengagement = RosterDisengagement(grace: .zero, elapse: { _ in })

        await disengagement.confirm(isStillInactive: { true }, onDeparture: { released = true })

        #expect(released)
    }
}

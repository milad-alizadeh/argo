import ArgoEngine
@testable import ArgoUI
import Testing

/// The other subject of the one connection chip: Argo observing ITSELF, rather than the health of a
/// Project's provider Bindings. Its own suite because the rule it answers to is its own —
/// `cockpit-failure-states-spec.md` §8, observation failure is not work failure — where the
/// Bindings answer to §1 and §2.
@Suite("Observation chip")
struct ObservationChipTests {
    /// Argo's own observation keeps the chip it already had, in the words it already used. The two
    /// subjects share one chrome so the app never grows a second failure language.
    @Test
    func `the observation chip keeps its own words`() {
        #expect(ConnectionChipReading(observing: .connected) == nil)
        #expect(ConnectionChipReading(observing: .idle)?.label == "No live sessions")
        #expect(ConnectionChipReading(observing: .failed(message: "Transcript unavailable"))?
            .action == "Retry")
    }

    /// §8, in the one place the app was still breaking it: spending the loudest ink on Argo's own
    /// blindness teaches the reader to distrust the loudest ink.
    @Test
    func `a transcript Argo cannot read asks for attention rather than reading as a failure`() {
        #expect(ConnectionChipReading(observing: .failed(message: "Transcript unavailable"))?
            .state == .attention)
    }

    /// Not merely unspent but unreachable: every reading enumerated, so a fifth `HubConnection`
    /// case cannot arrive wearing red without this failing first.
    @Test(arguments: [
        HubConnection.connected,
        .connecting,
        .idle,
        .failed(message: "Transcript unavailable"),
    ])
    func `no reading of Argo's own observation spends the failure ink`(connection: HubConnection) {
        #expect(ConnectionChipReading(observing: connection)?.state != .failure)
    }
}

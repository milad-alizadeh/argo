@testable import ArgoEngine
import Foundation
import Testing

/// One quiet external Session, varied one signal at a time — which is the point of the derivation
/// taking a value: every case below differs from the default in exactly the fact it is about.
private func signals(
    provenance: SessionProvenance = .external,
    liveness: SessionLiveness = .live,
    turnOpen: Bool = false,
    lastStop: StopReason? = nil,
    pendingAsk: Bool = false,
)
    -> SessionSignals {
    SessionSignals(
        provenance: provenance,
        liveness: liveness,
        turnOpen: turnOpen,
        lastStop: lastStop,
        pendingAsk: pendingAsk,
    )
}

private func status(_ signals: SessionSignals) -> SessionStatus {
    SessionStatus.read(signals).status
}

@Suite("Session status")
struct SessionStatusTests {
    @Test
    func `a live process with a turn still open is running`() {
        #expect(status(signals(turnOpen: true)) == .running)
    }

    @Test
    func `a live process whose last turn ended is idle — alive, not working`() {
        #expect(status(signals(lastStop: .endTurn)) == .idle)
    }

    @Test
    func `an unanswered question in the open turn is asking`() {
        #expect(status(signals(turnOpen: true, pendingAsk: true)) == .asking)
    }

    @Test
    func `an answered question is idle rather than a false-active asking`() {
        #expect(status(signals(lastStop: .endTurn, pendingAsk: false)) == .idle)
    }

    @Test
    func `a question with no live process behind it is never asking`() {
        // The record still holds the call; what it no longer has is anything corroborating that
        // somebody is waiting on it.
        #expect(status(signals(liveness: .quiet, turnOpen: true, pendingAsk: true)) == .idle)
    }

    @Test
    func `an open turn nothing corroborates resolves down to idle, never running`() {
        #expect(status(signals(liveness: .quiet, turnOpen: true)) == .idle)
    }

    @Test
    func `nothing observed at all is unknown rather than idle`() {
        #expect(status(signals(liveness: .quiet)) == .unknown)
    }

    @Test
    func `a live process with no turn to read is left as liveness found it`() {
        // An unparseable record costs the refinements a parsed one would add, not the dot.
        #expect(status(signals()) == .running)
    }

    @Test
    func `an unreadable turn boundary is unknown rather than the nearest guess`() {
        #expect(StopReason(reported: "stop_sequence") == .unknown)
        #expect(status(signals(lastStop: .unknown)) == .unknown)
    }

    @Test
    func `interrupting a turn leaves the Session idle, not ended`() {
        // The run stopped; the Session is sitting there waiting for the next prompt. `ended` is
        // the process going away, which no Turn's reason can report.
        #expect(status(signals(lastStop: .cancelled)) == .idle)
    }

    @Test
    func `the hosts own words are the reasons`() {
        #expect(StopReason(reported: "end_turn") == .endTurn)
        #expect(StopReason(reported: "max_tokens") == .maxTokens)
        #expect(StopReason(reported: "max_turn_requests") == .maxTurnRequests)
        #expect(StopReason(reported: "refusal") == .refusal)
        #expect(StopReason(reported: "cancelled") == .cancelled)
    }

    @Test
    func `a subagent's turn never closes the Session's own`() async throws {
        let events = try await Fixture.events("sidechain")

        // Two assistant records end `end_turn` in that file; only the root's is the Session's.
        #expect(events.count(where: { $0 == .turnEnded(.endTurn) }) == 1)
    }

    @Test
    func `a tool call is a pause inside a turn, never its end`() async throws {
        let events = try await Fixture.events("treeFull")

        #expect(!events.contains(.turnEnded(.unknown)))
        // The fixture's calls all carry `tool_use`; the turns that genuinely ended are the only
        // boundaries in it.
        #expect(events.contains(.turnEnded(.endTurn)))
    }
}

/// The honesty gate: which states each posture can honestly reach, and what every reading is worth.
@Suite("Session status honesty")
struct SessionStatusHonestyTests {
    private static let halts: [StopReason] = [.maxTokens, .maxTurnRequests, .refusal]

    @Test
    func `a wall the agent hit is stopped only for a Session Argo owns`() {
        for halt in Self.halts {
            #expect(status(signals(provenance: .managed, lastStop: halt)) == .stopped)
            #expect(status(signals(provenance: .external, lastStop: halt)) == .idle)
        }
    }

    @Test
    func `ended is reached only where Argo witnessed the process exit`() {
        // `orphaned` IS that witness: Argo claimed the folder and saw its own PTY die.
        let gone = SessionLiveness.quiet
        #expect(status(signals(provenance: .orphaned, liveness: gone, lastStop: .endTurn)) ==
            .ended)
        #expect(status(signals(provenance: .external, liveness: gone, lastStop: .endTurn)) == .idle)
    }

    @Test
    func `an external Session never reaches a state its transcript cannot carry`() {
        let unreachable: Set<SessionStatus> = [.permission, .stopped, .ended]
        let reached = Self.everyReading(of: .external).map(\.status)

        #expect(reached.allSatisfy { !unreachable.contains($0) })
        // …and the floor is genuinely reached from below, rather than the set being empty.
        #expect(Set(reached) == [.running, .asking, .idle, .unknown])
    }

    @Test
    func `every posture reads DERIVED — ownership is not a transcript key`() {
        let tiers = SessionProvenance.allCases
            .flatMap(Self.everyReading(of:))
            .map(\.tier)

        #expect(tiers.allSatisfy { $0 == .derived })
    }

    /// Every combination of signals a posture can be observed in — the sweep that says a claim
    /// about what it "never" reaches is about the whole space rather than the cases remembered.
    private static func everyReading(of provenance: SessionProvenance) -> [SessionStatusReading] {
        let stops: [StopReason?] = [nil, .endTurn, .cancelled, .unknown] + halts
        return stops.flatMap { stop in
            [SessionLiveness.live, .quiet].flatMap { liveness in
                [true, false].flatMap { turnOpen in
                    [true, false].map { pendingAsk in
                        SessionStatus.read(signals(
                            provenance: provenance,
                            liveness: liveness,
                            turnOpen: turnOpen,
                            lastStop: stop,
                            pendingAsk: pendingAsk,
                        ))
                    }
                }
            }
        }
    }
}

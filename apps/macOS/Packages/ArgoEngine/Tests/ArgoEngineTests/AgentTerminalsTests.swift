@testable import ArgoEngine
import Testing

/// Ending ONE agent's PTY and forgetting it, which is what archiving a Session Argo owns asks the
/// registry for (#1290). Until then the registry could only end every PTY at once, so the only
/// per-Session exit was the window's.
///
/// Not `terminate(_:)`, which signals a child and keeps its entry for the inference path (#1245).
@Suite("Ending one agent's PTY")
@MainActor
struct AgentTerminalsTests {
    /// The claim named, and nothing else: the whole point of the verb is that the other agents
    /// Argo owns go on running.
    @Test
    func `ending one claim leaves the other PTYs alive`() {
        let terminals = AgentTerminals()
        let ending = unwatchedProcess()
        let staying = unwatchedProcess()
        terminals.adopt(SessionOwnership.ClaimID(value: "claim-1"), process: ending)
        terminals.adopt(SessionOwnership.ClaimID(value: "claim-2"), process: staying)

        terminals.end(SessionOwnership.ClaimID(value: "claim-1"))

        #expect(ending.isTerminated)
        #expect(!staying.isTerminated)
    }

    /// The claim is dropped BEFORE the host is asked to end: a host reports the exit it was just
    /// asked for, and the owner answers that by dropping the very table this is reading.
    @Test
    func `a claim is no longer writable once it is ended`() {
        let terminals = AgentTerminals()
        let claim = SessionOwnership.ClaimID(value: "claim-1")
        terminals.adopt(claim, process: unwatchedProcess())

        terminals.end(claim)

        #expect(!terminals.write("hello", to: claim))
    }

    /// A Turn still queued at the ending agent goes with it, and a Turn queued at another agent
    /// does not: `terminateAll` cleared the whole typing table, and one Session ending must not
    /// take a second Session's Turn with it.
    @Test
    func `ending one claim cancels only its own queued Turn`() async {
        let terminals = AgentTerminals()
        let ending = SessionOwnership.ClaimID(value: "claim-1")
        let staying = SessionOwnership.ClaimID(value: "claim-2")
        let endingProcess = unwatchedProcess()
        let stayingProcess = unwatchedProcess()
        terminals.adopt(ending, process: endingProcess)
        terminals.adopt(staying, process: stayingProcess)
        // Two Turns each, so the second of each pair is still waiting on the first when the
        // terminate lands: a Turn that has already gone out proves nothing about cancellation.
        for claim in [ending, staying] {
            terminals.write(Self.turn, to: claim)
            terminals.write(Self.turn, to: claim)
        }

        terminals.end(ending)

        // The surviving agent's queue drains, which is the assertion that the cancel was aimed:
        // waiting for the ended one to write nothing would pass on a registry that cancels neither.
        await settle { stayingProcess.written.count == 4 }
        #expect(stayingProcess.written.count == 4)
        // The ending agent keeps the one keystroke that had already gone out when it was ended,
        // and gains nothing after it: the Return of that Turn and the whole of the next one were
        // cancelled with the PTY.
        #expect(endingProcess.written == [Self.turn.first])
    }

    /// Window close and app quit still end everything, now as the loop over the same verb.
    @Test
    func `terminating them all ends every PTY`() {
        let terminals = AgentTerminals()
        let first = unwatchedProcess()
        let second = unwatchedProcess()
        terminals.adopt(SessionOwnership.ClaimID(value: "claim-1"), process: first)
        terminals.adopt(SessionOwnership.ClaimID(value: "claim-2"), process: second)

        terminals.terminateAll()

        #expect(first.isTerminated)
        #expect(second.isTerminated)
    }

    /// A gap short enough that a passing test does not wait on it, and long enough that the second
    /// Turn of each pair is still queued when the terminate lands.
    private static let turn = PacedKeystrokes(first: "hi", second: "\r", gap: .milliseconds(20))
}

/// This suite drives the registry directly, so nothing is listening for what the PTY says.
@MainActor
private func unwatchedProcess() -> FakeAgentProcess {
    FakeAgentProcess(events: AgentProcessEvents(onData: { _ in }, onExit: { _ in }))
}

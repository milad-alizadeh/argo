import ArgoEngine
@testable import ArgoUI
import Testing

/// The audit `cockpit-failure-states-spec.md` §8 asks for, as a claim a machine re-checks: which
/// statuses the roster spends its failure ink on, and therefore which of them an observation
/// failure would have to establish to turn a dot red.
///
/// This is one half of a pair, and neither half is worth much alone. The other is
/// `SessionStatusTests` → *an external Session never reaches a state its transcript cannot carry*,
/// which pins the set an observation can establish at `running · asking · idle · unknown`. Put the
/// two together and no observation failure — a process-match that missed, an mtime gone stale, a
/// transcript that will not parse — has a status to reach the red through.
@Suite("Observation failure ink")
struct ObservationFailureInkTests {
    /// `allCases`, so a status added to the domain has to be ruled on here rather than inheriting
    /// whichever ink its neighbour in the mapping happens to wear.
    @Test
    func `the failure ink is spent on the work stopping and on nothing else`() {
        let red = SessionStatus.allCases.filter { SessionState.role(for: $0) == .failure }

        #expect(red == [.stopped])
    }

    /// And `stopped` is a claim about the WORK — a wall the agent hit, `max_tokens` or a refusal —
    /// which is why it is the one status allowed the ink. It is also managed-only, so it says
    /// nothing about a Session Argo merely watches.
    @Test
    func `the status wearing the failure ink is the agent hitting a wall, not Argo going blind`() {
        #expect(SessionState.word(for: .stopped) == "Stopped")
        #expect(SessionState.role(for: .unknown) == nil)
    }
}

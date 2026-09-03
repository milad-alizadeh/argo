import ArgoEngine
import Foundation
import Testing

/// What the alert says when a Session will not start, continue or hand over.
///
/// The mapping used to be written out at all three call sites in the app target, where no test
/// reaches it — so a fourth error type would have started reading as a Foundation sentence at every
/// one of them, silently. One decision, tested here.
@Suite("The sentence a refusal reads as")
struct AgentRefusalTests {
    @Test
    func `each of Argo's own refusals keeps its own words`() {
        #expect(
            AgentRefusal.detail(of: AgentSpawnError.executableNotFound(command: "claude"))
                == "claude is not on your PATH",
        )
        #expect(
            AgentRefusal.detail(of: SessionResumeError.heldByAnotherWindow)
                == "Another Argo window is already running this session",
        )
        #expect(
            AgentRefusal.detail(of: SessionHandoff.Failure.noFolder)
                == "Argo has not read this Session's folder, so it cannot start one beside it",
        )
    }

    /// Anything else falls back to the system's sentence — the last resort, not the default an
    /// unlisted Argo error quietly lands on.
    @Test
    func `an error nobody worded reads as the system's own`() {
        let error = NSError(
            domain: "argo.test", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Something the OS said"],
        )

        #expect(AgentRefusal.detail(of: error) == "Something the OS said")
    }
}

import ArgoEngine
@testable import ArgoUI
import Testing

/// What a standing allow SAYS, on all three of the surfaces that say something about one (#572).
/// The bug this suite exists over is a label drifting from the grant behind it — *Always allow Bash
/// here* over a grant that covered every call to the tool — so the assertions are on the words.
@Suite("Standing allow projection")
struct StandingAllowProjectionTests {
    private func session(_ tools: [String]) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "A Session",
            model: "claude-opus-5",
            workspaceLocation: "/Users/someone/repo",
            access: .managed,
            status: .idle,
            standingAllows: tools.map(StandingAllow.init(toolName:)),
        )
    }

    @Test
    func `the offer names the tool and the whole scope it covers`() {
        #expect(StandingAllowProjection.offer("Bash") == "Always allow Bash in this Session")
    }

    @Test
    func `the tray states that same scope over the chips`() {
        #expect(StandingAllowProjection.trayLabel == "Always allowed in this Session")
    }

    @Test
    func `a revocation says the tool and the scope, for a chip reached alone`() {
        #expect(
            StandingAllowProjection.revocation("Bash")
                == "Stop always allowing Bash in this Session",
        )
    }

    @Test
    func `a Session with no grants draws no tray`() {
        #expect(StandingAllowProjection.allows(for: session([])).isEmpty)
        #expect(StandingAllowProjection.allows(for: nil).isEmpty)
    }

    @Test
    func `the grants come through in the order they were made`() {
        let allows = StandingAllowProjection.allows(for: session(["Bash", "Read"]))

        #expect(allows.map(\.toolName) == ["Bash", "Read"])
    }

    @Test
    func `the composer carries the Session's grants, so the tray is seen at rest`() throws {
        let composer = try #require(
            SessionComposerProjection.composer(for: session(["Bash"])),
        )

        #expect(composer.standingAllows.map(\.toolName) == ["Bash"])
    }
}

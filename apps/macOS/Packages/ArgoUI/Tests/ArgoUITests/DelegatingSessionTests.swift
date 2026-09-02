import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether the Session that delegated a Subagent is running — the fact the rail's dots were drawn
/// without (#1076). Every claim here is about the QUIET side: the states that must not lend a chip
/// the running tint.
@Suite("Delegating session")
struct DelegatingSessionTests {
    @Test
    func `only a running session is running`() {
        // Every status answered, so one added to the domain fails here rather than quietly
        // inheriting a neighbour's reading.
        let running = SessionStatus.allCases.filter { Self.reading(of: $0).isRunning }

        #expect(running == [.running])
    }

    /// degrade-down: the contract has no colour for "we cannot say", so a Session Argo cannot
    /// observe reads as not running rather than as a green dot nothing witnessed.
    @Test
    func `an unknown session degrades down to not running`() {
        #expect(Self.reading(of: .unknown) == .notRunning)
    }

    /// The rail is drawn in rooms that resolve no Session at all, and a reading with no Session is
    /// the same absence of evidence.
    @Test
    func `no session at all is not running`() {
        #expect(DelegatingSession.of(nil) == .notRunning)
    }

    private static func reading(of status: SessionStatus) -> DelegatingSession {
        DelegatingSession.of(CockpitPresentation.Session(
            id: "session-1",
            title: "New session",
            access: .managed,
            status: status,
            chain: .init(program: .init(cli: .claude)),
            work: .init(location: "/Users/milad/Developer/argo"),
            transcript: .init(events: []),
        ))
    }
}
